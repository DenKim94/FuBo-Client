import { expect, test, type Page } from '@playwright/test'
import { adminNachbilden } from './hilfen/admin.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft die Zugangs-Verwaltung des Admins im echten Browser (C7, Stufe 1):
 * zentrale PIN und Anmeldename.
 *
 * Ohne Server (`hilfen/admin.ts`). Geprueft wird, was die Unit-Tests nicht sehen: der
 * Weg ueber mehrere Ansichten mit echtem Router und Verlaufszustand, der Dialog mit
 * `showModal`, Fokus, Tastaturtyp und der Platz auf dem Telefon.
 */

/** Hoehe, um die die Seite ueber das Fenster hinausragt. */
async function ueberhang(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight)
}

test.describe('Zentrale PIN', () => {
  test('nennt die Folgen, sendet erst nach der Bestaetigung und fuehrt zur PIN-Eingabe', async ({ page }) => {
    const welt = await adminNachbilden(page)
    await page.goto('/admin/pin')

    await expect(page.getByTestId('admin-pin-absenden')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('admin-pin-feld').fill('4711')
    await page.getByTestId('admin-pin-absenden').click()

    // Der Dialog nennt die Folgen; gesendet wurde noch nichts.
    await expect(page.getByTestId('admin-pin-dialog')).toBeVisible()
    await expect(page.getByTestId('admin-pin-dialog')).toContainText('Alle Angemeldeten werden sofort abgemeldet')
    await expect(page.getByTestId('admin-pin-dialog-abbrechen')).toBeFocused()
    expect(welt.neuePins).toHaveLength(0)

    await page.getByTestId('admin-pin-dialog-bestaetigen').click()

    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    await expect(page.getByTestId('pin-hinweis')).toHaveText(
      'Die zentrale PIN wurde geändert. Bitte melde dich mit der neuen PIN an.',
    )
    expect(welt.neuePins).toEqual(['4711'])
    expect(welt.sitzung.angemeldet).toBe(false)
  })

  test('Abbrechen schliesst den Dialog, ohne etwas zu senden; Escape ebenso', async ({ page }) => {
    const welt = await adminNachbilden(page)
    await page.goto('/admin/pin')
    await page.getByTestId('admin-pin-feld').fill('4711')

    await page.getByTestId('admin-pin-absenden').click()
    await page.getByTestId('admin-pin-dialog-abbrechen').click()
    await expect(page.getByTestId('admin-pin-dialog')).toBeHidden()

    await page.getByTestId('admin-pin-absenden').click()
    await expect(page.getByTestId('admin-pin-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('admin-pin-dialog')).toBeHidden()

    await expect(page.getByTestId('admin-pin-feld')).toHaveValue('4711')
    expect(welt.neuePins).toHaveLength(0)
    expect(welt.sitzung.angemeldet).toBe(true)
  })

  test('ein Serverfehler steht im Dialog, der offen bleibt; der zweite Tipp wiederholt', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.pinAntwort = 'ausfall'
    await page.goto('/admin/pin')
    await page.getByTestId('admin-pin-feld').fill('4711')
    await page.getByTestId('admin-pin-absenden').click()

    await page.getByTestId('admin-pin-dialog-bestaetigen').click()
    await expect(page.getByTestId('admin-pin-dialog-fehler')).toHaveText('Es ist ein interner Fehler aufgetreten.')
    await expect(page.getByTestId('admin-pin-dialog')).toBeVisible()
    expect(welt.sitzung.angemeldet).toBe(true)

    welt.pinAntwort = 'erfolg'
    await page.getByTestId('admin-pin-dialog-bestaetigen').click()
    await expect(page).toHaveURL(/\/pin\/pruefen$/)
    expect(welt.neuePins).toEqual(['4711', '4711'])
  })

  test('ein Feldfehler schliesst den Dialog und steht am Feld', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.pinAntwort = 'eingabe-ungueltig'
    await page.goto('/admin/pin')
    await page.getByTestId('admin-pin-feld').fill('4711')
    await page.getByTestId('admin-pin-absenden').click()

    await page.getByTestId('admin-pin-dialog-bestaetigen').click()

    await expect(page.getByTestId('admin-pin-feld-fehler')).toHaveText('Die PIN muss aus genau vier Ziffern bestehen.')
    await expect(page.getByTestId('admin-pin-dialog')).toBeHidden()
    await expect(page.getByTestId('admin-pin-feld')).toBeFocused()
  })

  test('zeigt ein Zifferntastenfeld und hat auf dem Telefon keinen Ueberhang', async ({ page }) => {
    await adminNachbilden(page)
    await page.goto('/admin/pin')

    await expect(page.getByTestId('admin-pin-feld')).toHaveAttribute('inputmode', 'numeric')
    await expect(page.getByTestId('admin-pin-absenden')).toBeVisible()
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)
  })
})

