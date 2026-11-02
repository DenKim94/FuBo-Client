import { afterEach, describe, expect, test, vi } from 'vitest'
import { BAND_NEU_ATTRIBUT, BAND_PAUSE_MS, IOS_APP_ATTRIBUT, iosAppKennzeichnen, statusleisteNachfaerben } from './iosApp'

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36'

/** Ein nachgebildetes Fenster wie in `umgebung.test.ts`; `document` ist das echte von jsdom. */
function fenster(ua: string, standalone: boolean | undefined, anzeigeStandalone = false): Window {
  const navigator: Record<string, unknown> = { userAgent: ua, maxTouchPoints: 5 }
  if (standalone !== undefined) navigator.standalone = standalone
  return {
    navigator,
    document,
    isSecureContext: true,
    matchMedia: (abfrage: string) => ({ matches: anzeigeStandalone && abfrage.includes('standalone') }),
  } as unknown as Window
}

afterEach(() => {
  document.documentElement.removeAttribute(IOS_APP_ATTRIBUT)
})

describe('iosAppKennzeichnen', () => {
  test('installierte App auf dem iPhone (navigator.standalone): Attribut gesetzt', () => {
    expect(iosAppKennzeichnen(fenster(IPHONE, true))).toBe(true)
    expect(document.documentElement).toHaveAttribute(IOS_APP_ATTRIBUT)
  })

  test('installierte App auf dem iPhone nur über display-mode erkannt: ebenfalls gesetzt', () => {
    expect(iosAppKennzeichnen(fenster(IPHONE, undefined, true))).toBe(true)
  })

  test('Safari im Browser: kein Attribut', () => {
    expect(iosAppKennzeichnen(fenster(IPHONE, false))).toBe(false)
    expect(document.documentElement).not.toHaveAttribute(IOS_APP_ATTRIBUT)
  })

  test('installierte App auf Android: kein Attribut (die Unschärfe gibt es nur auf iOS)', () => {
    expect(iosAppKennzeichnen(fenster(ANDROID, undefined, true))).toBe(false)
    expect(document.documentElement).not.toHaveAttribute(IOS_APP_ATTRIBUT)
  })
})

describe('statusleisteNachfaerben', () => {
  /** Ein Fenster mit steuerbarer Abfrage `prefers-color-scheme`. */
  function mitFarbabfrage() {
    const hoerer = new Set<() => void>()
    const abfrage = {
      matches: false,
      addEventListener: (_art: string, f: () => void) => hoerer.add(f),
      removeEventListener: (_art: string, f: () => void) => hoerer.delete(f),
    }
    const w = { document, matchMedia: () => abfrage } as unknown as Window
    return { w, wechseln: () => hoerer.forEach((f) => f()), anzahl: () => hoerer.size }
  }

  afterEach(() => {
    vi.useRealTimers()
    document.documentElement.removeAttribute(BAND_NEU_ATTRIBUT)
  })

  test('blendet das Band bei einem Wechsel kurz aus und wieder ein', () => {
    vi.useFakeTimers()
    const { w, wechseln } = mitFarbabfrage()
    const beenden = statusleisteNachfaerben(w)

    expect(document.documentElement).not.toHaveAttribute(BAND_NEU_ATTRIBUT)
    wechseln()
    expect(document.documentElement).toHaveAttribute(BAND_NEU_ATTRIBUT)
    vi.advanceTimersByTime(BAND_PAUSE_MS)
    expect(document.documentElement).not.toHaveAttribute(BAND_NEU_ATTRIBUT)
    beenden()
  })

  test('zwei schnelle Wechsel: das Band erscheint erst nach dem letzten wieder', () => {
    vi.useFakeTimers()
    const { w, wechseln } = mitFarbabfrage()
    const beenden = statusleisteNachfaerben(w)

    wechseln()
    vi.advanceTimersByTime(BAND_PAUSE_MS - 20)
    wechseln()
    vi.advanceTimersByTime(BAND_PAUSE_MS - 20)
    expect(document.documentElement).toHaveAttribute(BAND_NEU_ATTRIBUT)
    vi.advanceTimersByTime(20)
    expect(document.documentElement).not.toHaveAttribute(BAND_NEU_ATTRIBUT)
    beenden()
  })

  test('beenden meldet den Hörer ab', () => {
    const { w, anzahl } = mitFarbabfrage()
    const beenden = statusleisteNachfaerben(w)
    expect(anzahl()).toBe(1)
    beenden()
    expect(anzahl()).toBe(0)
  })
})
