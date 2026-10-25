import { afterEach, describe, expect, test, vi } from 'vitest'
import { BEISPIEL_VAPID, ANDERER_VAPID } from '@/test/mocks/push'
import {
  BEREIT_FRIST_MS,
  GeraetFehler,
  abonnieren,
  base64urlZuBytes,
  berechtigungErfragen,
  gleicheBytes,
  kuendigen,
  navigationsNachrichtenHoeren,
  standLesen,
} from './pushGeraet'

describe('base64urlZuBytes', () => {
  test('dekodiert den 87-stelligen Vertragsschlüssel zu einem unkomprimierten P-256-Punkt (65 Byte, 0x04)', () => {
    const bytes = base64urlZuBytes(BEISPIEL_VAPID)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(0x04)
  })

  test('liefert mit und ohne Polsterung dasselbe', () => {
    expect(base64urlZuBytes(`${BEISPIEL_VAPID}=`)).toEqual(base64urlZuBytes(BEISPIEL_VAPID))
  })

  test('übersetzt - und _ wie + und /', () => {
    expect(Array.from(base64urlZuBytes('A-_A'))).toEqual([3, 239, 192])
  })
})

describe('gleicheBytes', () => {
  test('gleich', () => expect(gleicheBytes(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true))
  test('anderer Inhalt', () => expect(gleicheBytes(new Uint8Array([1, 3]), new Uint8Array([1, 2]))).toBe(false))
  test('andere Länge', () => expect(gleicheBytes(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false))
  test('fehlender Schlüssel ist nie gleich', () => expect(gleicheBytes(null, new Uint8Array([1]))).toBe(false))
})

// --- Adapter gegen nachgebildete Browser-API ----------------------------------------------

type FalschesAbo = PushSubscription & { unsubscribe: ReturnType<typeof vi.fn> }

function falschesAbo(endpoint: string, schluessel: Uint8Array | null): FalschesAbo {
  return {
    endpoint,
    options: { applicationServerKey: schluessel ? schluessel.slice().buffer : null, userVisibleOnly: true },
    toJSON: () => ({ endpoint, keys: { p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) } }),
    unsubscribe: vi.fn(async () => true),
  } as unknown as FalschesAbo
}

/** Richtet `navigator.serviceWorker`, `PushManager` und `Notification` ein und liefert die Attrappen. */
function browserNachbilden(anfang: { abo?: FalschesAbo | null; ohneWorker?: boolean; berechtigung?: string } = {}) {
  let aktuell: FalschesAbo | null = anfang.abo ?? null
  const pushManager = {
    getSubscription: vi.fn(async () => aktuell),
    subscribe: vi.fn(async (optionen: PushSubscriptionOptionsInit) => {
      const schluessel = new Uint8Array(optionen.applicationServerKey as Uint8Array)
      if (aktuell && !gleicheBytes(new Uint8Array(aktuell.options.applicationServerKey!), schluessel)) {
        throw new DOMException('anderer Schlüssel', 'InvalidStateError')
      }
      aktuell = aktuell ?? falschesAbo('https://Push.Example/Neu', schluessel)
      return aktuell
    }),
  }
  const registrierung = { pushManager }
  Object.defineProperty(window.navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: anfang.ohneWorker ? new Promise(() => {}) : Promise.resolve(registrierung),
      getRegistration: async () => (anfang.ohneWorker ? undefined : registrierung),
    },
  })
  vi.stubGlobal('PushManager', class {})
  const requestPermission = vi.fn(async () => 'granted')
  vi.stubGlobal('Notification', { permission: anfang.berechtigung ?? 'default', requestPermission })
  return { pushManager, requestPermission, abo: () => aktuell }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete (window.navigator as { serviceWorker?: unknown }).serviceWorker
})

