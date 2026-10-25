import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { HINWEIS_SCHLUESSEL, hinweiseZuruecksetzen } from '@/pwa/hinweisSpeicher'
import { installationBeobachten, installationZuruecksetzen } from '@/pwa/installation'
import { IOS_ANLEITUNG } from '@/pwa/pushLage'
import { beispielSitzung } from '@/test/mocks/handlers'
import { BEISPIEL_VAPID, pushHandler, pushWelt, type PushWelt } from '@/test/mocks/push'
import { mockServer } from '@/test/mocks/server'
import { geraet, geraetZuruecksetzen } from '@/test/pushGeraetAttrappe'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import Onboarding, { TEXT_BENACHRICHTIGUNGEN } from './Onboarding'

vi.mock('@/pwa/pushGeraet', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).geraetModul(await original()),
)
vi.mock('@/pwa/umgebung', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).umgebungModul(await original()),
)

/** Fenster-Ersatz für `beforeinstallprompt`. */
const fenster = new EventTarget()

function installEreignisSenden(ausgang: 'accepted' | 'dismissed' = 'accepted') {
  const ereignis = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: ausgang }),
  })
  fenster.dispatchEvent(ereignis)
  return ereignis
}

function rendern(rolle: 'USER' | 'ADMIN' | 'GAST' = 'USER', teil: Partial<PushWelt> = {}) {
  const welt = pushWelt({ rolle, ...teil })
  mockServer.use(
    ...pushHandler(welt),
    http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle })),
  )
  const ergebnis = render(
    <QueryUmgebung>
      <MemoryRouter>
        <Onboarding />
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return { welt, ...ergebnis }
}

/** Wartet, bis die Sitzung gelesen und alle Abfragen zur Ruhe gekommen sind. */
async function ruhe() {
  await waitFor(() => expect(queryClient.getQueryData(['sitzung'])).toBeDefined())
  await new Promise((r) => setTimeout(r, 60))
}

beforeAll(() => installationBeobachten(fenster as unknown as Window))

