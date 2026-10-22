import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { teamsManuellGenerieren, type ManuelleEinteilung, type ManuelleGenerierung } from '@/api/admin/adminTeams'

/**
 * Berechnet Teams für eine frei gewählte Gruppe (C8 10.3, E18).
 *
 * **Liest nichts neu und legt nichts im Cache ab:** Das Ergebnis lebt im Zustand dieses Hooks (`data`) und damit im
 * Zustand der Seite. Ein Cache-Eintrag ließe es bei der nächsten Abfrage mit gleichem Schlüssel wieder auftauchen – die
 * Einteilung ist aber nirgends gespeichert und mit dem Verlassen der Seite weg. Ändert sich die Auswahl, ruft die Seite
 * `reset()` auf, damit nie das Ergebnis einer anderen Gruppe neben der Auswahl steht.
 *
 * Keine Wiederholung bei Fehlern (`retry: 0`); „Erneut berechnen“ ist derselbe Aufruf und liefert mit `HEURISTIK` je
 * Lauf ein anderes Ergebnis.
 */
export function useTeamsManuell(): UseMutationResult<ManuelleEinteilung, Error, ManuelleGenerierung> {
  return useMutation({
    mutationFn: (anfrage: ManuelleGenerierung) => teamsManuellGenerieren(anfrage),
  })
}
