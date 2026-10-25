import { describe, expect, test } from 'vitest'
import { istIos, umgebungLesen } from './umgebung'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPAD_ALS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

describe('istIos', () => {
  test('erkennt das iPhone', () => expect(istIos(IPHONE, 5)).toBe(true))
  test('erkennt das iPad, das sich als Macintosh meldet, am Touch', () => expect(istIos(IPAD_ALS_MAC, 5)).toBe(true))
  test('hält einen Mac ohne Touch nicht für iOS', () => expect(istIos(IPAD_ALS_MAC, 0)).toBe(false))
  test('hält Android nicht für iOS', () => expect(istIos(ANDROID, 5)).toBe(false))
})

/** Baut ein Fenster mit genau den Eigenschaften, die `umgebungLesen` liest. */
function fenster(angaben: {
  ua?: string
  touch?: number
  standaloneMedia?: boolean
  navigatorStandalone?: boolean
  sicher?: boolean
  push?: boolean
  ohneMatchMedia?: boolean
}): Window {
  const navigator: Record<string, unknown> = { userAgent: angaben.ua ?? ANDROID, maxTouchPoints: angaben.touch ?? 0 }
  if (angaben.navigatorStandalone !== undefined) navigator.standalone = angaben.navigatorStandalone
  if (angaben.push) navigator.serviceWorker = {}
  const w: Record<string, unknown> = { navigator, isSecureContext: angaben.sicher ?? true }
  if (!angaben.ohneMatchMedia) w.matchMedia = () => ({ matches: angaben.standaloneMedia ?? false })
  if (angaben.push) {
    w.PushManager = class {}
    w.Notification = class {}
  }
  return w as unknown as Window
}

describe('umgebungLesen', () => {
  test('Android-Browser mit Push', () => {
    expect(umgebungLesen(fenster({ push: true }))).toEqual({
      ios: false,
      standalone: false,
      sicher: true,
      pushMoeglich: true,
    })
  })

  test('erkennt standalone über display-mode', () => {
    expect(umgebungLesen(fenster({ standaloneMedia: true })).standalone).toBe(true)
  })

  test('erkennt standalone über navigator.standalone (iOS)', () => {
    expect(umgebungLesen(fenster({ ua: IPHONE, touch: 5, navigatorStandalone: true })).standalone).toBe(true)
  })

  test('iPhone in Safari: kein Push, nicht standalone', () => {
    expect(umgebungLesen(fenster({ ua: IPHONE, touch: 5 }))).toEqual({
      ios: true,
      standalone: false,
      sicher: true,
      pushMoeglich: false,
    })
  })

  test('unsicherer Ursprung', () => {
    expect(umgebungLesen(fenster({ sicher: false })).sicher).toBe(false)
  })

  test('ohne matchMedia (jsdom) zählt nur navigator.standalone', () => {
    expect(umgebungLesen(fenster({ ohneMatchMedia: true })).standalone).toBe(false)
  })

  test('liest auch das echte Fenster ohne Fehler', () => {
    expect(() => umgebungLesen()).not.toThrow()
  })
})
