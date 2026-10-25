import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielSitzung } from '@/test/mocks/handlers'
import { problem } from '@/test/mocks/problem'
import { ANDERER_VAPID, BEISPIEL_VAPID, pushHandler, pushWelt, type PushWelt } from '@/test/mocks/push'
import { mockServer } from '@/test/mocks/server'
import { geraet, geraetZuruecksetzen } from '@/test/pushGeraetAttrappe'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import { GeraetFehler } from '@/pwa/pushGeraet'
import { abgleichZuruecksetzen, usePushAbgleich } from './usePushAbgleich'
import { usePushEinrichten } from './usePushEinrichten'
import { usePushEinstellungAendern } from './usePushEinstellungAendern'
import { usePushEntfernen } from './usePushEntfernen'
import { usePushGeraet } from './usePushGeraet'
import { usePushSchluessel } from './usePushSchluessel'
import { usePushStatus } from './usePushStatus'

vi.mock('@/pwa/pushGeraet', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).geraetModul(await original()),
)
vi.mock('@/pwa/umgebung', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).umgebungModul(await original()),
)

function welt(teil: Partial<PushWelt> = {}): PushWelt {
  const w = pushWelt(teil)
  mockServer.use(...pushHandler(w))
  return w
}

beforeEach(() => {
  geraetZuruecksetzen()
  abgleichZuruecksetzen()
})

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('usePushSchluessel', () => {
  test('liefert den Schlüssel', async () => {
    welt()
    const { result } = renderHook(() => usePushSchluessel(true), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.verfuegbar).toBe(true))
    expect(result.current.vapid).toBe(BEISPIEL_VAPID)
  })

  test('503: genau ein Abruf, verfuegbar false, auch nach erneutem Einhängen (G8)', async () => {
    const w = welt({ eingerichtet: false })
    const erster = renderHook(() => usePushSchluessel(true), { wrapper: QueryUmgebung })
    await waitFor(() => expect(erster.result.current.verfuegbar).toBe(false))
    erster.unmount()
    const zweiter = renderHook(() => usePushSchluessel(true), { wrapper: QueryUmgebung })
    expect(zweiter.result.current.verfuegbar).toBe(false)
    await new Promise((r) => setTimeout(r, 50))
    expect(w.zaehler.schluessel).toBe(1)
  })

  test('ein anderer 5xx bleibt ein Fehler, ohne Wiederholung', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/push/schluessel/lesen', () => {
        abrufe += 1
        return problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')
      }),
    )
    const { result } = renderHook(() => usePushSchluessel(true), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.fehler).not.toBeNull())
    expect(result.current.verfuegbar).toBeUndefined()
    expect(abrufe).toBe(1)
  })

  test('liest nichts, wenn nicht aktiv (GAST)', async () => {
    const w = welt()
    renderHook(() => usePushSchluessel(false), { wrapper: QueryUmgebung })
    await new Promise((r) => setTimeout(r, 50))
    expect(w.zaehler.schluessel).toBe(0)
  })
})

describe('usePushStatus und usePushGeraet', () => {
  test('Status wird gelesen', async () => {
    welt({ anlageAktiv: false })
    const { result } = renderHook(() => usePushStatus(true), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data).toEqual({ anlageAktiv: false, pushErwuenscht: true }))
  })

  test('Gerät liefert Umgebung und Stand ohne Netz', async () => {
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/a', vapid: BEISPIEL_VAPID }
    const { result } = renderHook(() => usePushGeraet(), { wrapper: QueryUmgebung })
    await waitFor(() => expect(result.current.data?.stand.abo?.endpoint).toBe('https://push.example/a'))
    expect(result.current.data?.umgebung.pushMoeglich).toBe(true)
  })
})

/** Rendert den Einrichten-Hook mit beobachtetem Gerätezustand daneben (sonst lädt `invalidateQueries` nichts). */
function einrichtenRendern() {
  return renderHook(() => ({ einrichten: usePushEinrichten(), geraet: usePushGeraet() }), { wrapper: QueryUmgebung })
}

