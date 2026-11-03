import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { adminStart } from './hilfen/admin.js'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Dark-Mode und Safe-Area (31.10.2026).
 *
 * **Dark-Mode:** Ohne eigenes dunkles Design dunkelte Chrome auf Android die Seite selbst ab („Dunkles Design für
 * Websites“). Die Symbole sind CSS-Masken in `currentColor`; ihre Hintergrundfarbe wurde dabei dunkel – dunkle Symbole
 * auf dunkler Kopfzeile. Seit die Seite `color-scheme: light dark` meldet und eigene dunkle Tokens hat, rechnet Chrome
 * nicht mehr um. Geprüft wird hier, was der Nutzer sieht: Symbol- und Schriftfarben gegen ihren tatsächlichen
 * Hintergrund. Die Token-Paare selbst prüft `src/styles/kontrast.test.ts`.
 *
 * **Safe-Area:** Auf dem iPhone reicht die Statusleiste (mit Unschärfe) über den gemeldeten Einzug hinaus. Die
 * Kopfzeile hält deshalb zusätzlich bis zu `--abstand-m` Abstand – nur, wo es einen Einzug gibt.
 */

type Rgb = [number, number, number]

function rgb(wert: string): Rgb {
  const [r, g, b] = wert.match(/\d+(\.\d+)?/g)!.map(Number)
  return [r, g, b]
}

function leuchtdichte([r, g, b]: Rgb): number {
  const k = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * k(r) + 0.7152 * k(g) + 0.0722 * k(b)
}

function kontrast(a: Rgb, b: Rgb): number {
  const [hell, dunkel] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x)
  return (hell + 0.05) / (dunkel + 0.05)
}

/**
 * Vordergrund (`color`) und der erste deckende Hintergrund darunter. Ein Masken-Symbol füllt sich selbst mit
 * `currentColor`; sein Hintergrund wird deshalb erst ab dem Elternelement gesucht.
 */
async function farbenVon(element: Locator, symbol: boolean): Promise<{ vorne: Rgb; hinten: Rgb }> {
  const { vorne, hinten } = await element.evaluate((el, istSymbol) => {
    let knoten: Element | null = istSymbol ? el.parentElement : el
    let hintergrund = 'rgb(255, 255, 255)'
    while (knoten) {
      const farbe = getComputedStyle(knoten).backgroundColor
      if (farbe !== 'transparent' && !/,\s*0\)$/.test(farbe)) {
        hintergrund = farbe
        break
      }
      knoten = knoten.parentElement
    }
    return { vorne: getComputedStyle(el).color, hinten: hintergrund }
  }, symbol)
  return { vorne: rgb(vorne), hinten: rgb(hinten) }
}

/** Symbole: Nicht-Text-Kontrast 3:1 (WCAG 1.4.11); Schrift: 4.5:1 (1.4.3). */
async function mindestens(element: Locator, art: 'symbol' | 'text') {
  const minimum = art === 'symbol' ? 3 : 4.5
  const { vorne, hinten } = await farbenVon(element, art === 'symbol')
  expect(kontrast(vorne, hinten), `Kontrast von ${String(vorne)} auf ${String(hinten)}`).toBeGreaterThanOrEqual(minimum)
}

async function spielerStart(page: Page) {
  await sitzungNachbilden(page, { leerlaufSek: 900 })
  await termineNachbilden(page, [terminModell({ terminId: 1, datum: '2099-01-13', uhrzeit: '19:00:00' })])
}

