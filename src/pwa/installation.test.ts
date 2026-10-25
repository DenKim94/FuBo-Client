import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest'
import { HINWEIS_SCHLUESSEL, hinweisOffen, hinweiseZuruecksetzen } from './hinweisSpeicher'
import {
  installationAbonnieren,
  installationBeobachten,
  installationMoeglich,
  installationZuruecksetzen,
  installieren,
} from './installation'

/** Fenster-Ersatz: Nur die Ereignisse zählen. */
const fenster = new EventTarget()

/** Baut ein synthetisches `beforeinstallprompt` wie Chromium. */
function installEreignis(ausgang: 'accepted' | 'dismissed' = 'accepted') {
  const ereignis = new Event('beforeinstallprompt', { cancelable: true })
  return Object.assign(ereignis, {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome: ausgang }),
  })
}

beforeAll(() => installationBeobachten(fenster as unknown as Window))

afterEach(() => {
  installationZuruecksetzen()
  hinweiseZuruecksetzen()
  window.localStorage.clear()
})

describe('installationBeobachten', () => {
  test('hält das Ereignis zurück und unterdrückt die Infoleiste des Browsers', () => {
    const ereignis = installEreignis()
    const beobachter = vi.fn()
    const abmelden = installationAbonnieren(beobachter)
    fenster.dispatchEvent(ereignis)
    expect(ereignis.defaultPrevented).toBe(true)
    expect(installationMoeglich()).toBe(true)
    expect(beobachter).toHaveBeenCalled()
    abmelden()
  })

  test('appinstalled vermerkt die Installation und verwirft das Ereignis', () => {
    fenster.dispatchEvent(installEreignis())
    fenster.dispatchEvent(new Event('appinstalled'))
    expect(installationMoeglich()).toBe(false)
    expect(hinweisOffen('installation')).toBe(false)
    expect(window.localStorage.getItem(HINWEIS_SCHLUESSEL)).toContain('installation')
  })
})

describe('installieren', () => {
  test('ruft prompt genau einmal je Ereignis', async () => {
    const ereignis = installEreignis('accepted')
    fenster.dispatchEvent(ereignis)
    await expect(installieren()).resolves.toBe('angenommen')
    await expect(installieren()).resolves.toBe('nichtMoeglich')
    expect(ereignis.prompt).toHaveBeenCalledTimes(1)
  })

  test('meldet die Ablehnung', async () => {
    fenster.dispatchEvent(installEreignis('dismissed'))
    await expect(installieren()).resolves.toBe('abgelehnt')
  })

  test('ohne Ereignis nicht möglich', async () => {
    await expect(installieren()).resolves.toBe('nichtMoeglich')
  })
})