describe('usePushEinrichten (E26)', () => {
  test('erfragt die Berechtigung vor jedem Netzaufruf (G2), abonniert und meldet an', async () => {
    const w = welt()
    const { result } = einrichtenRendern()
    await waitFor(() => expect(result.current.geraet.data).toBeDefined())
    let netzBeimErfragen: string[] | null = null
    geraet.beiErfragen = () => {
      netzBeimErfragen = [...w.verlauf]
    }
    let erfolg: boolean | undefined
    await act(async () => {
      erfolg = await result.current.einrichten.einrichten(BEISPIEL_VAPID)
    })
    expect(erfolg).toBe(true)
    expect(netzBeimErfragen).toEqual([])
    expect(geraet.aufrufe.filter((a) => a !== 'stand')).toEqual(['erfragen', 'abonnieren'])
    expect(w.verlauf).toEqual(['anlegen'])
    expect(w.endpunkte.has('https://push.example/geraet-1')).toBe(true)
    await waitFor(() => expect(result.current.geraet.data?.stand.abo).not.toBeNull())
  })

  test('erfragt synchron im Aufruf, nicht erst nach einem Mikrotask', () => {
    welt()
    const { result } = einrichtenRendern()
    act(() => {
      void result.current.einrichten.einrichten(BEISPIEL_VAPID)
      // Noch im selben Aufrufstapel:
      expect(geraet.aufrufe).toContain('erfragen')
    })
  })

  test('bei denied kein Abonnement und ein Fehler mit Text', async () => {
    const w = welt()
    geraet.antwortAufAnfrage = 'denied'
    const { result } = einrichtenRendern()
    let erfolg: boolean | undefined
    await act(async () => {
      erfolg = await result.current.einrichten.einrichten(BEISPIEL_VAPID)
    })
    expect(erfolg).toBe(false)
    expect(geraet.aufrufe).not.toContain('abonnieren')
    expect(w.zaehler.anlegen).toBe(0)
    await waitFor(() => expect(result.current.einrichten.fehler).toBeInstanceOf(GeraetFehler))
    expect(result.current.einrichten.fehler?.message).toMatch(/blockiert/)
  })

  test('geschlossener Dialog (default) ist ein eigener Fehler', async () => {
    welt()
    geraet.antwortAufAnfrage = 'default'
    const { result } = einrichtenRendern()
    await act(async () => {
      await result.current.einrichten.einrichten(BEISPIEL_VAPID)
    })
    await waitFor(() => expect(result.current.einrichten.fehler?.message).toMatch(/geschlossen/))
  })

  test('scheitert die Anmeldung beim Server, wird das Browser-Abonnement zurückgenommen', async () => {
    welt({ anlegenAntwort: () => problem(400, 'EINGABE_UNGUELTIG', 'Die Eingabe ist ungültig.') })
    const { result } = einrichtenRendern()
    let erfolg: boolean | undefined
    await act(async () => {
      erfolg = await result.current.einrichten.einrichten(BEISPIEL_VAPID)
    })
    expect(erfolg).toBe(false)
    expect(geraet.aufrufe).toContain('kuendigen')
    expect(geraet.abo).toBeNull()
    await waitFor(() => expect(result.current.einrichten.fehler?.message).toBe('Die Eingabe ist ungültig.'))
  })

  test('Netzfehler beim Anlegen: ebenfalls Rücknahme', async () => {
    mockServer.use(http.post('*/push/abo/anlegen', () => HttpResponse.error()))
    const { result } = einrichtenRendern()
    await act(async () => {
      await result.current.einrichten.einrichten(BEISPIEL_VAPID)
    })
    expect(geraet.abo).toBeNull()
  })
})

