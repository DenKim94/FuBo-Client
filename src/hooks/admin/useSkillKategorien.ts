import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { skillKategorienLesen, type SkillKategorie } from '@/api/admin/adminProfile'
import { schluessel } from '@/api/common/schluessel'

/** Wie lange die Kategorien als frisch gelten: Sie ändern sich selten (eine Datenänderung, keine Schemamigration). */
export const SKILLS_STALE_MS = 5 * 60_000

/**
 * Liest die aktiven Skillkategorien mit Wertebereich.
 *
 * Aus dieser Antwort wird das Formular gebaut; **nichts ist fest verdrahtet.** Ohne Polling,
 * ohne `X-FuBo-Kein-Refresh`, `refetchOnWindowFocus: false` (E4).
 */
export function useSkillKategorien(): UseQueryResult<SkillKategorie[], Error> {
  return useQuery({
    queryKey: schluessel.adminSkills,
    queryFn: skillKategorienLesen,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    staleTime: SKILLS_STALE_MS,
  })
}
