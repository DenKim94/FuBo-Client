import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { ergebnisKorrigieren, type ErgebnisKorrektur } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { termineNeuLesen } from './termineNeuLesen'

/**
 * Korrigiert das Ergebnis eines Termins als Voll-Update (`204`, C8 10.2).
 *
 * - **Nach Erfolg:** liest die Termine neu (neues `ergebnis` mit neuer `version` und `korrigiertAm`) **und die Bilanz**:
 *   Siege, Niederlagen und Unentschieden der Beteiligten haben sich geändert. Beobachtet dieses Gerät keine Bilanz, ist das
 *   Ungültigmachen ohne Wirkung. Die Mutation bleibt bis dahin `pending`.
 * - **`409 DATEN_VERALTET` und `404`** lesen die Termine sofort neu (E5): Das Formular baut sich mit dem frischen Stand
 *   auf (`key={ergebnis.version}`); es wird nie mit der neuen `version` und den alten Eingaben gesendet.
 */
export function useErgebnisKorrigieren(): UseMutationResult<void, Error, ErgebnisKorrektur> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (anfrage: ErgebnisKorrektur) => ergebnisKorrigieren(anfrage),
    onSuccess: () => Promise.all([termineNeuLesen(queryClient), queryClient.invalidateQueries({ queryKey: schluessel.bilanz })]),
    onError: (fehler) => {
      if (fehler instanceof ApiFehler && (fehler.code === 'DATEN_VERALTET' || fehler.status === 404)) {
        return termineNeuLesen(queryClient)
      }
    },
  })
}