describe('standLesen', () => {
  test('ohne Browser-Unterstützung: default, kein Abonnement', async () => {
    await expect(standLesen()).resolves.toEqual({ berechtigung: 'default', abo: null })
  })

  test('liest Berechtigung und Abonnement samt Schlüssel', async () => {
    const schluessel = base64urlZuBytes(BEISPIEL_VAPID)
    browserNachbilden({ abo: falschesAbo('https://push.example/1', schluessel), berechtigung: 'granted' })
    const stand = await standLesen()
    expect(stand.berechtigung).toBe('granted')
    expect(stand.abo?.endpoint).toBe('https://push.example/1')
    expect(gleicheBytes(stand.abo!.schluessel, schluessel)).toBe(true)
  })

  test('hängt ohne registrierten Worker nicht', async () => {
    browserNachbilden({ ohneWorker: true })
    await expect(standLesen()).resolves.toEqual({ berechtigung: 'default', abo: null })
  })
})

describe('berechtigungErfragen', () => {
  test('ruft requestPermission', async () => {
    const { requestPermission } = browserNachbilden()
    await expect(berechtigungErfragen()).resolves.toBe('granted')
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })

  test('ohne Notification gilt denied', async () => {
    await expect(berechtigungErfragen()).resolves.toBe('denied')
  })
})

describe('abonnieren', () => {
  test('abonniert mit userVisibleOnly und liefert die Werte unverändert', async () => {
    const { pushManager } = browserNachbilden()
    const abo = await abonnieren(BEISPIEL_VAPID)
    expect(abo).toEqual({ endpoint: 'https://Push.Example/Neu', p256dh: 'P'.repeat(87), auth: 'A'.repeat(22) })
    const optionen = pushManager.subscribe.mock.calls[0][0]
    expect(optionen.userVisibleOnly).toBe(true)
    expect(Array.from(optionen.applicationServerKey as Uint8Array)).toEqual(Array.from(base64urlZuBytes(BEISPIEL_VAPID)))
  })

  test('kündigt ein Abonnement mit anderem Schlüssel vorher (P7)', async () => {
    const alt = falschesAbo('https://push.example/alt', base64urlZuBytes(ANDERER_VAPID))
    const nachbildung = browserNachbilden({ abo: alt })
    // Nach dem Kündigen gibt es kein Abonnement mehr; die Attrappe legt dann ein neues an.
    alt.unsubscribe.mockImplementation(async () => {
      nachbildung.pushManager.getSubscription.mockResolvedValue(null)
      return true
    })
    nachbildung.pushManager.subscribe.mockImplementation(async (optionen: PushSubscriptionOptionsInit) =>
      falschesAbo('https://push.example/neu', new Uint8Array(optionen.applicationServerKey as Uint8Array)),
    )
    const abo = await abonnieren(BEISPIEL_VAPID)
    expect(alt.unsubscribe).toHaveBeenCalledTimes(1)
    expect(abo.endpoint).toBe('https://push.example/neu')
  })

  test('lässt ein Abonnement mit gleichem Schlüssel stehen', async () => {
    const alt = falschesAbo('https://push.example/gleich', base64urlZuBytes(BEISPIEL_VAPID))
    browserNachbilden({ abo: alt })
    const abo = await abonnieren(BEISPIEL_VAPID)
    expect(alt.unsubscribe).not.toHaveBeenCalled()
    expect(abo.endpoint).toBe('https://push.example/gleich')
  })

  test('kündigt bei unbekanntem Schlüssel erst, wenn subscribe InvalidStateError meldet', async () => {
    const alt = falschesAbo('https://push.example/unbekannt', null)
    const nachbildung = browserNachbilden({ abo: alt })
    nachbildung.pushManager.subscribe
      .mockRejectedValueOnce(new DOMException('anderer Schlüssel', 'InvalidStateError'))
      .mockImplementationOnce(async () => falschesAbo('https://push.example/neu', null))
    const abo = await abonnieren(BEISPIEL_VAPID)
    expect(alt.unsubscribe).toHaveBeenCalledTimes(1)
    expect(abo.endpoint).toBe('https://push.example/neu')
  })

  test('lässt ein Abonnement mit unbekanntem Schlüssel stehen, wenn subscribe es annimmt', async () => {
    const alt = falschesAbo('https://push.example/unbekannt', null)
    const nachbildung = browserNachbilden({ abo: alt })
    nachbildung.pushManager.subscribe.mockResolvedValueOnce(alt)
    const abo = await abonnieren(BEISPIEL_VAPID)
    expect(alt.unsubscribe).not.toHaveBeenCalled()
    expect(abo.endpoint).toBe('https://push.example/unbekannt')
  })

  test('meldet nach Ablauf der Frist einen verständlichen Fehler, wenn kein Worker bereit wird', async () => {
    vi.useFakeTimers()
    browserNachbilden({ ohneWorker: true })
    const ergebnis = abonnieren(BEISPIEL_VAPID).catch((f: unknown) => f)
    await vi.advanceTimersByTimeAsync(BEREIT_FRIST_MS)
    const fehler = await ergebnis
    expect(fehler).toBeInstanceOf(GeraetFehler)
    expect((fehler as GeraetFehler).art).toBe('nichtBereit')
  })

  test('übersetzt NotAllowedError in einen GeraetFehler (kein TypeError, also kein „nicht erreichbar“)', async () => {
    const { pushManager } = browserNachbilden()
    pushManager.subscribe.mockRejectedValue(new DOMException('nein', 'NotAllowedError'))
    const fehler = await abonnieren(BEISPIEL_VAPID).catch((f: unknown) => f)
    expect(fehler).toBeInstanceOf(GeraetFehler)
    expect((fehler as GeraetFehler).art).toBe('abgelehnt')
  })

  test('übersetzt auch einen TypeError des Browsers in einen GeraetFehler', async () => {
    const { pushManager } = browserNachbilden()
    pushManager.subscribe.mockRejectedValue(new TypeError('kaputt'))
    const fehler = await abonnieren(BEISPIEL_VAPID).catch((f: unknown) => f)
    expect(fehler).toBeInstanceOf(GeraetFehler)
  })
})

