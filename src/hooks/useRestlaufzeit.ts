import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { sitzungFristLesen, type SitzungInfo } from '@/api/auth/auth'
import { schluessel } from '@/api/common/schluessel'

/**
 * Wie lange vor dem Ende der Ablauf-Dialog erscheint (Prototyp 16: „2 Min. vorher").
 *
 * Zwei Minuten reichen, um eine laufende Eingabe zu beenden und zu entscheiden,
 * und sind kurz genug, dass der Dialog bei einem Leerlauf-Fenster von 15
 * Minuten nicht ständig im Weg steht.
 */
export const WARNZEIT_MS = 2 * 60_000

/** Abstand der Abrufe, solange das Ende fern ist. */
export const FRIST_INTERVALL_MS = 30_000

/**
 * Abstand der Abrufe in den letzten drei Minuten.
 *
 * Dichter, weil in dieser Phase die Anzeige davon abhängt: Hat die Person in
 * einem zweiten Tab oder zuletzt in dieser Ansicht etwas getan, hat der Server
 * das Fenster längst verschoben, der Client kennt es aber nur vom letzten Abruf.
 * Mit fünf Sekunden Abstand ist ein unnötig angezeigter Dialog nach höchstens
 * fünf Sekunden wieder weg.
 */
export const FRIST_INTERVALL_NAH_MS = 5_000

/** Ab dieser Restzeit gilt der dichte Abstand: Warnzeit plus eine Minute Vorlauf. */
const NAH_SCHWELLE_MS = WARNZEIT_MS + 60_000

/** Schlag der Uhr im Client; die Anzeige springt sekundenweise. */
const UHR_TAKT_MS = 1_000

/** Die beiden Zeitpunkte des Servers als Millisekunden seit 1970. */
type Frist = {
  /** Ende des gleitenden Leerlauf-Fensters. */
  gueltigBisMs: number
  /** Harte Obergrenze; wandert nie. */
  absolutGueltigBisMs: number
}

/** Wandelt die Sitzungsauskunft in Zahlen, mit denen sich rechnen lässt. */
function fristAusSitzung(sitzung: SitzungInfo): Frist {
  return {
    gueltigBisMs: Date.parse(sitzung.gueltigBis),
    absolutGueltigBisMs: Date.parse(sitzung.absolutGueltigBis),
  }
}

/** Rückgabe von {@link useRestlaufzeit}. */
export type Restlaufzeit = {
  /**
   * Millisekunden bis zum Ende der Sitzung (nie negativ) oder `null`, solange
   * der Server noch nicht geantwortet hat.
   */
  restMs: number | null
  /**
   * Eine Verlängerung würde das Ende nach hinten schieben.
   *
   * `false`, wenn das Leerlauf-Fenster bereits an der harten Obergrenze endet:
   * Der Server klemmt `gueltigBis` auf `absolutGueltigBis`, beide sind dann
   * gleich, und „Sitzung verlängern" bliebe wirkungslos (DESIGN.md,
   * „Besonderheit: Sitzungsablauf"). Verglichen werden zwei Zeitpunkte des
   * **Servers** – die Aussage hängt nicht von der Uhr des Geräts ab.
   */
  verlaengerbar: boolean
  /** Das Ende ist nah genug ({@link WARNZEIT_MS}), um die Person zu warnen. */
  warnen: boolean
}

/**
 * Hält die Uhr des Clients im Sekundentakt.
 *
 * Als Zustand und nicht als `Date.now()` im Rumpf der Komponente: Die Zeit ist
 * eine Eingabe von aussen, und ein Rumpf, der sie bei jedem Rendern frisch
 * liest, ist nicht rein. Der Zustand ändert sich nur durch den Takt.
 */
function useUhr(aktiv: boolean): number {
  const [jetzt, setJetzt] = useState(() => Date.now())

  useEffect(() => {
    if (!aktiv) return
    const takt = setInterval(() => setJetzt(Date.now()), UHR_TAKT_MS)
    return () => clearInterval(takt)
  }, [aktiv])

  return jetzt
}

