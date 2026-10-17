import type { Page } from '@playwright/test'

/**
 * Nachbildung der Sitzungs-Endpunkte fuer die E2E-Tests (ohne Server).
 *
 * Aus `sitzung-ablauf.spec.ts` herausgeloest (C4, 4.5), weil auch `layout.spec.ts`
 * und `admin.spec.ts` Sitzungen brauchen – in der Stufe `PIN_VERIFIED` und als
 * Admin. Die Zustaende liegen im zurueckgegebenen Objekt und lassen sich zwischen
 * zwei Abrufen aendern; so bilden die Tests auch Stufenwechsel nach (etwa die
 * Admin-Anmeldung setzt `rolle` auf `ADMIN`).
 */

/** Zustand der nachgebildeten Sitzung. */
export type Sitzung = {
  /** Sekunden bis zum Ende des Leerlauf-Fensters. */
  leerlaufSek: number
  /** Sekunden bis zur harten Obergrenze. */
  obergrenzeSek: number
  angemeldet: boolean
  /** Stufe der Sitzung; `PIN_VERIFIED` hat weder Rolle noch Namen. Vorgabe: `PROFILE_AUTHENTICATED`. */
  stage: 'PIN_VERIFIED' | 'PROFILE_AUTHENTICATED'
  /** Rolle in der Stufe `PROFILE_AUTHENTICATED`. Vorgabe: `USER`. */
  rolle: 'USER' | 'ADMIN'
  /** Aufrufe von `/auth/session/erneuern` und `/auth/session/beenden`. */
  erneuert: number
  beendet: number
  /**
   * Abrufe von `/auth/session/lesen` **ohne** `X-FuBo-Kein-Refresh`. Der echte
   * Server verschiebt bei jedem davon das Leerlauf-Fenster; die Nachbildung
   * zaehlt sie nur, damit ein Test unbeabsichtigte Verlaengerungen sieht.
   */
  verlaengernd: number
}

/** Bildet die Sitzungs-Endpunkte nach und gibt den veraenderbaren Zustand zurueck. */
export async function sitzungNachbilden(page: Page, anfang: Partial<Sitzung> = {}): Promise<Sitzung> {
  const sitzung: Sitzung = {
    leerlaufSek: 90,
    obergrenzeSek: 3600,
    angemeldet: true,
    stage: 'PROFILE_AUTHENTICATED',
    rolle: 'USER',
    erneuert: 0,
    beendet: 0,
    verlaengernd: 0,
    ...anfang,
  }
  await page.route('**/api/v1/auth/session/lesen', (route) => {
    if (route.request().headers()['x-fubo-kein-refresh'] !== 'true') sitzung.verlaengernd += 1
    if (!sitzung.angemeldet) {
      return route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        json: { type: 'about:blank', status: 401, code: 'SESSION_UNGUELTIG', detail: 'Die Sitzung ist abgelaufen.' },
      })
    }
    // Eine Uhrablesung fuer beide Enden: Der Server klemmt `gueltigBis` auf
    // `absolutGueltigBis`, die beiden sind dann **exakt** gleich. Zwei
    // getrennte `Date.now()` wichen manchmal um eine Millisekunde ab, und der
    // Dialog hielt die Sitzung fuer verlaengerbar (Flackern nur auf einem Projekt).
    const jetzt = Date.now()
    const enden = {
      gueltigBis: new Date(jetzt + sitzung.leerlaufSek * 1000).toISOString(),
      absolutGueltigBis: new Date(jetzt + sitzung.obergrenzeSek * 1000).toISOString(),
    }
    if (sitzung.stage === 'PIN_VERIFIED') {
      return route.fulfill({ json: { stage: 'PIN_VERIFIED', rolle: null, anzeigeName: null, ...enden } })
    }
    return route.fulfill({
      json: {
        stage: 'PROFILE_AUTHENTICATED',
        rolle: sitzung.rolle,
        anzeigeName: sitzung.rolle === 'ADMIN' ? 'Beispieladmin' : 'Beispielspieler 03',
        ...enden,
      },
    })
  })
  await page.route('**/api/v1/auth/session/erneuern', (route) => {
    sitzung.erneuert += 1
    // Wie der Server: neues Fenster, aber nie ueber die Obergrenze.
    sitzung.leerlaufSek = Math.min(900, sitzung.obergrenzeSek)
    return route.fulfill({ status: 204 })
  })
  await page.route('**/api/v1/auth/session/beenden', (route) => {
    sitzung.beendet += 1
    sitzung.angemeldet = false
    return route.fulfill({ status: 204 })
  })
  return sitzung
}
