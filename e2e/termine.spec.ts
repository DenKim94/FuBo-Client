import { expect, test } from '@playwright/test'
import { sitzungNachbilden } from './hilfen/sitzung.js'
import { EIGENER_NAME, inMinuten, terminModell, termineNachbilden } from './hilfen/termine.js'

/**
 * Prueft Dashboard und Termin-Ansicht (C5, Stufe 1) auf allen Geraeteprojekten.
 *
 * Ohne Server: Sitzung und Termine sind nachgebildet. Die Termine liegen im Jahr
 * 2099 und beginnen damit nie; wo der Beginn zaehlt, steht er wenige Minuten
 * vor der Uhr des Browsers, und `page.clock` rueckt die Zeit vor.
 */

test.describe('Dashboard: naechster Termin', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('zeigt den naechsten Termin, sagt zu und haelt den Fokus auf der Absage', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/')

    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Noch nicht gemeldet.')
    await expect(page.getByTestId('termin-balken-text')).toHaveText('8 Zusagen – Mindestanzahl von 6 erreicht')
    // Ohne Warteschlange keine Platzzahl; Karte, Status und Balken stehen in einem Rahmen.
    await expect(page.getByTestId('termin-wartesatz')).toHaveCount(0)
    await expect(page.getByTestId('termin-kopf')).toHaveCSS('border-top-width', '1px')

    await page.getByTestId('rueckmeldung-zusagen').click()

    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Du hast zugesagt.')
    await expect(page.getByTestId('termin-balken-text')).toHaveText('9 Zusagen – Mindestanzahl von 6 erreicht')
    // Die Schaltflaeche, die der Fokus hielt, ist entfallen; er bleibt in der Leiste.
    await expect(page.getByTestId('rueckmeldung-absagen')).toBeFocused()
    expect(welt.rueckmeldungen).toEqual([{ terminId: 102, zusage: true, kopf: undefined }])

    // Die eingeklappte Liste zeigt nach dem Aufklappen den eigenen Eintrag.
    await page.getByTestId('teilnehmerliste-summary').click()
    await expect(page.getByTestId('teilnehmerliste-eintrag-9')).toContainText(`${EIGENER_NAME} (du)`)
  })

  test('sagt ab und danach doch wieder zu', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 102, eigene: true, zusagen: [{ name: EIGENER_NAME, gast: false }] })])
    await page.goto('/')
    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Du hast zugesagt.')

    await page.getByTestId('rueckmeldung-absagen').click()
    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Du hast abgesagt.')
    // `false` ist nicht `null`: Die Absage hat einen eigenen Text und die Aktion „Doch zusagen“.
    await expect(page.getByTestId('rueckmeldung-zusagen')).toHaveText('Doch zusagen')
    await expect(page.getByTestId('rueckmeldung-zusagen')).toBeFocused()

    await page.getByTestId('rueckmeldung-zusagen').click()
    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Du hast zugesagt.')
  })

  test('stellt Zusagen ueber der Hoechstzahl auf die Warteschlange', async ({ page }) => {
    await termineNachbilden(page, [
      terminModell({
        terminId: 102,
        min: 1,
        max: 2,
        zusagen: [
          { name: 'Beispielspieler 11', gast: false },
          { name: 'Beispielspieler 12', gast: false },
          { name: 'Beispielspieler 13', gast: false },
        ],
      }),
    ])
    await page.goto('/termine/102')

    await expect(page.getByTestId('teilnehmerliste-eintrag-2')).not.toContainText('wartet')
    await expect(page.getByTestId('teilnehmerliste-eintrag-3')).toContainText('wartet · Platz 1')
    await expect(page.getByTestId('termin-wartesatz')).toHaveText(
      'Maximale Teilnehmerzahl von 2 erreicht, 1 auf der Warteschlange.',
    )
  })

  test('weist auf einen abgesagten Termin davor hin und zeigt darunter den naechsten', async ({ page }) => {
    await termineNachbilden(page, [
      terminModell({ terminId: 101, datum: '2099-01-06', status: 'ABGESAGT', zusagen: [] }),
      terminModell({ terminId: 102, datum: '2099-01-13' }),
    ])
    await page.goto('/')

    await expect(page.getByTestId('dashboard-abgesagt-101')).toContainText('fällt aus')
    await expect(page.getByTestId('termin-karte')).toContainText('13. Januar')
    await expect(page.getByTestId('termin-link-101')).toHaveCount(0)
  })

  test('zeigt ohne Termin den Leerzustand', async ({ page }) => {
    await termineNachbilden(page, [])
    await page.goto('/')
    await expect(page.getByTestId('dashboard-leer')).toContainText('Kein Termin geplant')
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
  })

  test('zeigt weitere Termine als Links auf die Termin-Ansicht', async ({ page }) => {
    await termineNachbilden(page, [
      terminModell({ terminId: 102, datum: '2099-01-13' }),
      terminModell({ terminId: 103, datum: '2099-01-20' }),
    ])
    await page.goto('/')
    await page.getByTestId('termin-link-103').click()
    await expect(page).toHaveURL(/\/termine\/103$/)
    await expect(page.getByTestId('termin-karte')).toContainText('20. Januar')
  })
})

