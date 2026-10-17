import type { Page } from '@playwright/test'
import { EIGENER_NAME, problem, type Termine } from './termine.js'

/** Was die Nachbildung gesehen hat und wie sie sich verhaelt (Bilanz aenderbar vor dem Lesen der Seite). */
export type Ergebnisse = {
  /** Eingegangene Ergebnisse samt Kopf (soll `undefined` sein: Der Eintrag ist eine Bedienung). */
  erfassungen: { terminId: number; sieger: string; deutlich: boolean; kopf: string | undefined }[]
  /** `X-FuBo-Kein-Refresh` je Abruf der Bilanz. */
  bilanzabrufe: (string | undefined)[]
  /** Der Stand der Bilanz; aenderbar, bevor die Seite sie liest. */
  bilanz: { siege: number; niederlagen: number; unentschieden: number }
}

/**
 * Nachbildung von Ergebnis und Bilanz fuer die E2E-Tests (ohne Server), C5 Stufe 3.
 *
 * Erweitert die Termin-Nachbildung (`hilfen/termine.ts`) um `POST /ergebnis/erfassen` und
 * `GET /bilanz/lesen` und arbeitet auf demselben Zustand: Ein Eintrag setzt `ergebnis` des
 * Terminmodells, damit die naechste Einzelansicht es zeigt, und zaehlt in der Bilanz, wenn
 * die eigene Person in der Einteilung steht (Gaeste fuehren keine Bilanz).
 *
 * Pruefreihenfolge wie am Server: Termin, Status, Einteilung, vorhandenes Ergebnis,
 * Eingabe (`deutlich` bei `U` ist unzulaessig).
 *
 * @param page Die Seite des Tests.
 * @param welt Der Zustand aus `termineNachbilden`.
 */
export async function ergebnisseNachbilden(page: Page, welt: Termine): Promise<Ergebnisse> {
  const ergebnisse: Ergebnisse = {
    erfassungen: [],
    bilanzabrufe: [],
    bilanz: { siege: 0, niederlagen: 0, unentschieden: 0 },
  }

  await page.route(
    (url) => url.pathname === '/api/v1/ergebnis/erfassen',
    (route) => {
      const { terminId, sieger, deutlich } = route.request().postDataJSON() as {
        terminId: number
        sieger: 'A' | 'B' | 'U'
        deutlich: boolean
      }
      ergebnisse.erfassungen.push({ terminId, sieger, deutlich, kopf: route.request().headers()['x-fubo-kein-refresh'] })
      const m = welt.modelle.find((t) => t.terminId === terminId)
      if (!m) return problem(route, 404, 'INHALT_NICHT_GEFUNDEN', 'Der Termin wurde nicht gefunden.')
      if (m.status !== 'ABGESCHLOSSEN') {
        return problem(route, 409, 'TERMIN_NICHT_ABGESCHLOSSEN', `Der Termin ist ${m.status}, ein Ergebnis ist noch nicht möglich.`)
      }
      if (!m.teams) return problem(route, 409, 'KEINE_EINTEILUNG', 'Für diesen Termin gibt es keine Einteilung.')
      if (m.ergebnis) {
        return problem(route, 409, 'ERGEBNIS_VORHANDEN', `Das Ergebnis wurde bereits von ${m.ergebnis.erfasstVon} erfasst.`)
      }
      if (sieger === 'U' && deutlich) {
        return problem(route, 400, 'EINGABE_UNGUELTIG', 'Bei Unentschieden ist deutlich nicht zulässig.')
      }
      m.ergebnis = { sieger, deutlich, erfasstVon: EIGENER_NAME, erfasstAm: new Date().toISOString(), korrigiertAm: null, version: 1 }
      const inA = m.teams.teamA.some((e) => e.anzeigeName === EIGENER_NAME && !e.gast)
      const inB = m.teams.teamB.some((e) => e.anzeigeName === EIGENER_NAME && !e.gast)
      if (inA || inB) {
        if (sieger === 'U') ergebnisse.bilanz.unentschieden += 1
        else if ((sieger === 'A') === inA) ergebnisse.bilanz.siege += 1
        else ergebnisse.bilanz.niederlagen += 1
      }
      return route.fulfill({ status: 201, json: m.ergebnis })
    },
  )

  await page.route(
    (url) => url.pathname === '/api/v1/bilanz/lesen',
    (route) => {
      ergebnisse.bilanzabrufe.push(route.request().headers()['x-fubo-kein-refresh'])
      return route.fulfill({ json: ergebnisse.bilanz })
    },
  )

  return ergebnisse
}
