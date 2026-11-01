import { describe, expect, test } from 'vitest'

/**
 * Die Testumgebung selbst (01.11.2026).
 *
 * Unter Node 24 scheiterten 62 Tests mit „RequestInit: Expected signal (…) to be an instance of AbortSignal“: Vitest 3
 * setzte im jsdom-Modus jsdoms `AbortController`/`AbortSignal` ein, `Request` und `fetch` blieben die von Node. React
 * Router baut bei jeder Navigation einen `Request` mit einem Signal; Node 24 (undici 7) prüft dessen Herkunft streng,
 * Node 22 nicht – deshalb fiel es erst nach dem Wechsel auf. Vitest 4 nimmt Node für alle diese Klassen (vitest#8390).
 *
 * Geprüft wird die Herkunft, nicht das Scheitern: Das gelingt unter jeder Node-Fassung.
 */
describe('Testumgebung', () => {
  test('AbortSignal und Request stammen aus derselben Umgebung', () => {
    const steuerung = new AbortController()
    const anfrage = new Request('http://localhost/', { signal: steuerung.signal })

    expect(steuerung.signal).toBeInstanceOf(AbortSignal)
    expect(anfrage.signal).toBeInstanceOf(AbortSignal)
  })

  test('ein abgebrochenes Signal kommt beim Request an', () => {
    const steuerung = new AbortController()
    const anfrage = new Request('http://localhost/', { signal: steuerung.signal })
    steuerung.abort()
    expect(anfrage.signal.aborted).toBe(true)
  })
})