/**
 * Liefert die Restlaufzeit der Sitzung für Countdown und Ablauf-Dialog (A14).
 *
 * **Zwei Zeitpunkte, ein Ende:** Die Sitzung endet am früheren von
 * `gueltigBis` (gleitendes Leerlauf-Fenster) und `absolutGueltigBis` (harte
 * Obergrenze). Beide liefert der Server; der Client rechnet sie nicht aus.
 *
 * **Der Abruf läuft mit `X-FuBo-Kein-Refresh`** (`sitzungFristLesen`): Er ist
 * keine Nutzeraktivität und darf das Fenster nicht verschieben. Deshalb ein
 * eigener Schlüssel statt `useSitzung` – dort ist der Abruf bewusst eine
 * Aktivität (Neuladen, Rückkehr in die Anwendung).
 *
 * **Der Abruf ist das, was den Ablauf bemerkt.** Antwortet der Server mit
 * `401`, wirft `sitzungFristLesen`, und die globale Behandlung in
 * `queryClient.ts` leert den Cache und führt zur PIN-Eingabe. Der Countdown ist
 * reine Darstellung: Geht die Uhr des Geräts falsch, zeigt der Dialog zu früh
 * oder zu spät – abgemeldet wird nur auf Anweisung des Servers.
 *
 * Läuft der Countdown auf null, ohne dass der Server die Sitzung für beendet
 * erklärt (Uhr des Geräts geht vor), zeigt er `0:00`, und die dichten Abrufe
 * klären es innerhalb von fünf Sekunden.
 *
 * Fällt ein Abruf aus (keine Verbindung), bleibt der letzte Stand stehen und
 * der Countdown läuft weiter.
 *
 * Die Uhr tickt in der Komponente, die den Hook benutzt: Wer ihn in einem
 * grossen Baum aufruft, rendert diesen jede Sekunde neu. Ein eigenes, kleines
 * Blatt (wie `SitzungAblaufDialog`) hält das klein.
 *
 * @param aktiv `false`, solange keine abgeschlossene Anmeldung besteht.
 */
export function useRestlaufzeit(aktiv = true): Restlaufzeit {
  const abfrage = useQuery({
    queryKey: schluessel.sitzungFrist,
    queryFn: () => sitzungFristLesen(),
    select: fristAusSitzung,
    enabled: aktiv,
    staleTime: 0,
    // Das Ende nähert sich, der Abstand schrumpft mit. Die Funktion bekommt die
    // Rohdaten (vor `select`).
    refetchInterval: (abfrageZustand) => {
      const sitzung = abfrageZustand.state.data
      if (!sitzung) return FRIST_INTERVALL_MS
      const ende = Math.min(Date.parse(sitzung.gueltigBis), Date.parse(sitzung.absolutGueltigBis))
      return ende - Date.now() <= NAH_SCHWELLE_MS ? FRIST_INTERVALL_NAH_MS : FRIST_INTERVALL_MS
    },
  })

  const takt = useUhr(aktiv)
  const frist = abfrage.data

  if (!frist) return { restMs: null, verlaengerbar: false, warnen: false }

  // Der Takt hinkt bis zu einer Sekunde hinterher. Frische Daten sind der
  // sicherere Zeitpunkt: Sie kamen eben an, also ist es mindestens so spät. So
  // zeigt die Anzeige nach einer Verlängerung sofort den neuen Stand und nicht
  // bis zu eine Sekunde zu viel.
  const jetzt = Math.max(takt, abfrage.dataUpdatedAt)
  const ende = Math.min(frist.gueltigBisMs, frist.absolutGueltigBisMs)
  const restMs = Math.max(0, ende - jetzt)
  return {
    restMs,
    verlaengerbar: frist.gueltigBisMs < frist.absolutGueltigBisMs,
    warnen: restMs <= WARNZEIT_MS,
  }
}
