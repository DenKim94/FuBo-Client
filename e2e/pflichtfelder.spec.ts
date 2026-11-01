import { expect, test, type Page } from '@playwright/test'
import { adminStart } from './hilfen/admin.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'

/**
 * Pflichtfeld-Kennzeichen „*“ (01.11.2026, Entscheidung des Entwicklers): Stern nur, wo das Formular leer startet und
 * man selbst etwas eintragen muss. Vorbelegte Formulare (Konfiguration, Termin ändern) tragen keinen. Ohne Erklärsatz
 * „* Pflichtfeld“: Er kostete auf kleinen Telefonen die Zeile, die „kein Scrollen“ verlangt (Entscheidung vom selben Tag).
 *
 * Geprüft im echten Browser, weil der Stern erzeugter Inhalt ist (`::after`), den jsdom nicht zeichnet: Er muss zu
 * sehen sein, darf aber nicht in den Namen des Feldes geraten.
 */

/** Alle sichtbaren Sterne: ihr erzeugter Inhalt und der zugängliche Name des zugehörigen Feldes. */
async function sterne(page: Page) {
  return page.locator('.pflichtMarke').evaluateAll((marken) =>
    marken.map((m) => ({
      text: (m.textContent ?? '').trim(),
      inhalt: getComputedStyle(m, '::after').content,
    })),
  )
}

async function pruefeMitSternen(page: Page, erwartet: string[]) {
  const gefunden = await sterne(page)
  expect(gefunden.map((s) => s.text)).toEqual(erwartet)
  for (const stern of gefunden) expect(stern.inhalt, stern.text).toContain('*')
}

async function pruefeOhneSterne(page: Page) {
  expect(await sterne(page)).toEqual([])
  await expect(page.locator('[aria-required="true"]')).toHaveCount(0)
}

test('PIN-Eingabe: die PIN ist Pflicht, der Name des Feldes bleibt ohne Stern', async ({ page }) => {
  await sitzungNachbilden(page, { angemeldet: false })
  await page.goto('/pin/pruefen')
  await expect(page.getByTestId('pin-feld')).toBeVisible()

  await pruefeMitSternen(page, ['Eingabe der zentralen PIN'])
  await expect(page.getByLabel('Eingabe der zentralen PIN', { exact: true })).toHaveAttribute('aria-required', 'true')
})

test('Neuer Termin: Einzeltermin Datum und Uhrzeit, Serie fünf Angaben; der Ort nie', async ({ page }) => {
  await adminStart(page, '/admin/termine/neu')
  await expect(page.getByTestId('termin-datum')).toBeVisible()
  await pruefeMitSternen(page, ['Datum', 'Uhrzeit'])

  await page.getByTestId('admin-art-serie').check()
  await expect(page.getByTestId('serie-titel')).toBeVisible()
  await pruefeMitSternen(page, ['Titel', 'Wochentag', 'Startdatum', 'Enddatum', 'Uhrzeit'])
  await expect(page.getByTestId('serie-ort')).not.toHaveAttribute('aria-required')
  await expect(page.getByRole('radiogroup', { name: 'Wochentag' })).toHaveAttribute('aria-required', 'true')
})

test('vorbelegte Formulare: Konfiguration und Termin ändern ohne Stern', async ({ page }) => {
  await adminStart(page, '/admin/konfiguration')
  await expect(page.getByRole('heading', { level: 1, name: 'Konfiguration' })).toBeVisible()
  await pruefeOhneSterne(page)

  await page.goto('/admin/termine/1')
  await expect(page.getByTestId('termin-datum')).toBeVisible()
  await pruefeOhneSterne(page)
})

test('Profil anlegen: nur der Name (die Skills sind vorbelegt)', async ({ page }) => {
  await adminStart(page, '/admin/profile/neu')
  await expect(page.getByTestId('admin-profil-name')).toBeVisible()
  await pruefeMitSternen(page, ['Name'])
})
