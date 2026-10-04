import { useQuery, type Query } from '@tanstack/react-query'
import { sitzungLesen, type SitzungInfo } from '@/api/auth/auth'
import { schluessel } from '@/api/common/schluessel'

/**
 * `true`, solange der Server noch keine Auskunft gegeben hat (`data` fehlt,
 * etwa nach einem Netzfehler beim Start). `null` ist eine Auskunft: keine Sitzung.
 */
function ohneStand(abfrage: Query<SitzungInfo | null, Error>): boolean {
  return abfrage.state.data === undefined
}

/** Rueckgabe von {@link useSitzung}. */
export type SitzungZustand = {
  /** Der Server hat noch nicht geantwortet – der Zustand ist unbekannt. */
  laedt: boolean
  /** Rohdaten der Sitzung oder `null`, wenn keine besteht. */
  sitzung: SitzungInfo | null
  /** Anmeldung vollstaendig abgeschlossen (`stage = PROFILE_AUTHENTICATED`). */
  angemeldet: boolean
  /** PIN geprueft, Identitaet aber noch nicht gewaehlt. */
  pinGeprueft: boolean
  /** Rolle ADMIN. */
  istAdmin: boolean
  /** Rolle GAST – erhaelt z. B. keine Push-Benachrichtigungen (A25d). */
  istGast: boolean
}

/**
 * Liest den Zustand der eigenen Sitzung vom Server.
 *
 * Der Zustand kommt bewusst **nicht** aus einem lokalen Kontext: Autoritaet ist
 * der Server, das Sitzungs-Cookie ist HttpOnly und fuer das Frontend unlesbar.
 * Ein lokal gehaltenes Abbild liefe ausserdem beim Ablauf der Sitzung
 * auseinander, ohne dass es jemand bemerkt.
 *
 * `retry: false`: Ein `401` liefert hier `null` und ist kein Fehler; bleibt der
 * Server stumm, hilft ein zweiter Versuch nicht und verzoegert nur die
 * Umleitung zur Anmeldung.
 *
 * **Dieser Abruf zählt als Aktivität** (ohne `X-FuBo-Kein-Refresh`) und
 * verschiebt das gleitende Leerlauf-Fenster. Er darf deshalb nur laufen, wenn
 * die Person etwas tut: Start, Neuladen, Wechsel der Ansicht (Mount nach
 * `staleTime`) oder ein Stufenwechsel (Invalidierung). **Nicht** bei der
 * Rückkehr in den Tab (`refetchOnWindowFocus`) und nicht nach einem
 * Verbindungsausfall (`refetchOnReconnect`): Beides geschieht ohne Bedienung.
 * Ausnahme: Es liegt noch kein Stand vor (Start ohne Verbindung, {@link ohneStand}).
 * Chrome unter macOS meldet ein verdecktes Fenster sogar als `hidden`; jeder
 * Blick zurück verlängerte die Sitzung, und der Ablauf-Dialog erschiene nie
 * (Fehler aus der Handprüfung vom 04.10.2026). Den aktuellen Stand bei Rückkehr
 * liest der Frist-Abruf (`useRestlaufzeit`), der das Fenster nicht verschiebt.
 */
export function useSitzung(): SitzungZustand {
  const abfrage = useQuery({
    queryKey: schluessel.sitzung,
    // Bewusst gekapselt statt `queryFn: sitzungLesen`: TanStack Query uebergibt
    // der Funktion einen Kontext. Der landete sonst im Parameter `keinRefresh`
    // und waere dort truthy – jeder Aufruf truege dann den Kopf
    // `X-FuBo-Kein-Refresh`, und das gleitende Fenster wanderte nie nach hinten.
    queryFn: () => sitzungLesen(),
    retry: false,
    staleTime: 10_000,
    // Rückkehr und Wiederverbindung sind keine Bedienung (siehe oben). Einzige
    // Ausnahme: Es liegt noch gar kein Stand vor, weil der Startaufruf ohne
    // Verbindung scheiterte. Dann muss der Client die Stufe erst erfahren, sonst
    // bliebe eine angemeldete Person nach der Wiederverbindung auf der PIN-Eingabe.
    refetchOnWindowFocus: ohneStand,
    refetchOnReconnect: ohneStand,
  })

  const sitzung = abfrage.data ?? null

  return {
    laedt: abfrage.isPending,
    sitzung,
    angemeldet: sitzung?.stage === 'PROFILE_AUTHENTICATED',
    pinGeprueft: sitzung?.stage === 'PIN_VERIFIED',
    istAdmin: sitzung?.rolle === 'ADMIN',
    istGast: sitzung?.rolle === 'GAST',
  }
}