test.describe('Anmeldename aendern', () => {
  test('fordert die PIN an, bestaetigt sie und kehrt mit Hinweis zur Administration zurueck', async ({ page }) => {
    const welt = await adminNachbilden(page)
    await termineNachbilden(page, [terminModell({ terminId: 41 })])
    await page.goto('/admin')
    await page.getByTestId('admin-link-name').click()
    await expect(page).toHaveURL(/\/admin\/name\/aendern$/)
    await expect(page.getByTestId('admin-name-neu')).toBeFocused()

    await page.getByTestId('admin-name-neu').fill('  neuer-admin ')
    await page.getByTestId('admin-name-anfordern').click()

    await expect(page).toHaveURL(/\/admin\/name\/bestaetigen$/)
    await expect(page.getByTestId('admin-name-hinweis')).toHaveText(
      'Die PIN wurde an deine hinterlegte E-Mail-Adresse gesendet.',
    )
    await expect(page.getByTestId('admin-name-angefordert')).toContainText('neuer-admin')
    await expect(page.getByTestId('admin-name-pin-feld')).toBeFocused()
    expect(welt.angeforderteNamen).toEqual(['neuer-admin'])

    await page.getByTestId('admin-name-pin-feld').fill('12345')
    await page.getByTestId('admin-name-bestaetigen').click()

    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('admin-dashboard-hinweis')).toHaveText(
      'Anmeldename geändert. Er gilt ab der nächsten Anmeldung.',
    )
    expect(welt.bestaetigungsPins).toEqual(['12345'])
    // Die Sitzung bleibt: Der Name gilt erst ab der naechsten Anmeldung.
    expect(welt.sitzung.angemeldet).toBe(true)
    expect(welt.sitzung.beendet).toBe(0)
  })

  test('ein belegter Name steht am Feld und es geht nicht weiter', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.nameAntwort = 'belegt'
    await page.goto('/admin/name/aendern')
    await page.getByTestId('admin-name-neu').fill('vergeben')

    await page.getByTestId('admin-name-anfordern').click()

    await expect(page.getByTestId('admin-name-neu-fehler')).toHaveText('Dieser Name ist bereits vergeben.')
    await expect(page).toHaveURL(/\/admin\/name\/aendern$/)
    await expect(page.getByTestId('admin-name-neu')).toBeFocused()
  })

  test('nach einem gescheiterten Versand heisst die Schaltflaeche „Erneut versuchen“', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.nameAntwort = 'versand-fehlgeschlagen'
    await page.goto('/admin/name/aendern')
    await page.getByTestId('admin-name-neu').fill('neuer-admin')
    await page.getByTestId('admin-name-anfordern').click()

    await expect(page.getByTestId('admin-name-fehler')).toContainText('Die E-Mail konnte nicht gesendet werden.')
    await expect(page.getByTestId('admin-name-anfordern')).toHaveText('Erneut versuchen')

    welt.nameAntwort = 'erfolg'
    await page.getByTestId('admin-name-anfordern').click()
    await expect(page).toHaveURL(/\/admin\/name\/bestaetigen$/)
    expect(welt.angeforderteNamen).toEqual(['neuer-admin', 'neuer-admin'])
  })

  test('eine falsche PIN steht am Feld, wird geleert und beendet die Sitzung nicht', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.bestaetigungen = ['pin-falsch']
    await page.goto('/admin/name/bestaetigen')
    await page.getByTestId('admin-name-pin-feld').fill('11111')
    await page.getByTestId('admin-name-bestaetigen').click()

    await expect(page.getByTestId('admin-name-pin-feld-fehler')).toHaveText('Die PIN ist nicht korrekt. Noch 4 Versuche.')
    await expect(page.getByTestId('admin-name-pin-feld')).toHaveValue('')
    await expect(page.getByTestId('admin-name-pin-feld')).toBeFocused()
    expect(welt.sitzung.angemeldet).toBe(true)
  })

  test('eine abgelaufene Anforderung bietet „Neu anfordern“ an', async ({ page }) => {
    const welt = await adminNachbilden(page)
    welt.bestaetigungen = ['ungueltig']
    await page.goto('/admin/name/bestaetigen')
    await page.getByTestId('admin-name-pin-feld').fill('12345')
    await page.getByTestId('admin-name-bestaetigen').click()

    await expect(page.getByTestId('admin-name-bestaetigen-fehler')).toContainText('abgelaufen')
    await page.getByTestId('admin-name-neu-anfordern').click()
    await expect(page).toHaveURL(/\/admin\/name\/aendern$/)
  })

  test('der Link „Ich habe bereits eine PIN“ fuehrt ohne Anforderung zu Schritt 2', async ({ page }) => {
    const welt = await adminNachbilden(page)
    await page.goto('/admin/name/aendern')

    await page.getByTestId('admin-name-pin-vorhanden-link').click()

    await expect(page).toHaveURL(/\/admin\/name\/bestaetigen$/)
    await expect(page.getByTestId('admin-name-angefordert')).toBeHidden()
    expect(welt.angeforderteNamen).toHaveLength(0)
  })

  test('beide Schritte haben auf dem Telefon keinen Ueberhang', async ({ page }) => {
    await adminNachbilden(page)
    await page.goto('/admin/name/aendern')
    await page.getByTestId('admin-name-neu').fill('neuer-admin')
    await expect(page.getByTestId('admin-name-anfordern')).toBeVisible()
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)

    await page.getByTestId('admin-name-anfordern').click()
    await expect(page.getByTestId('admin-name-bestaetigen')).toBeVisible()
    expect(await ueberhang(page)).toBeLessThanOrEqual(0)
  })
})
