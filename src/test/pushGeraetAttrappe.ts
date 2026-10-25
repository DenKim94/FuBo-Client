import type { AboAnlegen } from '@/api/push/push'
import type * as PushGeraet from '@/pwa/pushGeraet'
import type { Berechtigung } from '@/pwa/pushGeraet'
import type * as UmgebungModul from '@/pwa/umgebung'
import type { Umgebung } from '@/pwa/umgebung'

/**
 * Geräte-Attrappe für Unit-Tests (C9, 3.4).
 *
 * jsdom kennt weder `Notification` noch `PushManager` noch `navigator.serviceWorker`. Die Tests sprechen deshalb
 * **nie** die Browser-API an, sondern ersetzen die beiden Module `@/pwa/pushGeraet` und `@/pwa/umgebung`:
 *
 * ```ts
 * vi.mock('@/pwa/pushGeraet', async (original) =>
 *   (await import('@/test/pushGeraetAttrappe')).geraetModul(await original()))
 * vi.mock('@/pwa/umgebung', async (original) =>
 *   (await import('@/test/pushGeraetAttrappe')).umgebungModul(await original()))
 * ```
 *
 * Die reinen Hilfen (`base64urlZuBytes`, `gleicheBytes`, `GeraetFehler`, `istIos`) bleiben echt. Gesteuert wird
 * über {@link geraet}; {@link geraetZuruecksetzen} gehört in `beforeEach`.
 */

/** Abonnement der Attrappe; `vapid` ist der Schlüssel, mit dem es angelegt wurde. */
export type AttrappenAbo = { endpoint: string; vapid: string | null }

/** Steuerbarer Zustand des nachgebildeten Geräts. */
export type GeraetZustand = {
  umgebung: Umgebung
  berechtigung: Berechtigung
  /** Was die Anfrage der Berechtigung ergibt. */
  antwortAufAnfrage: Berechtigung
  abo: AttrappenAbo | null
  /** Adresse eines neu angelegten Abonnements. */
  neuerEndpoint: string
  /** Wirft `abonnieren` diesen Fehler. */
  abonnierenFehler: Error | null
  /** Wirft `kuendigen` diesen Fehler. */
  kuendigenFehler: Error | null
  /** Aufrufe der Adapterfunktionen in Reihenfolge. */
  aufrufe: ('stand' | 'erfragen' | 'abonnieren' | 'kuendigen')[]
  /** Wird beim Erfragen der Berechtigung aufgerufen (Reihenfolgetests, G2). */
  beiErfragen: (() => void) | null
  /** Angemeldete Hörer der Navigationsnachricht; ein Test ruft sie wie der Worker auf. */
  navigationsHoerer: ((pfad: string) => void)[]
}

/** p256dh und auth der Attrappe: gültige Längen laut Vertrag (88 bzw. 22 Zeichen). */
export const ATTRAPPE_P256DH = 'B'.padEnd(88, 'x')
export const ATTRAPPE_AUTH = 'a'.repeat(22)

function anfangszustand(): GeraetZustand {
  return {
    umgebung: { ios: false, standalone: false, sicher: true, pushMoeglich: true },
    berechtigung: 'default',
    antwortAufAnfrage: 'granted',
    abo: null,
    neuerEndpoint: 'https://push.example/geraet-1',
    abonnierenFehler: null,
    kuendigenFehler: null,
    aufrufe: [],
    beiErfragen: null,
    navigationsHoerer: [],
  }
}

/** Der Zustand des Geräts; Tests ändern ihn direkt. */
export const geraet: GeraetZustand = anfangszustand()

/** Setzt das Gerät auf den Anfang zurück (Push möglich, Berechtigung `default`, kein Abonnement). */
export function geraetZuruecksetzen(teil: Partial<GeraetZustand> = {}) {
  Object.assign(geraet, anfangszustand(), teil)
}

/** Ersatz für `@/pwa/pushGeraet`. */
export function geraetModul(echt: typeof PushGeraet): typeof PushGeraet {
  const werte = (endpoint: string): AboAnlegen => ({ endpoint, p256dh: ATTRAPPE_P256DH, auth: ATTRAPPE_AUTH })
  return {
    ...echt,
    standLesen: async () => {
      geraet.aufrufe.push('stand')
      return {
        berechtigung: geraet.berechtigung,
        abo: geraet.abo
          ? { endpoint: geraet.abo.endpoint, schluessel: geraet.abo.vapid ? echt.base64urlZuBytes(geraet.abo.vapid) : null }
          : null,
      }
    },
    berechtigungErfragen: () => {
      geraet.aufrufe.push('erfragen')
      geraet.beiErfragen?.()
      geraet.berechtigung = geraet.antwortAufAnfrage
      return Promise.resolve(geraet.berechtigung)
    },
    abonnieren: async (vapid: string) => {
      geraet.aufrufe.push('abonnieren')
      if (geraet.abonnierenFehler) throw geraet.abonnierenFehler
      // Wie der Browser: gleicher Schlüssel ⇒ vorhandenes Abonnement, anderer ⇒ kündigen und neu.
      if (geraet.abo && geraet.abo.vapid === vapid) return werte(geraet.abo.endpoint)
      geraet.abo = { endpoint: geraet.neuerEndpoint, vapid }
      return werte(geraet.abo.endpoint)
    },
    navigationsNachrichtenHoeren: (beiZiel: (pfad: string) => void) => {
      geraet.navigationsHoerer.push(beiZiel)
      return () => {
        geraet.navigationsHoerer = geraet.navigationsHoerer.filter((h) => h !== beiZiel)
      }
    },
    kuendigen: async () => {
      geraet.aufrufe.push('kuendigen')
      if (geraet.kuendigenFehler) throw geraet.kuendigenFehler
      const endpoint = geraet.abo?.endpoint ?? null
      geraet.abo = null
      return endpoint
    },
  }
}

/** Ersatz für `@/pwa/umgebung`: `umgebungLesen` liefert {@link GeraetZustand.umgebung}. */
export function umgebungModul(echt: typeof UmgebungModul): typeof UmgebungModul {
  return { ...echt, umgebungLesen: () => ({ ...geraet.umgebung }) }
}