describe('usePushEntfernen (E27)', () => {
  test('kündigt erst im Browser, dann beim Server (G5)', async () => {
    const endpoint = 'https://push.example/weg'
    const w = welt({ endpunkte: new Set([endpoint]) })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint, vapid: BEISPIEL_VAPID }
    let browserVorServer = false
    const { result } = renderHook(() => ({ entfernen: usePushEntfernen(), geraet: usePushGeraet() }), {
      wrapper: QueryUmgebung,
    })
    await waitFor(() => expect(result.current.geraet.data?.stand.abo).not.toBeNull())
    mockServer.use(
      http.post('*/push/abo/entfernen', async ({ request }) => {
        browserVorServer = geraet.abo === null
        const { endpoint: e } = (await request.json()) as { endpoint: string }
        w.endpunkte.delete(e)
        return HttpResponse.json({ aboVorhanden: false })
      }),
    )
    let erfolg: boolean | undefined
    await act(async () => {
      erfolg = await result.current.entfernen.entfernen()
    })
    expect(erfolg).toBe(true)
    expect(browserVorServer).toBe(true)
    expect(w.endpunkte.size).toBe(0)
    await waitFor(() => expect(result.current.geraet.data?.stand.abo).toBeNull())
  })

  test('ohne Abonnement kein Serveraufruf', async () => {
    const w = welt()
    const { result } = renderHook(() => usePushEntfernen(), { wrapper: QueryUmgebung })
    await act(async () => {
      await result.current.entfernen()
    })
    expect(w.zaehler.entfernen).toBe(0)
  })

  test('scheitert das Kündigen im Browser, geht nichts an den Server', async () => {
    const w = welt()
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    geraet.kuendigenFehler = new GeraetFehler('browser', 'Kaputt.')
    const { result } = renderHook(() => usePushEntfernen(), { wrapper: QueryUmgebung })
    let erfolg: boolean | undefined
    await act(async () => {
      erfolg = await result.current.entfernen()
    })
    expect(erfolg).toBe(false)
    expect(w.zaehler.entfernen).toBe(0)
  })
})

describe('usePushEinstellungAendern (P5)', () => {
  test('schreibt den Stand aus der Antwort, nicht den gesendeten', async () => {
    welt({ einstellungAntwort: () => HttpResponse.json({ pushErwuenscht: true }) })
    const { result } = renderHook(() => ({ status: usePushStatus(true), aendern: usePushEinstellungAendern() }), {
      wrapper: QueryUmgebung,
    })
    await waitFor(() => expect(result.current.status.data).toBeDefined())
    await act(async () => {
      await result.current.aendern.mutateAsync(false)
    })
    expect(queryClient.getQueryData(schluessel.pushStatus)).toEqual({ anlageAktiv: true, pushErwuenscht: true })
  })

  test('übernimmt den gespeicherten Stand', async () => {
    welt()
    const { result } = renderHook(() => ({ status: usePushStatus(true), aendern: usePushEinstellungAendern() }), {
      wrapper: QueryUmgebung,
    })
    await waitFor(() => expect(result.current.status.data).toBeDefined())
    await act(async () => {
      await result.current.aendern.mutateAsync(false)
    })
    await waitFor(() => expect(result.current.status.data?.pushErwuenscht).toBe(false))
  })
})