beforeEach(() => {
  geraetZuruecksetzen()
  installationZuruecksetzen()
  hinweiseZuruecksetzen()
  window.localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('Schritt 2 – Benachrichtigungen', () => {
  test('USER ohne Installationsweg: gleich Schritt 2; Einrichten aus dem Klick', async () => {
    const { welt } = rendern()
    expect(await screen.findByTestId('onboarding-titel')).toHaveTextContent('Benachrichtigungen')
    expect(screen.getByTestId('onboarding')).toHaveTextContent(TEXT_BENACHRICHTIGUNGEN)
    expect(screen.getByRole('region', { name: 'Benachrichtigungen' })).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('onboarding-push-einrichten'))
    expect(geraet.aufrufe).toContain('erfragen')
    expect(await screen.findByTestId('onboarding-erfolg')).toBeInTheDocument()
    expect(welt.endpunkte.size).toBe(1)
    expect(JSON.parse(window.localStorage.getItem(HINWEIS_SCHLUESSEL)!)).toEqual({ benachrichtigungen: true })

    fireEvent.click(screen.getByTestId('onboarding-schliessen'))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })

  test('„Nicht jetzt“ vermerkt; danach keine Karte und kein Schlüssel- oder Statusabruf mehr (G9)', async () => {
    const erster = rendern()
    fireEvent.click(await screen.findByTestId('onboarding-nicht-jetzt'))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    erster.unmount()
    queryClient.clear()

    const { welt } = rendern()
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(welt.zaehler.schluessel).toBe(0)
    expect(welt.zaehler.status).toBe(0)
  })

  test('abgelehnte Berechtigung: Grund und „Schließen“', async () => {
    geraet.antwortAufAnfrage = 'denied'
    rendern()
    fireEvent.click(await screen.findByTestId('onboarding-push-einrichten'))
    expect(await screen.findByTestId('onboarding-fehler')).toHaveTextContent(/blockiert/)
    fireEvent.click(await screen.findByTestId('onboarding-schliessen'))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })

  test.each([
    ['Anlage aus', { anlageAktiv: false }],
    ['Person aus', { pushErwuenscht: false }],
    ['Server ohne VAPID', { eingerichtet: false }],
  ] as const)('keine Karte: %s', async (_fall, teil) => {
    rendern('USER', teil)
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })

  test('keine Karte und kein Serveraufruf, wenn das Gerät blockiert ist', async () => {
    geraet.berechtigung = 'denied'
    const { welt } = rendern()
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(welt.verlauf).toEqual([])
  })

  test('keine Karte, wenn das Gerät schon eingerichtet ist', async () => {
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/a', vapid: BEISPIEL_VAPID }
    const { welt } = rendern()
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(welt.verlauf).toEqual([])
  })

  test('keine Karte ohne Push im Browser', async () => {
    geraet.umgebung = { ios: false, standalone: false, sicher: true, pushMoeglich: false }
    rendern()
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })
})

describe('Schritt 1 – Installation', () => {
  test('mit Ereignis zuerst die Installation; „Später“ führt zu Schritt 2 und setzt den Fokus dorthin', async () => {
    installEreignisSenden()
    rendern()
    expect(await screen.findByTestId('onboarding-titel')).toHaveTextContent('App installieren')
    fireEvent.click(screen.getByTestId('onboarding-spaeter'))
    await waitFor(() => expect(screen.getByTestId('onboarding-titel')).toHaveTextContent('Benachrichtigungen'))
    expect(screen.getByTestId('onboarding-titel')).toHaveFocus()
  })

  test('„Installieren“ ruft prompt und vermerkt', async () => {
    const ereignis = installEreignisSenden('accepted')
    rendern()
    fireEvent.click(await screen.findByTestId('onboarding-installieren'))
    await waitFor(() => expect(ereignis.prompt).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(JSON.parse(window.localStorage.getItem(HINWEIS_SCHLUESSEL)!)).toEqual({ installation: true }),
    )
    // Danach Schritt 2, mit dem Fokus auf seiner Überschrift.
    await waitFor(() => expect(screen.getByTestId('onboarding-titel')).toHaveTextContent('Benachrichtigungen'))
    expect(screen.getByTestId('onboarding-titel')).toHaveFocus()
  })

  test('iOS in Safari: Anleitung und „Verstanden“', async () => {
    geraet.umgebung = { ios: true, standalone: false, sicher: true, pushMoeglich: false }
    rendern()
    expect(await screen.findByTestId('onboarding-titel')).toHaveTextContent('App auf den Home-Bildschirm')
    expect(screen.getByTestId('onboarding')).toHaveTextContent(IOS_ANLEITUNG)
    fireEvent.click(screen.getByTestId('onboarding-verstanden'))
    // Auf iOS ohne Ablegen gibt es keinen Push: Schritt 2 entfällt.
    await waitFor(() => expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument())
  })

  test('als App gestartet: kein Schritt 1', async () => {
    installEreignisSenden()
    geraet.umgebung = { ios: false, standalone: true, sicher: true, pushMoeglich: true }
    rendern()
    expect(await screen.findByTestId('onboarding-titel')).toHaveTextContent('Benachrichtigungen')
  })

  test('ADMIN: nur die Installation, kein Schritt 2', async () => {
    installEreignisSenden()
    const { welt } = rendern('ADMIN')
    fireEvent.click(await screen.findByTestId('onboarding-spaeter'))
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(welt.verlauf).toEqual([])
  })

  test('erscheint nach „Später“ nicht wieder (G9)', async () => {
    installEreignisSenden()
    const erster = rendern('ADMIN')
    fireEvent.click(await screen.findByTestId('onboarding-spaeter'))
    erster.unmount()
    installEreignisSenden()
    rendern('ADMIN')
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })
})

describe('Gast und gesperrter Speicher', () => {
  test('GAST: keine Karte, kein Push-Aufruf (G6)', async () => {
    installEreignisSenden()
    const { welt } = rendern('GAST')
    await ruhe()
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
    expect(welt.verlauf).toEqual([])
  })

  test('localStorage wirft: Karte trotzdem bedienbar und wegklickbar', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError')
    })
    rendern()
    fireEvent.click(await screen.findByTestId('onboarding-nicht-jetzt'))
    expect(screen.queryByTestId('onboarding')).not.toBeInTheDocument()
  })
})
