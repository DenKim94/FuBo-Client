import { expect, test, type Page } from '@playwright/test'
import {
  adminNachbilden,
  e2eProfil,
  konfigurationNachbilden,
  terminverwaltungNachbilden,
  ueberhangHorizontal,
} from './hilfen/admin.js'
import { einteilungAus, terminModell, termineNachbilden, type TerminModell } from './hilfen/termine.js'

/**
 * Prueft in einer Schleife ueber alle Admin-Seiten (C7 11.2, C8 11.2), dass bei 360 px nichts seitlich scrollt, dass die
 * Tap-Ziele mindestens 44 px hoch sind und dass die haftende Aktionsleiste beim Durchtabben kein fokussiertes Element
 * verdeckt (WCAG 2.4.11).
 *
 * Die Breite ist fest 360 px, die Hoehe 780 und 640 px (kurze Fenster, Tastatur): Sie gilt in jedem Geraeteprojekt. Ohne
 * Server: Sitzung (Admin), Profile, Termine, Konfiguration und Gastplaetze sind nachgebildet – die Seiten zeigen also
 * ihren echten Inhalt statt eines Fehlerzustands. Termin 1 ist geplant (mit Gast, Hallenmodus an), Termin 2 abgesagt,
 * Termin 3 abgeschlossen mit Ergebnis, Termin 4 geplant mit abgelaufener Hallenfrist.
 */

const PFADE = [
  '/admin',
  '/admin/pin',
  '/admin/name/aendern',
  '/admin/name/bestaetigen',
  '/admin/passwort/aendern',
  '/admin/profile',
  '/admin/profile/neu',
  '/admin/profile/1',
  '/admin/profile/1/bearbeiten',
  '/admin/profile/2',
  '/admin/profile/99',
  '/admin/termine',
  '/admin/termine/neu',
  '/admin/termine/1',
  '/admin/termine/2',
  '/admin/termine/3',
  '/admin/termine/4',
  '/admin/gaeste',
  '/admin/konfiguration',
  '/admin/teams',
]

const HOEHEN = [780, 640]

function abgeschlossen(): TerminModell {
  const modell = terminModell({
    terminId: 3,
    datum: '2099-01-27',
    status: 'ABGESCHLOSSEN',
    ergebnis: {
      sieger: 'A',
      deutlich: true,
      erfasstVon: 'Beispielspieler 11',
      erfasstAm: '2099-01-27T21:00:00Z',
      korrigiertAm: '2099-01-28T09:00:00Z',
      version: 2,
    },
  })
  modell.teams = einteilungAus(modell)
  return modell
}

async function welt(page: Page) {
  const admin = await adminNachbilden(page)
  admin.profile.splice(admin.profile.length - 1, 0, e2eProfil({ spielerId: 4, name: 'Beispielspieler 04', skills: { ANGRIFF: 4 } }))
  const termine = await termineNachbilden(page, [
    terminModell({ terminId: 1, datum: '2099-01-13', uhrzeit: '19:00:00' }),
    terminModell({ terminId: 2, datum: '2099-01-20', uhrzeit: '19:00:00', zusagen: [], status: 'ABGESAGT' }),
    abgeschlossen(),
    terminModell({ terminId: 4, datum: '2099-02-03', halleAbsageMoeglichBis: '2020-01-01T10:00:00' }),
  ])
  await terminverwaltungNachbilden(page, termine)
  await konfigurationNachbilden(page, termine, {
    admin,
    konfiguration: { hallenModusAktiv: true, halleEmail: 'halle@beispiel.example', minTeilnehmer: 2, maxTeilnehmer: 12 },
  })
}

test.describe('Layout der Admin-Seiten bei 360 Pixel Breite', () => {
  for (const hoehe of HOEHEN) {
    test(`keine Seite scrollt seitlich, Schaltflaechen sind mindestens 44 px hoch (Hoehe ${String(hoehe)})`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: hoehe })
      await welt(page)

      for (const pfad of PFADE) {
        await page.goto(pfad)
        // Die Seite hat gerendert, wenn der Hauptbereich einen Inhalt hat (nicht nur den Startlader).
        await expect(page.locator('main')).not.toBeEmpty()
        await page.waitForLoadState('networkidle')
        expect(await ueberhangHorizontal(page), pfad).toBeLessThanOrEqual(0)

        // Das Tap-Ziel eines Haken oder einer Auswahl ist die umgebende Beschriftung, nicht das kleine Kontrollkaestchen.
        const zuNiedrig = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main button, main a[href], main input[type="checkbox"], main input[type="radio"]')]
            .map((element) => ({ element, ziel: element instanceof HTMLInputElement ? (element.closest('label') ?? element) : element }))
            .filter(({ ziel }) => {
              const rect = ziel.getBoundingClientRect()
              return rect.width > 0 && rect.height > 0 && getComputedStyle(ziel).visibility !== 'hidden' && rect.height < 43.5
            })
            .map(({ element }) => element.getAttribute('data-testid') ?? element.tagName.toLowerCase()),
        )
        // Fliesstext-Links (Zeilenhoehe) zaehlen nicht; benannte Bedienelemente schon.
        expect(zuNiedrig.filter((id) => id.startsWith('admin-') && !id.endsWith('-link')), pfad).toEqual([])
      }
    })
  }

  test('die haftende Aktionsleiste verdeckt beim Durchtabben kein fokussiertes Element (Hoehe 640)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 })
    await welt(page)

    for (const pfad of ['/admin/teams', '/admin/konfiguration', '/admin/profile/neu']) {
      await page.goto(pfad)
      await expect(page.locator('main')).not.toBeEmpty()
      await page.waitForLoadState('networkidle')
      if (pfad === '/admin/teams') {
        for (let i = 0; i < 4; i += 1) await page.getByTestId('admin-teams-gast-hinzufuegen').click()
      }
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        ;(document.activeElement as HTMLElement | null)?.blur()
      })

      for (let schritt = 0; schritt < 60; schritt += 1) {
        await page.keyboard.press('Tab')
        const verdeckt = await page.evaluate(() => {
          const element = document.activeElement as HTMLElement | null
          const leiste = document.querySelector<HTMLElement>('[data-testid="aktionsleiste"]')
          if (!element || element === document.body || !leiste || leiste.contains(element)) return null
          const rect = element.getBoundingClientRect()
          const balken = leiste.getBoundingClientRect()
          // Mindestens der obere Teil (44 px) liegt ueber der Leiste: Ein hohes Textfeld scrollt der Browser nur bis zur
          // Schreibmarke in der ersten Zeile, sein unteres Ende darf darunter ragen (WCAG 2.4.11 verlangt: nicht ganz verdeckt).
          const oben = Math.min(rect.bottom, rect.top + 44)
          const verdeckt = oben > balken.top && rect.top < balken.bottom
          return verdeckt ? (element.getAttribute('data-testid') ?? element.tagName) : null
        })
        expect(verdeckt, `${pfad}, Tab ${String(schritt + 1)}`).toBeNull()
      }
    }
  })
})