describe('usePushAbgleich (E29)', () => {
  /** Sitzung mit Rolle und Namen. */
  function sitzungAls(rolle: 'USER' | 'ADMIN' | 'GAST', anzeigeName = 'Beispielspieler 03') {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle, anzeigeName })))
  }

  async function abgleichRendern(wrapper: (p: { children: ReactNode }) => ReactNode = QueryUmgebung) {
    const ergebnis = renderHook(() => usePushAbgleich(), { wrapper })
    await waitFor(() => expect(queryClient.getQueryData(schluessel.sitzung)).toBeDefined())
    await new Promise((r) => setTimeout(r, 50))
    return ergebnis
  }

  test('meldet ein vorhandenes Abonnement mit Hintergrundkopf an (G1)', async () => {
    sitzungAls('USER')
    const w = welt()
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/vorhanden', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(1))
    expect(w.anlegenKoepfe).toEqual(['true'])
    expect(w.letzterAboKoerper?.endpoint).toBe('https://push.example/vorhanden')
  })

  test('liest auch den Schlüssel mit Hintergrundkopf', async () => {
    sitzungAls('USER')
    let kopf: string | null = 'nicht gelesen'
    const w = welt()
    mockServer.use(
      http.get('*/push/schluessel/lesen', ({ request }) => {
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return HttpResponse.json({ vapidPublicKey: BEISPIEL_VAPID })
      }),
    )
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/vorhanden', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(1))
    expect(kopf).toBe('true')
  })

  test('kein Aufruf ohne Abonnement', async () => {
    sitzungAls('USER')
    const w = welt()
    geraet.berechtigung = 'granted'
    await abgleichRendern()
    expect(w.verlauf).toEqual([])
  })

  test('kein Aufruf ohne granted', async () => {
    sitzungAls('USER')
    const w = welt()
    geraet.berechtigung = 'default'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    expect(w.verlauf).toEqual([])
  })

  test('kein Aufruf für GAST', async () => {
    sitzungAls('GAST', 'Beispielgast')
    const w = welt({ rolle: 'GAST' })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    expect(w.verlauf).toEqual([])
    expect(geraet.aufrufe).toEqual([])
  })

  test('kein Anlegen bei 503', async () => {
    sitzungAls('USER')
    const w = welt({ eingerichtet: false })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    await waitFor(() => expect(w.zaehler.schluessel).toBe(1))
    expect(w.zaehler.anlegen).toBe(0)
  })

  test('kein Aufruf ohne sicheren Ursprung', async () => {
    sitzungAls('USER')
    const w = welt()
    geraet.umgebung.sicher = false
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    await abgleichRendern()
    expect(w.verlauf).toEqual([])
  })

  test('abonniert neu, wenn der Schlüssel gewechselt hat (G11)', async () => {
    sitzungAls('USER')
    const w = welt({ vapidPublicKey: ANDERER_VAPID })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/alt', vapid: BEISPIEL_VAPID }
    geraet.neuerEndpoint = 'https://push.example/neu'
    await abgleichRendern()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(1))
    expect(w.letzterAboKoerper?.endpoint).toBe('https://push.example/neu')
    expect(geraet.abo?.vapid).toBe(ANDERER_VAPID)
  })

  test('ein Aufruf trotz doppelter Wirkung unter StrictMode', async () => {
    sitzungAls('ADMIN', 'Beispieladmin')
    const w = welt({ rolle: 'ADMIN' })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    const streng = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryUmgebung>{children}</QueryUmgebung>
      </StrictMode>
    )
    // Die Sitzung liegt schon im Cache: Dann läuft die Wirkung beim Einhängen, und StrictMode ruft sie doppelt.
    queryClient.setQueryData(schluessel.sitzung, { ...beispielSitzung, rolle: 'ADMIN', anzeigeName: 'Beispieladmin' })
    const { rerender, unmount } = await abgleichRendern(streng)
    rerender()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(1))
    // Ein neues Einhängen (Neuaufbau des Layouts) im selben Seitenaufruf gleicht ebenfalls nicht erneut ab.
    unmount()
    await abgleichRendern(streng)
    await new Promise((r) => setTimeout(r, 50))
    expect(w.zaehler.anlegen).toBe(1)
  })

  test('nach einem Personenwechsel wird erneut abgeglichen (P3)', async () => {
    const w = welt()
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/geteilt', vapid: BEISPIEL_VAPID }
    queryClient.setQueryData(schluessel.sitzung, { ...beispielSitzung, anzeigeName: 'Beispielspieler 01' })
    sitzungAls('USER', 'Beispielspieler 01')
    const erster = await abgleichRendern()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(1))
    erster.unmount()
    queryClient.setQueryData(schluessel.sitzung, { ...beispielSitzung, anzeigeName: 'Beispielspieler 02' })
    sitzungAls('USER', 'Beispielspieler 02')
    await abgleichRendern()
    await waitFor(() => expect(w.zaehler.anlegen).toBe(2))
  })

  test('Fehler bleiben still', async () => {
    sitzungAls('USER')
    welt({ anlegenAntwort: () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') })
    geraet.berechtigung = 'granted'
    geraet.abo = { endpoint: 'https://push.example/x', vapid: BEISPIEL_VAPID }
    await expect(abgleichRendern()).resolves.toBeDefined()
  })
})
