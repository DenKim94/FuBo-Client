import type { AlgorithmType, AuswechselModus } from '@/api/admin/adminKonfiguration'

/**
 * Anzeigetexte der Konfigurationswerte (C8). An einem Ort, weil zwei Stellen dieselben Wörter brauchen: das
 * Konfigurationsformular (Auswahl) und die manuelle Teamgenerierung („Gerechnet mit: …“). Weichen die Wörter ab, hielte
 * der Admin zwei Verfahren für verschieden.
 */

/** Verfahren als Auswahl: Wert des Vertrags, Anzeigetext und eine Zeile Erklärung. */
export const VERFAHREN: { wert: AlgorithmType; text: string; zusatz: string }[] = [
  // „Standard“ statt „Exakt“ (24.10.2026, Vorgabe des Entwicklers): die Voreinstellung, nicht ein Fachbegriff.
  { wert: 'EXHAUSTIV', text: 'Standard', zusatz: 'prüft alle Aufteilungen' },
  { wert: 'HEURISTIK', text: 'Schnell', zusatz: 'nah am Optimum' },
]
/** Regel für den Auswechselspieler als Auswahl. */
export const REGELN: { wert: AuswechselModus; text: string; zusatz: string }[] = [
  { wert: 'SCHWAECHSTER_UEBERZAHL', text: 'Schwächster Spieler', zusatz: 'des größeren Teams' },
  { wert: 'ZULETZT_ANGEMELDET', text: 'Zuletzt angemeldeter Spieler', zusatz: 'des größeren Teams' },
]

/**
 * Anzeigetext eines Verfahrens, wie der Server es meldet.
 *
 * @param wert Das Verfahren.
 */
export function verfahrenText(wert: AlgorithmType): string {
  return VERFAHREN.find((v) => v.wert === wert)?.text ?? wert
}

/**
 * Anzeigetext einer Auswechselregel samt Zusatz („Schwächster Spieler des größeren Teams“).
 *
 * @param wert Die Regel.
 */
export function regelText(wert: AuswechselModus): string {
  const regel = REGELN.find((r) => r.wert === wert)
  return regel ? `${regel.text} ${regel.zusatz}` : wert
}
