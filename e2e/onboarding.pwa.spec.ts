import { expect, test, type Page } from '@playwright/test'
import { pushGeraetNachbilden, pushNachbilden } from './hilfen/push.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { termineNachbilden } from './hilfen/termine.js'

/**
 * Onboarding-Karte (C9, 7.2, E33) gegen die gebaute Fassung. Als einzige Spec **ohne** den Vermerk aus
 * `sitzungNachbilden` (`{ onboarding: true }`).
 */

async function start(page: Page, rolle: 'USER' | 'ADMIN' | 'GAST' = 'USER') {
  await sitzungNachbilden(page, { leerlaufSek: 900, rolle }, { onboarding: true })
  // Die Startseiten lesen die Terminliste (mit `ab`); ohne Nachbildung zeigten sie den Fehlerzustand statt der Karte.
  await termineNachbilden(page, [], { admin: rolle === 'ADMIN' })
  const push = await pushNachbilden(page)
  await pushGeraetNachbilden(page)
  return push
}

/** Feuert ein synthetisches `beforeinstallprompt` wie Chromium und protokolliert `prompt()`. */
async function installEreignisSenden(page: Page) {
  await page.evaluate(() => {
    const ereignis = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: async () => {
        ;(window as unknown as { __prompt: number }).__prompt = ((window as unknown as { __prompt?: number }).__prompt ?? 0) + 1
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    })
    window.dispatchEvent(ereignis)
  })
}

test.describe('Onboarding', () => {
  test('nach der Anmeldung Schritt 2 (ohne Installationsweg); „Nicht jetzt“ haelt auch nach dem Neuladen', async ({ page }) => {
    const push = await start(page)
    await page.goto('/')
    await expect(page.getByTestId('onboarding-titel')).toHaveText('Benachrichtigungen')
    // Kein Fokusraub beim Erscheinen.
    await expect(page.getByTestId('onboarding-titel')).not.toBeFocused()

    await page.getByTestId('onboarding-nicht-jetzt').click()
    await expect(page.getByTestId('onboarding')).toHaveCount(0)

    const vorher = push.aufrufe.length
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('onboarding')).toHaveCount(0)
    // Nach dem Wegklicken fragt die Karte nichts mehr ab.
    expect(push.aufrufe.slice(vorher).filter((a) => a.pfad === 'schluessel' || a.pfad === 'status')).toEqual([])
  })

  test('mit beforeinstallprompt zuerst die Installation, danach die Benachrichtigungen', async ({ page }) => {
    await start(page)
    await page.goto('/')
    await expect(page.getByTestId('onboarding-titel')).toHaveText('Benachrichtigungen')
    await installEreignisSenden(page)
    await expect(page.getByTestId('onboarding-titel')).toHaveText('App installieren')

    await page.getByTestId('onboarding-installieren').click()
    await expect.poll(() => page.evaluate(() => (window as unknown as { __prompt?: number }).__prompt)).toBe(1)
    await expect(page.getByTestId('onboarding-titel')).toHaveText('Benachrichtigungen')
    await expect(page.getByTestId('onboarding-titel')).toBeFocused()
  })

  test('Einrichten aus der Karte', async ({ page }) => {
    const push = await start(page)
    await page.goto('/')
    await expect
      .poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.active)), {
        timeout: 15_000,
      })
      .toBe(true)
    await page.getByTestId('onboarding-push-einrichten').click()
    await expect(page.getByTestId('onboarding-erfolg')).toBeVisible()
    expect(push.angelegt).toHaveLength(1)
  })

  test('GAST: keine Karte', async ({ page }) => {
    const push = await start(page, 'GAST')
    await page.goto('/')
    await installEreignisSenden(page)
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('onboarding')).toHaveCount(0)
    expect(push.aufrufe).toEqual([])
  })

  test('ADMIN: nur die Installation', async ({ page }) => {
    const push = await start(page, 'ADMIN')
    await page.goto('/admin')
    await installEreignisSenden(page)
    await expect(page.getByTestId('onboarding-titel')).toHaveText('App installieren')
    await page.getByTestId('onboarding-spaeter').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('onboarding')).toHaveCount(0)
    expect(push.aufrufe).toEqual([])
  })
})