test.describe('Beginn und Server-Entscheidung', () => {
  test('nimmt bei Beginn die Leiste weg und nennt den Grund', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const beginn = inMinuten(3)
    await termineNachbilden(page, [terminModell({ terminId: 102, ...beginn })])
    await page.clock.install()
    await page.goto('/')
    await expect(page.getByTestId('aktionsleiste')).toBeVisible()
    await expect(page.getByTestId('termin-begonnen')).toHaveCount(0)

    // Die Uhr springt ueber den Beginn; die Ansicht reagiert ohne Neuladen.
    await page.clock.fastForward(5 * 60_000)

    await expect(page.getByTestId('termin-begonnen')).toContainText('Rückmeldungen sind nicht mehr möglich.')
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
    await expect(page.getByTestId('teilnehmerliste')).toBeVisible()
  })

  test('zeigt bei 409 die Fehlermeldung und liest den Stand neu', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/')
    await expect(page.getByTestId('termin-balken-text')).toHaveText('8 Zusagen – Mindestanzahl von 6 erreicht')

    // Der Server hat den Beginn schon gesehen, die Uhr des Geraets noch nicht; inzwischen hat jemand zugesagt.
    welt.konfliktBeiRueckmeldung = 'begonnen'
    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 20', gast: false })
    await page.getByTestId('rueckmeldung-zusagen').click()

    await expect(page.getByTestId('rueckmeldung-fehler')).toContainText('Der Termin ist geschlossen.')
    // Nach dem Fehler wird neu gelesen: Der fremde Stand erscheint, ohne dass jemand neu laedt.
    await expect(page.getByTestId('termin-balken-text')).toHaveText('9 Zusagen – Mindestanzahl von 6 erreicht')
    // Der eigene Stand bleibt unveraendert: nicht gemeldet, die Aktion steht wieder bereit.
    await expect(page.getByTestId('termin-zusagestatus')).toContainText('Noch nicht gemeldet.')
    await expect(page.getByTestId('rueckmeldung-zusagen')).toBeEnabled()
  })

  test('zeigt nach einem 409 wegen Absage den Hinweis und keinen Termin mehr', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/')
    await expect(page.getByTestId('rueckmeldung-zusagen')).toBeVisible()

    // Zwischen Anzeige und Tipp sagt der Admin den Termin ab.
    welt.konfliktBeiRueckmeldung = 'abgesagt'
    await page.getByTestId('rueckmeldung-zusagen').click()

    // Neu gelesen: Der Termin ist abgesagt, das Dashboard hat keinen naechsten und weist darauf hin.
    await expect(page.getByTestId('dashboard-abgesagt-102')).toContainText('fällt aus')
    await expect(page.getByTestId('dashboard-leer')).toBeVisible()
    await expect(page.getByTestId('aktionsleiste')).toHaveCount(0)
  })
})

test.describe('Admin', () => {
  test('wird von / und den Bereichen nach /admin umgeleitet', async ({ page }) => {
    await sitzungNachbilden(page, { rolle: 'ADMIN', leerlaufSek: 900 })
    await termineNachbilden(page, [terminModell({ terminId: 102 })])

    await page.goto('/')
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)

    await page.goto('/teams')
    await expect(page).toHaveURL(/\/admin$/)
  })
})

