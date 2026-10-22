import type { Page } from '@playwright/test'
import { einteilungAus, problem, type Termine } from './termine.js'

/**
 * Nachbildung der Teamgenerierung fuer die E2E-Tests (ohne Server), C5 Stufe 2.
 *
 * Erweitert die Termin-Nachbildung (`hilfen/termine.ts`) um `POST /teams/generieren`
 * und arbeitet auf demselben Zustand: Ein Lauf setzt `teams` des Terminmodells, damit
 * die naechste Einzelansicht die Einteilung zeigt, und merkt sich die
 * `teilnehmerVersion` dazu – aendert sich die Liste spaeter, ist die Einteilung
 * `veraltet`, wie am echten Server. Das Kontingent gilt je `teilnehmerVersion`.
 *
 * Pruefreihenfolge wie am Server: Termin, Zusage (`403 KEINE_ZUSAGE`, ausser Admin; seit 22.10.2026), Status,
 * Beginn, Mindestzahl, Kontingent. Das Kontingent gilt je Kontingentstand (`kontingentVersion`, sonst
 * `teilnehmerVersion`).
 *
 * @param page Die Seite des Tests.
 * @param welt Der Zustand aus `termineNachbilden`.
 */
export async function teamsNachbilden(page: Page, welt: Termine): Promise<void> {
  await page.route(
    (url) => url.pathname === '/api/v1/teams/generieren',
    (route) => {
      const { terminId } = route.request().postDataJSON() as { terminId: number }
      welt.generierungen.push({ terminId, kopf: route.request().headers()['x-fubo-kein-refresh'] })
      const m = welt.modelle.find((t) => t.terminId === terminId)
      if (!m) return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (m.eigene !== true && !m.adminSitzung) {
        return problem(route, 403, 'KEINE_ZUSAGE', 'Teams generieren darf nur, wer für diesen Termin zugesagt hat.')
      }
      if (m.status !== 'GEPLANT') return problem(route, 409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen.')
      const beginn = new Date(`${m.datum}T${m.uhrzeit}`).getTime()
      if (beginn <= Date.now()) {
        return problem(route, 409, 'TEAMS_FIXIERT', 'Die Einteilung steht fest, der Termin hat begonnen.')
      }
      if (m.zusagen.length < m.min) {
        return problem(
          route,
          409,
          'ZU_WENIG_TEILNEHMER',
          `Es braucht mindestens ${String(m.min)} Zusagen, aktuell ${String(m.zusagen.length)}.`,
        )
      }
      const stand = m.kontingentVersion ?? m.teilnehmerVersion
      const verbraucht = m.laeufe[stand] ?? 0
      if (verbraucht >= m.kontingent) {
        return problem(route, 409, 'KONTINGENT_ERSCHOEPFT', 'Das Kontingent für diese Teilnehmerliste ist aufgebraucht.')
      }
      m.laeufe[stand] = verbraucht + 1
      m.teams = einteilungAus(m)
      m.teamsVersion = m.teilnehmerVersion
      return route.fulfill({ status: 201, json: { ...m.teams, veraltet: false } })
    },
  )
}
