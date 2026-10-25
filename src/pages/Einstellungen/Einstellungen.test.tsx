import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielSitzung } from '@/test/mocks/handlers'
import { problem } from '@/test/mocks/problem'
import { BEISPIEL_VAPID, pushHandler, pushWelt, type PushWelt } from '@/test/mocks/push'
import { mockServer } from '@/test/mocks/server'
import { geraet, geraetZuruecksetzen } from '@/test/pushGeraetAttrappe'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import { hinweisOffen, hinweiseZuruecksetzen } from '@/pwa/hinweisSpeicher'
import { installationBeobachten, installationZuruecksetzen } from '@/pwa/installation'
import { IOS_ANLEITUNG } from '@/pwa/pushLage'
import Einstellungen from './Einstellungen'
import { TEXT_ABSCHALTEN, TEXT_ADMIN } from './PushBereich'
import { probeErgebnisText } from './probeErgebnisText'
import { TEXT_MENUE } from './InstallationBereich'
import { TEXT_PROBE_AUSSAGE, TEXT_PROBE_NICHT_EINGERICHTET } from './ProbeversandBereich'

vi.mock('@/pwa/pushGeraet', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).geraetModul(await original()),
)
vi.mock('@/pwa/umgebung', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).umgebungModul(await original()),
)