test.describe('Aktualisierung im Hintergrund', () => {
  test('zeigt eine fremde Zusage nach dem naechsten Abruf, alle Abrufe ohne Sitzungsverlaengerung', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.clock.install()
    await page.goto('/')
    await expect(page.getByTestId('termin-balken-text')).toHaveText('8 Zusagen – Mindestanzahl von 6 erreicht')

    welt.modelle[0].zusagen.push({ name: 'Beispielspieler 20', gast: false })
    welt.modelle[0].teilnehmerVersion += 1
    await page.clock.runFor(21_000)

    await expect(page.getByTestId('termin-balken-text')).toHaveText('9 Zusagen – Mindestanzahl von 6 erreicht')
    // Jeder Lesevorgang im Hintergrund traegt den Kopf; sonst bliebe die Sitzung durch die offene Ansicht ewig offen.
    expect(welt.listenabrufe.length).toBeGreaterThan(1)
    expect(welt.listenabrufe.every((k) => k === 'true')).toBe(true)
    expect(welt.detailabrufe.every((k) => k === 'true')).toBe(true)
  })
})

test.describe('Termin-Ansicht', () => {
  test.beforeEach(async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
  })

  test('oeffnet den Termin per Direktaufruf mit offener Liste und ohne Tab-Leiste', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/termine/102')

    await expect(page.getByTestId('termin-detail')).toBeVisible()
    await expect(page.getByTestId('teilnehmerliste')).toHaveAttribute('open', '')
    await expect(page.getByTestId('tab-leiste')).toHaveCount(0)
    await expect(page.getByTestId('termin-teams-link')).toBeVisible()
  })

  test('zeigt bei einer ungueltigen Adresse „nicht gefunden“ ohne Abruf', async ({ page }) => {
    const welt = await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/termine/abc')

    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    expect(welt.detailabrufe).toHaveLength(0)
  })

  test('zeigt bei einem unbekannten Termin den Leerzustand mit Rueckweg', async ({ page }) => {
    await termineNachbilden(page, [terminModell({ terminId: 102 })])
    await page.goto('/termine/999')

    await expect(page.getByTestId('termin-nicht-gefunden')).toBeVisible()
    await page.getByTestId('termin-nicht-gefunden-zurueck').click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByTestId('termin-karte')).toBeVisible()
  })
})

test.describe('Layout bei 360 x 780', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('haelt die Aktionsleiste im Sichtfeld, scrollt nicht waagerecht und erfuellt die Tap-Ziele', async ({ page }) => {
    await sitzungNachbilden(page, { leerlaufSek: 900 })
    await termineNachbilden(page, [
      terminModell({ terminId: 102, datum: '2099-01-13' }),
      terminModell({ terminId: 103, datum: '2099-01-20', ort: 'Beispielhalle mit einem sehr langen Ortsnamen' }),
      terminModell({ terminId: 104, datum: '2099-01-27' }),
    ])
    await page.goto('/')
    await expect(page.getByTestId('rueckmeldung-zusagen')).toBeVisible()

    const leiste = await page.getByTestId('aktionsleiste').boundingBox()
    expect(leiste).not.toBeNull()
    // Unterkante im Sichtfeld: Die Leiste haftet unten, auch wenn der Inhalt laenger ist.
    expect(leiste!.y + leiste!.height).toBeLessThanOrEqual(780 + 0.5)

    const breiten = await page.evaluate(() => ({
      inhalt: document.documentElement.scrollWidth,
      sicht: document.documentElement.clientWidth,
    }))
    expect(breiten.inhalt).toBeLessThanOrEqual(breiten.sicht)

    const primaer = await page.getByTestId('rueckmeldung-zusagen').boundingBox()
    expect(primaer!.height).toBeGreaterThanOrEqual(63.5)

    for (const id of ['termin-link-103', 'termin-link-104', 'teilnehmerliste-summary']) {
      const box = await page.getByTestId(id).boundingBox()
      expect(box!.height, id).toBeGreaterThanOrEqual(43.5)
    }
  })
})
