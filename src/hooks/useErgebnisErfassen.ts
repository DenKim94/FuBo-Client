import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { ergebnisErfassen, type Ergebnis, type Sieger } from '@/api/ergebnis/ergebnis'

/** Eingabe der Mutation: Ausgang des Spiels und ob der Sieg deutlich war. */
export type ErgebnisEingabe = { sieger: Sieger; deutlich: boolean }

/**
 * Erfasst das Ergebnis eines Termins (A21).
 *
 * Aufgerufen mit `mutate({ sieger, deutlich })`. **Kein Cache wird von Hand
 * gesetzt** (E4): Die Antwort ist das neue Ergebnis, die Wahrheit bleibt der
 * Einzeltermin. Stattdessen werden Einzeltermin und Bilanz neu gelesen.
 *
 * **Auch bei `409` und `404` wird neu gelesen:** `ERGEBNIS_VORHANDEN` heißt, dass
 * jemand schneller war – der Einzeltermin trägt dann das Ergebnis, und die Ansicht
 * zeigt es statt des Formulars. `TERMIN_NICHT_ABGESCHLOSSEN` und `KEINE_EINTEILUNG`
 * sagen, dass die Anzeige veraltet war. Bei Netzfehlern und `≥ 500` bleibt der
 * Stand; ein zweiter Tipp wiederholt. **Mutationen werden nie automatisch
 * wiederholt:** Der erste Eintrag gilt, ein Löschen gibt es nicht.
 *
 * @param terminId Technischer Schlüssel des Termins.
 */
export function useErgebnisErfassen(terminId: number): UseMutationResult<Ergebnis, Error, ErgebnisEingabe> {
  const queryClient = useQueryClient()

  /** Liest Einzeltermin und Bilanz neu (`invalidateQueries` lädt nur beobachtete Abfragen). */
  function neuLesen() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: schluessel.termin(String(terminId)) }),
      queryClient.invalidateQueries({ queryKey: schluessel.bilanz }),
    ])
  }

  return useMutation({
    mutationFn: ({ sieger, deutlich }: ErgebnisEingabe) => ergebnisErfassen(terminId, sieger, deutlich),
    onSuccess: neuLesen,
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.status === 409 || fehler.status === 404)) return neuLesen()
    },
  })
}
