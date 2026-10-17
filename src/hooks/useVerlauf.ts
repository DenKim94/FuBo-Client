import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { schluessel } from '@/api/common/schluessel'
import { letzterAbgeschlossener, vergangeneTermine, verlaufAb } from '@/api/termine/terminZeit'
import { termineLesen, type TerminUebersicht } from '@/api/termine/termine'

/** Was der Verlauf liefert: vergangene Termine, neueste zuerst, und der zuletzt abgeschlossene. */
export type VerlaufDaten = {
  /** Abgeschlossene und vergangene abgesagte Termine, neueste zuerst. */
  vergangene: TerminUebersicht[]
  /** Der zuletzt abgeschlossene Termin (Grundlage des Tabs „Ergebnisse“, E13). */
  letzter: TerminUebersicht | undefined
}

/**
 * Wählt aus der Antwort aus. **In `select`, nicht im Render:** Die Auswahl liest die
 * Uhr (ab wann gilt ein Termin als vergangen), und das gehört nicht in die
 * Berechnung einer Komponente. React Query merkt sich das Ergebnis, solange die
 * Antwort gleich bleibt.
 */
function auswaehlen(liste: TerminUebersicht[]): VerlaufDaten {
  return { vergangene: vergangeneTermine(liste, new Date()), letzter: letzterAbgeschlossener(liste) }
}

/**
 * Liest die vergangenen Termine der letzten Tage (E14) für Verlauf und Ergebnisse.
 *
 * **Eigener Schlüssel** (`termineVerlauf`): `invalidateQueries(termine)` nach einer
 * Rückmeldung trifft ihn nicht, und die Terminliste des Dashboards bleibt ohne `ab`.
 * Der Abruf trägt `ab = heute − VERLAUF_TAGE`; `ab` hat keine Obergrenze, die
 * künftigen Termine der Antwort fallen in `auswaehlen` heraus.
 *
 * **Kein Polling:** Vergangene Termine ändern sich nur durch Ergebnis und
 * Korrektur. `X-FuBo-Kein-Refresh: true`, weil der Abruf keine Bedienung ist.
 *
 * @returns Das Abfrageobjekt; `data` trägt `vergangene` und `letzter`.
 */
export function useVerlauf(): UseQueryResult<VerlaufDaten, Error> {
  return useQuery({
    queryKey: schluessel.termineVerlauf,
    queryFn: () => termineLesen({ ab: verlaufAb(new Date()), keinRefresh: true }),
    select: auswaehlen,
    staleTime: 60_000,
  })
}
