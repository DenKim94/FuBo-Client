import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { halleAbsagen } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Sagt den Termin per E-Mail an die Halle ab (`204`, C8 10.1). **Versendet eine echte E-Mail, nicht zurückzunehmen.**
 *
 * - **Nach Erfolg:** liest die Termine neu (`halleAbgesagtAm` ist gesetzt, der Termin steht auf `ABGESAGT`); die Mutation
 *   bleibt bis dahin `pending`, damit der Dialog nicht mit dem alten Stand schließt.
 * - **`HALLE_BEREITS_ABGESAGT` ist kein Fehler**, sondern ein Doppelklick: Der Hook liest die Termine neu, damit der
 *   Zeitpunkt der ersten Absage da ist; der Aufrufer behandelt den Code als Erfolg.
 * - **Weitere Zustandsfehler** lesen die betroffene Gruppe neu: `TERMIN_GESCHLOSSEN` die Termine, `HALLE_MODUS_INAKTIV` und
 *   `HALLE_NICHT_KONFIGURIERT` die Konfiguration (der Abschnitt ändert dann seine Anzeige).
 * - **`503 VERSAND_FEHLGESCHLAGEN` lässt alles stehen** und wird nie automatisch wiederholt (Mutationen haben `retry: 0`);
 *   die Wiederholung ist Sache des Menschen.
 */
export function useHalleAbsagen(): UseMutationResult<void, Error, number> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (terminId: number) => halleAbsagen(terminId),
    onSuccess: () => termineNeuLesen(queryClient),
    onError: (fehler) => {
      if (!(fehler instanceof ApiFehler)) return
      if (fehler.code === 'HALLE_BEREITS_ABGESAGT' || fehler.code === 'TERMIN_GESCHLOSSEN') return termineNeuLesen(queryClient)
      if (fehler.code === 'HALLE_MODUS_INAKTIV' || fehler.code === 'HALLE_NICHT_KONFIGURIERT') {
        return queryClient.invalidateQueries({ queryKey: schluessel.adminKonfiguration })
      }
    },
  })
}
