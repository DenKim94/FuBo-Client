import { afterEach, describe, expect, test, vi } from 'vitest'
import { HINWEIS_SCHLUESSEL, hinweisErledigt, hinweisOffen, hinweiseAbonnieren, hinweiseZuruecksetzen } from './hinweisSpeicher'

afterEach(() => {
  vi.restoreAllMocks()
  hinweiseZuruecksetzen()
  window.localStorage.clear()
})

describe('hinweisSpeicher', () => {
  test('offen, bis erledigt; im localStorage vermerkt', () => {
    expect(hinweisOffen('installation')).toBe(true)
    hinweisErledigt('installation')
    expect(hinweisOffen('installation')).toBe(false)
    expect(hinweisOffen('benachrichtigungen')).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(HINWEIS_SCHLUESSEL)!)).toEqual({ installation: true })
  })

  test('liest einen Vermerk aus einem früheren Seitenaufruf', () => {
    window.localStorage.setItem(HINWEIS_SCHLUESSEL, JSON.stringify({ benachrichtigungen: true }))
    expect(hinweisOffen('benachrichtigungen')).toBe(false)
  })

  test('meldet Änderungen', () => {
    const beobachter = vi.fn()
    const abmelden = hinweiseAbonnieren(beobachter)
    hinweisErledigt('benachrichtigungen')
    expect(beobachter).toHaveBeenCalledTimes(1)
    abmelden()
  })

  test('wirft der Speicher (Safari privat), gilt der Vermerk für diesen Seitenaufruf', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('gesperrt', 'SecurityError')
    })
    expect(hinweisOffen('installation')).toBe(true)
    expect(() => hinweisErledigt('installation')).not.toThrow()
    expect(hinweisOffen('installation')).toBe(false)
  })

  test('ein kaputter Eintrag zählt als nichts erledigt', () => {
    window.localStorage.setItem(HINWEIS_SCHLUESSEL, '{kaputt')
    expect(hinweisOffen('installation')).toBe(true)
  })
})
