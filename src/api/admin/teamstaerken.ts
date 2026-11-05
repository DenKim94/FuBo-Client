import type { Kategoriepunkte } from '@/api/admin/adminTeams'
import type { SkillKategorie } from '@/api/admin/skills'

/**
 * Aufbereitung der Punktsummen des manuellen Laufs (Vertrag vom 05.11.2026). Rein und ohne feste Kategorien – wie
 * `skills.ts`: Nichts hier kennt `ANGRIFF` oder `TORWART`; die Tests prüfen es mit erfundenen Kategorien.
 */

/** Eine Zeile der Tabelle „Gesamtpunkte je Team und Kategorie“. */
export type TeamstaerkenZeile = { schluessel: string; bezeichnung: string; a: number; b: number }

/**
 * Ordnet die Punktsummen den Kategorien zu (05.11.2026).
 *
 * **Reihenfolge und Beschriftung kommen aus den Kategorien des Servers**, nicht aus der Antwort: Der Vertrag sagt, die
 * Schlüssel stünden zwar sortiert in `Kategoriepunkte`, ein Client solle sich aber nicht darauf verlassen. Eine Kategorie,
 * die nur in der Antwort steht (etwa neu angelegt, die Kategorien sind noch zwischengespeichert), erscheint hinten mit
 * ihrem Schlüssel; eine, die in keiner Antwort steht, entfällt. Fehlt ein Wert in nur einem Team, gilt `0` – der Vertrag
 * liefert jede aktive Kategorie, auch mit `0`.
 *
 * @param teamA Punkte von Team A.
 * @param teamB Punkte von Team B.
 * @param kategorien Die aktiven Kategorien oder `undefined`, solange sie nicht geladen sind.
 */
export function teamstaerkenZeilen(
  teamA: Kategoriepunkte,
  teamB: Kategoriepunkte,
  kategorien: readonly SkillKategorie[] | undefined,
): TeamstaerkenZeile[] {
  const geliefert = [...new Set([...Object.keys(teamA), ...Object.keys(teamB)])]
  const bekannt = (kategorien ?? []).filter((k) => geliefert.includes(k.schluessel))
  const bekannteSchluessel = new Set(bekannt.map((k) => k.schluessel))
  const zeile = (schluessel: string, bezeichnung: string): TeamstaerkenZeile => ({
    schluessel,
    bezeichnung,
    a: teamA[schluessel] ?? 0,
    b: teamB[schluessel] ?? 0,
  })
  return [
    ...bekannt.map((k) => zeile(k.schluessel, k.bezeichnung)),
    ...geliefert.filter((s) => !bekannteSchluessel.has(s)).map((s) => zeile(s, s)),
  ]
}
