import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { adminNameAnfordern, type NameAnforderung } from '@/api/admin/admin'

/**
 * Fordert die Änderung des Admin-Anmeldenamens an (E20, Schritt 1).
 *
 * Aufgerufen mit `mutateAsync({ neuerName })`. **Der Name ändert sich noch nicht:**
 * Der Server schickt eine fünfstellige PIN an die hinterlegte E-Mail-Adresse. Die
 * Antwort (`202`) hat keinen Rumpf; die Ansicht geht selbst zu Schritt 2.
 *
 * **Nur auf ausdrückliche Handlung.** Jede Anforderung entwertet die zuvor offene
 * PIN und zählt auf drei je Stunde (`NAME_AENDERUNG_GEDROSSELT`); die Mutation
 * wiederholt nie (`queryClient.ts`). Liest **nichts** neu (die Sitzung bleibt).
 *
 * **Fehler:** `NAME_BELEGT` (`409`, nichts wurde gesendet), `NAME_AENDERUNG_GEDROSSELT`
 * (`429` mit `wartesekunden`), `VERSAND_FEHLGESCHLAGEN` (`503`, es bleibt nichts
 * zurück; der Aufruf ist unverändert wiederholbar), `EINGABE_UNGUELTIG`.
 */
export function useNameAnfordern(): UseMutationResult<void, Error, NameAnforderung> {
  return useMutation({
    mutationFn: (anfrage: NameAnforderung) => adminNameAnfordern(anfrage),
  })
}