describe('kuendigen', () => {
  test('kündigt und liefert die Adresse', async () => {
    const alt = falschesAbo('https://push.example/x', null)
    browserNachbilden({ abo: alt })
    await expect(kuendigen()).resolves.toBe('https://push.example/x')
    expect(alt.unsubscribe).toHaveBeenCalledTimes(1)
  })

  test('ohne Abonnement null', async () => {
    browserNachbilden()
    await expect(kuendigen()).resolves.toBeNull()
  })

  test('scheitert unsubscribe, gibt es einen GeraetFehler', async () => {
    const alt = falschesAbo('https://push.example/x', null)
    alt.unsubscribe.mockResolvedValue(false)
    browserNachbilden({ abo: alt })
    await expect(kuendigen()).rejects.toBeInstanceOf(GeraetFehler)
  })
})

describe('navigationsNachrichtenHoeren', () => {
  function containerNachbilden() {
    const ziel = new EventTarget()
    const startMessages = vi.fn()
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: Object.assign(ziel, { startMessages }),
    })
    return { ziel, startMessages }
  }

  test('ruft startMessages und meldet nur die eigene Nachricht mit geprüftem Pfad', () => {
    const { ziel, startMessages } = containerNachbilden()
    const beiZiel = vi.fn()
    const abmelden = navigationsNachrichtenHoeren(beiZiel)
    expect(startMessages).toHaveBeenCalledTimes(1)

    ziel.dispatchEvent(new MessageEvent('message', { data: { type: 'NAVIGIEREN', url: '/termine/5' } }))
    ziel.dispatchEvent(new MessageEvent('message', { data: { type: 'SKIP_WAITING' } }))
    ziel.dispatchEvent(new MessageEvent('message', { data: { type: 'NAVIGIEREN', url: '//fremd.example' } }))
    expect(beiZiel.mock.calls).toEqual([['/termine/5'], ['/']])

    abmelden()
    ziel.dispatchEvent(new MessageEvent('message', { data: { type: 'NAVIGIEREN', url: '/x' } }))
    expect(beiZiel).toHaveBeenCalledTimes(2)
  })

  test('ohne Service Worker wirkungslos', () => {
    expect(() => navigationsNachrichtenHoeren(() => {})()).not.toThrow()
  })
})