test.describe('Dark-Mode', () => {
  test.use({ colorScheme: 'dark' })

  test('die Seite ist dunkel und Kopfzeilen-Symbole sind sichtbar', async ({ page }) => {
    await spielerStart(page)
    await page.goto('/')
    await expect(page.getByTestId('layout-kopf')).toBeVisible()

    const seite = rgb(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    expect(leuchtdichte(seite), 'Hintergrund im Dark-Mode').toBeLessThan(0.05)

    await mindestens(page.getByTestId('layout-einstellungen').locator('[aria-hidden="true"]').first(), 'symbol')
    await mindestens(page.getByTestId('layout-abmelden').locator('[aria-hidden="true"]').first(), 'symbol')
    await mindestens(page.getByTestId('layout-abmelden'), 'text')
  })

  test('Primärschaltfläche: dunkle Schrift auf heller Fläche', async ({ page }) => {
    await adminStart(page, '/admin/termine')
    const knopf = page.getByRole('button', { name: 'Termin anlegen' })
    await expect(knopf).toBeVisible()
    await mindestens(knopf, 'text')
    await mindestens(knopf.locator('[aria-hidden="true"]').first(), 'symbol')
  })

  test('im hellen Modus bleibt die Seite hell', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await spielerStart(page)
    await page.goto('/')
    await expect(page.getByTestId('layout-kopf')).toBeVisible()
    const seite = rgb(await page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    expect(leuchtdichte(seite)).toBeGreaterThan(0.8)
  })
})

/** Versionsnummer aus `package.json` – dieselbe Quelle, die Vite beim Bau einsetzt. */
const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version

test.describe('Versionsnummer auf der PIN-Seite (03.11.2026)', () => {
  for (const schema of ['light', 'dark'] as const) {
    test(`steht über „Absenden“ und ist lesbar (${schema})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: schema })
      await page.route('**/api/v1/auth/session/lesen', (route) =>
        route.fulfill({ status: 401, json: { code: 'SESSION_UNGUELTIG', detail: 'Keine Sitzung.' } }),
      )
      await page.goto('/pin/pruefen')

      const version = page.getByTestId('pin-version')
      await expect(version).toHaveText(`Version ${VERSION}`)
      await mindestens(version, 'text')

      // Direkt über der Schaltfläche, ohne sie zu überdecken.
      const text = (await version.boundingBox())!
      const knopf = (await page.getByTestId('pin-absenden').boundingBox())!
      expect(text.y + text.height).toBeLessThanOrEqual(knopf.y)
      expect(knopf.y - (text.y + text.height)).toBeLessThan(64)
    })
  }
})

test.describe('Safe-Area oben', () => {
  /**
   * Setzt den Einzug, den sonst `env(safe-area-inset-top)` liefert, und liest den oberen Innenabstand des Rahmens.
   * Der Browser im Test kennt keinen echten Einzug; `--sicher-oben` ist die eine Stelle, an der er in die Tokens kommt.
   */
  async function rahmenOben(page: Page, einzug: number | null): Promise<number> {
    return page.getByTestId('app-layout').evaluate((el, px) => {
      if (px !== null) document.documentElement.style.setProperty('--sicher-oben', `${String(px)}px`)
      return parseFloat(getComputedStyle(el).paddingTop)
    }, einzug)
  }

  test.beforeEach(async ({ page }) => {
    await spielerStart(page)
    await page.goto('/')
    await expect(page.getByTestId('app-layout')).toBeVisible()
  })

  test('ohne Einzug kein zusätzlicher Abstand', async ({ page }) => {
    expect(await rahmenOben(page, null)).toBe(0)
  })

  test('mit Einzug: Einzug plus bis zu 16 px', async ({ page }) => {
    // 47 px: iPhone mit Dynamic Island im Hochformat → 47 + 16.
    expect(await rahmenOben(page, 47)).toBe(63)
    // Kleiner Einzug: höchstens noch einmal so viel.
    expect(await rahmenOben(page, 8)).toBe(16)
  })

  test('installierte App auf iOS: feste 40 px Luft, auch wenn iOS als Einzug 0 meldet', async ({ page }) => {
    // Dritter Anlauf (01.11.2026): Ohne `apple-mobile-web-app-status-bar-style` beginnt die Ansicht unter der
    // Statusleiste, der Einzug ist 0 – die Unschärfe von iOS 26 liegt trotzdem über den obersten ~40pt.
    await page.evaluate(() => document.documentElement.setAttribute('data-ios-app', ''))
    expect(await rahmenOben(page, null)).toBe(40)
    expect(await rahmenOben(page, 47)).toBe(87)
    // Die Kopfzeile liegt darunter: ihr oberer Rand mindestens 40 px unter dem Seitenanfang.
    const kopf = await page.getByTestId('layout-kopf').boundingBox()
    expect(kopf?.y ?? 0).toBeGreaterThanOrEqual(40)
  })

  test('installierte App auf iOS: nur der Bereich unter dem Abstand scrollt, nie die Seite', async ({ page }) => {
    // Rückmeldung vom 01.11.2026 (Abend): iOS 26 zeigte gescrollten Inhalt verschwommen unter der Statusleiste,
    // auch mit Deckband. Deshalb scrollt in der iOS-App nur `layout-verlauf`, dessen Oberkante unter dem Abstand liegt.
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-ios-app', '')
      const hoch = document.createElement('div')
      hoch.style.blockSize = '3000px'
      document.querySelector('main')?.append(hoch)
    })
    const verlauf = page.getByTestId('layout-verlauf')
    await verlauf.evaluate((el) => el.scrollTo(0, 800))

    const lage = await page.evaluate(() => {
      const bereich = document.querySelector('[data-testid="layout-verlauf"]')!
      const wurzel = document.scrollingElement!
      return {
        seiteScrollt: wurzel.scrollHeight > wurzel.clientHeight,
        bereichOben: bereich.getBoundingClientRect().top,
        bereichGescrollt: bereich.scrollTop,
      }
    })
    expect(lage).toEqual({ seiteScrollt: false, bereichOben: 40, bereichGescrollt: 800 })
    // Die Tab-Leiste haftet am oberen Rand des Scrollbereichs, also direkt unter dem Abstand.
    await expect.poll(async () => (await page.getByTestId('tab-leiste').boundingBox())?.y).toBe(40)
    // Der Rahmen steht fest und deckend im Fenster.
    const rahmen = await page.getByTestId('app-layout').evaluate((el) => {
      const s = getComputedStyle(el)
      return { position: s.position, farbe: s.backgroundColor }
    })
    const seite = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
    expect(rahmen).toEqual({ position: 'fixed', farbe: seite })
    // Ohne eigene Scroll-Anzeige (sie stand auf dem iPhone mitten im Bild).
    expect(await verlauf.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none')
  })

  test('Statusleiste der iOS-App: Wurzel und Deckband in der Seitenfarbe, hell wie dunkel', async ({ page }) => {
    // Rückmeldung vom 01.11.2026: Im hellen Modus blieb die Statusleiste schwarz. iOS 26 nimmt ihre Farbe von der
    // Seite (Wurzel oder festes Element oben); beides muss die Seitenfarbe tragen – das echte Band, kein ::before.
    await page.evaluate(() => document.documentElement.setAttribute('data-ios-app', ''))
    for (const schema of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: schema })
      const farben = await page.evaluate(() => {
        const band = document.querySelector('[data-testid="layout-band"]')!
        const s = getComputedStyle(band)
        return {
          seite: getComputedStyle(document.body).backgroundColor,
          wurzel: getComputedStyle(document.documentElement).backgroundColor,
          band: s.backgroundColor,
          lage: `${s.position} ${s.top} ${s.height}`,
        }
      })
      expect(farben.wurzel, schema).toBe(farben.seite)
      expect(farben.band, schema).toBe(farben.seite)
      expect(farben.lage, schema).toBe('fixed 0px 40px')
    }
  })

  test('installierte App auf iOS: die Kopfzeile behält ihre Höhe, die Linie liegt unter den Knöpfen', async ({ page }) => {
    // Rückmeldung vom 01.11.2026: Im Scrollbereich schrumpfte die Kopfzeile auf 44 px, die Linie lief durch die Knöpfe.
    const messen = () =>
      page.evaluate(() => {
        const kopf = document.querySelector('[data-testid="layout-kopf"]')!.getBoundingClientRect()
        const knopf = document.querySelector('[data-testid="layout-abmelden"]')!.getBoundingClientRect()
        return { hoehe: kopf.height, abstandUnten: Math.round(kopf.bottom - knopf.bottom) }
      })
    await expect(page.getByTestId('layout-abmelden')).toBeVisible()
    const browser = await messen()
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-ios-app', '')
      const hoch = document.createElement('div')
      hoch.style.blockSize = '3000px'
      document.querySelector('main')?.append(hoch)
    })
    const app = await messen()
    expect(app).toEqual(browser)
    expect(app.abstandUnten).toBeGreaterThanOrEqual(8)
  })

  test('im Browser scrollt weiter die Seite (kein eigener Scrollbereich)', async ({ page }) => {
    const anzeige = await page.getByTestId('layout-verlauf').evaluate((el) => getComputedStyle(el).display)
    expect(anzeige).toBe('contents')
  })

  test('installierte App auf iOS quer (niedriges Fenster): keine Zusatzluft', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.evaluate(() => document.documentElement.setAttribute('data-ios-app', ''))
    expect(await rahmenOben(page, null)).toBe(0)
  })
})