function rendern(rolle: 'USER' | 'ADMIN' | 'GAST' = 'USER', teil: Partial<PushWelt> = {}) {
  const welt = pushWelt({ rolle, ...teil })
  mockServer.use(
    ...pushHandler(welt),
    http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle })),
  )
  render(
    <QueryUmgebung>
      <MemoryRouter>
        <Einstellungen />
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Wartet, bis die Gerätezeile eine Lage zeigt. */
async function geraetText() {
  await waitFor(() => expect(screen.getByTestId('push-zustand-geraet-text')).not.toHaveTextContent('wird gelesen'))
  return screen.getByTestId('push-zustand-geraet-text').textContent
}

/** Fenster-Ersatz für `beforeinstallprompt`. */
const fenster = new EventTarget()
beforeAll(() => installationBeobachten(fenster as unknown as Window))

beforeEach(() => {
  geraetZuruecksetzen()
  installationZuruecksetzen()
  hinweiseZuruecksetzen()
  window.localStorage.clear()
})

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('Einstellungen je Rolle', () => {
  test('USER: drei Ebenen, Personenschalter, Gerätebereich, kein Probeversand', async () => {
    rendern('USER')
    expect(await screen.findByTestId('push-schalter')).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('push-zustand-anlage-text')).toHaveTextContent('Vom Admin eingeschaltet')
    expect(screen.getByTestId('push-zustand-person-text')).toHaveTextContent('Für dich eingeschaltet')
    expect(await geraetText()).toBe('Auf diesem Gerät nicht eingerichtet.')
    expect(screen.getByTestId('push-einrichten')).toHaveTextContent('Auf diesem Gerät einrichten')
    expect(screen.queryByTestId('probe-bereich')).not.toBeInTheDocument()
    expect(screen.getByTestId('push-gesamtsatz')).toHaveTextContent('noch nicht eingerichtet')
  })

  test('ADMIN: kein Personenschalter, Satz zum Probeversand, Probeversand mit Anlagenschalter daneben (G12)', async () => {
    rendern('ADMIN', { anlageAktiv: false })
    expect(await screen.findByTestId('probe-bereich')).toBeInTheDocument()
    expect(screen.getByTestId('push-admin-satz')).toHaveTextContent(TEXT_ADMIN)
    expect(screen.queryByTestId('push-schalter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('push-zustand-person')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('probe-anlage')).toHaveTextContent('abgeschaltet'))
    expect(screen.getByTestId('probe-aussage')).toHaveTextContent(TEXT_PROBE_AUSSAGE)
    expect(screen.getByTestId('probe-konfiguration-link')).toHaveAttribute('href', '/admin/konfiguration')
  })

  test('GAST: nur ein Satz, kein Push-Aufruf (G6)', async () => {
    const welt = rendern('GAST')
    expect(await screen.findByTestId('einstellungen-gast')).toHaveTextContent('Für Gäste gibt es keine Einstellungen.')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByTestId('push-bereich')).not.toBeInTheDocument()
    expect(welt.verlauf).toEqual([])
  })
})

describe('Gerätelagen', () => {
  test('eingerichtet: Entfernen-Knopf und Hinweis zum geteilten Gerät', async () => {
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/a', vapid: BEISPIEL_VAPID }
    rendern()
    expect(await geraetText()).toBe('Auf diesem Gerät eingerichtet.')
    expect(screen.getByTestId('push-entfernen')).toHaveTextContent('Auf diesem Gerät entfernen')
    expect(screen.getByTestId('push-geraet')).toHaveTextContent('Gibst du das Gerät weiter')
    expect(screen.getByTestId('push-gesamtsatz')).toHaveTextContent('Du bekommst Erinnerungen und Absagen')
  })

  test('blockiert: Text ohne Knopf', async () => {
    geraet.berechtigung = 'denied'
    rendern()
    expect(await geraetText()).toMatch(/^Im Browser blockiert/)
    expect(screen.queryByTestId('push-einrichten')).not.toBeInTheDocument()
    expect(screen.queryByTestId('push-entfernen')).not.toBeInTheDocument()
    expect(screen.queryByTestId('push-geraet')).not.toBeInTheDocument()
  })

  test('iPhone in Safari: kein Knopf, die Anleitung steht nur einmal (unter „App installieren“)', async () => {
    geraet.umgebung = { ios: true, standalone: false, sicher: true, pushMoeglich: false }
    rendern()
    expect(await geraetText()).toMatch(/Home-Bildschirm/)
    expect(screen.queryByTestId('push-einrichten')).not.toBeInTheDocument()
    expect(screen.getByTestId('installation-ios')).toHaveTextContent(IOS_ANLEITUNG)
    // Ohne Inhalt entfällt der Gerätebereich samt Überschrift.
    expect(screen.queryByTestId('push-geraet')).not.toBeInTheDocument()
    expect(screen.getAllByText(IOS_ANLEITUNG)).toHaveLength(1)
  })

  test('kein Push im Browser', async () => {
    geraet.umgebung = { ios: false, standalone: false, sicher: true, pushMoeglich: false }
    rendern()
    expect(await geraetText()).toBe('Dieser Browser unterstützt keine Benachrichtigungen.')
    expect(screen.queryByTestId('push-geraet')).not.toBeInTheDocument()
  })

  test('unsichere Verbindung', async () => {
    geraet.umgebung = { ios: false, standalone: false, sicher: false, pushMoeglich: false }
    rendern()
    expect(await geraetText()).toMatch(/https/)
    expect(screen.queryByTestId('push-geraet')).not.toBeInTheDocument()
  })

  test('Server ohne VAPID: nur ein Satz, keine Bedienelemente, kein Status-Fehlerbild', async () => {
    rendern('USER', { eingerichtet: false })
    expect(await screen.findByTestId('push-nicht-eingerichtet')).toHaveTextContent(
      'Benachrichtigungen sind auf diesem Server nicht eingerichtet.',
    )
    expect(screen.queryByTestId('push-schalter')).not.toBeInTheDocument()
    expect(screen.queryByTestId('push-einrichten')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('Einrichten und Entfernen', () => {
  test('Einrichten meldet an und fokussiert die Gerätezeile', async () => {
    const welt = rendern()
    fireEvent.click(await screen.findByTestId('push-einrichten'))
    await waitFor(() => expect(screen.getByTestId('push-zustand-geraet-text')).toHaveTextContent('Auf diesem Gerät eingerichtet.'))
    expect(welt.endpunkte.size).toBe(1)
    await waitFor(() => expect(screen.getByTestId('push-zustand-geraet')).toHaveFocus())
  })

  test('Einrichten fragt die Berechtigung ohne vorherigen Netzaufruf', async () => {
    const welt = rendern()
    const knopf = await screen.findByTestId('push-einrichten')
    const vorher = welt.verlauf.length
    let neuBeimErfragen = -1
    geraet.beiErfragen = () => {
      neuBeimErfragen = welt.verlauf.length - vorher
    }
    fireEvent.click(knopf)
    expect(neuBeimErfragen).toBe(0)
    await waitFor(() => expect(welt.zaehler.anlegen).toBe(1))
  })

  test('abgelehnte Berechtigung zeigt den Grund am Gerät', async () => {
    geraet.antwortAufAnfrage = 'denied'
    rendern()
    fireEvent.click(await screen.findByTestId('push-einrichten'))
    expect(await screen.findByTestId('push-geraet-fehler')).toHaveTextContent(/blockiert/)
    // Mit Fehler bleibt der Bereich stehen, auch wenn die Lage danach keinen Knopf mehr hat.
    expect(screen.getByTestId('push-geraet')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('push-zustand-geraet-text')).toHaveTextContent(/^Im Browser blockiert/))
  })

  test('Fehler des Servers beim Einrichten: Text des Servers, Gerät bleibt nicht eingerichtet', async () => {
    rendern('USER', { anlegenAntwort: () => problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.') })
    fireEvent.click(await screen.findByTestId('push-einrichten'))
    expect(await screen.findByTestId('push-geraet-fehler')).toHaveTextContent('Die Eingabe ist ungültig.')
    expect(screen.getByTestId('push-zustand-geraet-text')).toHaveTextContent('Auf diesem Gerät nicht eingerichtet.')
  })

  test('Entfernen: zuerst Browser, dann Server; danach nicht eingerichtet', async () => {
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/a', vapid: BEISPIEL_VAPID }
    const welt = rendern('USER', { endpunkte: new Set(['https://push.example/a']) })
    fireEvent.click(await screen.findByTestId('push-entfernen'))
    await waitFor(() =>
      expect(screen.getByTestId('push-zustand-geraet-text')).toHaveTextContent('Auf diesem Gerät nicht eingerichtet.'),
    )
    expect(geraet.aufrufe).toContain('kuendigen')
    expect(welt.zaehler.entfernen).toBe(1)
    expect(welt.endpunkte.size).toBe(0)
    await waitFor(() => expect(screen.getByTestId('push-zustand-geraet')).toHaveFocus())
  })
})

describe('Personenschalter (E28)', () => {
  test('Abschalten zeigt den Hinweis einmal; Einschalten nimmt ihn weg', async () => {
    const welt = rendern()
    const schalter = await screen.findByTestId('push-schalter')
    fireEvent.click(schalter)
    expect(await screen.findByTestId('push-abschalt-hinweis')).toHaveTextContent(TEXT_ABSCHALTEN)
    expect(welt.pushErwuenscht).toBe(false)
    expect(schalter).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('push-zustand-person-text')).toHaveTextContent('Von dir abgeschaltet')
    expect(screen.getAllByTestId('push-abschalt-hinweis')).toHaveLength(1)

    fireEvent.click(schalter)
    await waitFor(() => expect(schalter).toHaveAttribute('aria-checked', 'true'))
    expect(screen.queryByTestId('push-abschalt-hinweis')).not.toBeInTheDocument()
  })

  test('zeigt den gespeicherten Stand, nicht den gesendeten', async () => {
    const w = rendern('USER', { einstellungAntwort: () => HttpResponse.json({ pushErwuenscht: true }) })
    const welt = () => w
    const schalter = await screen.findByTestId('push-schalter')
    fireEvent.click(schalter)
    await waitFor(() => expect(welt().zaehler.einstellung).toBe(1))
    await waitFor(() => expect(schalter).not.toHaveAttribute('aria-busy'))
    expect(schalter).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByTestId('push-abschalt-hinweis')).not.toBeInTheDocument()
  })

  test('Fehler beim Umschalten steht am Schalter', async () => {
    rendern('USER', { einstellungAntwort: () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Profil nicht gefunden.') })
    fireEvent.click(await screen.findByTestId('push-schalter'))
    expect(await screen.findByTestId('push-schalter-fehler')).toHaveTextContent('Profil nicht gefunden.')
  })

  test('Abschalten löscht kein Abonnement: Gerät bleibt eingerichtet', async () => {
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/a', vapid: BEISPIEL_VAPID }
    rendern()
    fireEvent.click(await screen.findByTestId('push-schalter'))
    await screen.findByTestId('push-abschalt-hinweis')
    expect(screen.getByTestId('push-zustand-geraet-text')).toHaveTextContent('Auf diesem Gerät eingerichtet.')
    expect(screen.getByTestId('push-gesamtsatz')).toHaveTextContent('Du hast sie für dich abgeschaltet')
  })
})

describe('Probeversand', () => {
  test('meldet Geräte und angenommene Zustellungen', async () => {
    rendern('ADMIN', { endpunkte: new Set(['https://push.example/a', 'https://push.example/b']) })
    fireEvent.click(await screen.findByTestId('probe-senden'))
    expect(await screen.findByTestId('probe-ergebnis')).toHaveTextContent(
      'An 2 Geräte gesendet, 2 vom Push-Dienst angenommen.',
    )
  })

  test('empfaenger 0 ist kein Fehler', async () => {
    rendern('ADMIN')
    fireEvent.click(await screen.findByTestId('probe-senden'))
    expect(await screen.findByTestId('probe-ergebnis')).toHaveTextContent('Auf deinem Konto ist kein Gerät eingerichtet.')
    expect(screen.queryByTestId('probe-fehler')).not.toBeInTheDocument()
  })

  test('ohne VAPID: Satz und gesperrter Knopf mit Grund', async () => {
    const welt = rendern('ADMIN', { eingerichtet: false })
    const knopf = await screen.findByTestId('probe-senden')
    await waitFor(() => expect(knopf).toHaveAttribute('aria-disabled', 'true'))
    expect(screen.getByTestId('probe-nicht-eingerichtet')).toHaveTextContent(TEXT_PROBE_NICHT_EINGERICHTET)
    expect(knopf.getAttribute('aria-describedby')).toBe(screen.getByTestId('probe-nicht-eingerichtet').id)
    fireEvent.click(knopf)
    await new Promise((r) => setTimeout(r, 30))
    expect(welt.zaehler.probe).toBe(0)
  })

  test('Pluralform für ein Gerät', () => {
    expect(probeErgebnisText({ empfaenger: 1, zugestellt: 0 })).toBe('An 1 Gerät gesendet, 0 vom Push-Dienst angenommen.')
  })

  test('ein anderer Fehler steht als Meldung', async () => {
    rendern('ADMIN')
    mockServer.use(http.post('*/admin/push/test', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    fireEvent.click(await screen.findByTestId('probe-senden'))
    expect(await screen.findByTestId('probe-fehler')).toHaveTextContent('Interner Fehler.')
  })
})

describe('Ladezustand', () => {
  test('Status und Gerät laden unabhängig', async () => {
    rendern('USER', {
      statusAntwort: () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.'),
    })
    // Der Status scheitert (nach einer Wiederholung), das Gerät steht trotzdem da.
    expect(await geraetText()).toBe('Auf diesem Gerät nicht eingerichtet.')
    const bereich = screen.getByTestId('push-bereich')
    expect(await within(bereich).findByTestId('push-status-fehler-meldung', {}, { timeout: 3000 })).toHaveTextContent(
      'Interner Fehler.',
    )
  })
})

describe('App installieren (7.3)', () => {
  test('ohne eigenes Angebot des Browsers: Satz zum Menü', async () => {
    rendern()
    expect(await screen.findByTestId('installation-menue')).toHaveTextContent(TEXT_MENUE)
    expect(screen.queryByTestId('installation-knopf')).not.toBeInTheDocument()
  })

  test('mit zurückgehaltenem Ereignis: Knopf ruft prompt', async () => {
    const ereignis = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    fenster.dispatchEvent(ereignis)
    rendern()
    fireEvent.click(await screen.findByTestId('installation-knopf'))
    await waitFor(() => expect(ereignis.prompt).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(hinweisOffen('installation')).toBe(false))
  })

  test('auch nach weggeklicktem Onboarding erreichbar', async () => {
    window.localStorage.setItem('fubo.hinweise', JSON.stringify({ installation: true }))
    rendern()
    expect(await screen.findByTestId('installation-bereich')).toBeInTheDocument()
  })

  test('iOS: Anleitung', async () => {
    geraet.umgebung = { ios: true, standalone: false, sicher: true, pushMoeglich: false }
    rendern()
    expect(await screen.findByTestId('installation-ios')).toHaveTextContent(IOS_ANLEITUNG)
  })

  test('als App gestartet: kein Abschnitt', async () => {
    geraet.umgebung = { ios: false, standalone: true, sicher: true, pushMoeglich: true }
    rendern()
    await screen.findByTestId('push-bereich')
    expect(screen.queryByTestId('installation-bereich')).not.toBeInTheDocument()
  })

  test('GAST: kein Abschnitt', async () => {
    rendern('GAST')
    await screen.findByTestId('einstellungen-gast')
    expect(screen.queryByTestId('installation-bereich')).not.toBeInTheDocument()
  })
})
