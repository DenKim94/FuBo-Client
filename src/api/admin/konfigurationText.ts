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
/**
 * Wahl des Springers als Auswahl (A20b, Vertrag vom 03.11.2026). Der Springer wird vor der Einteilung bestimmt und
 * gehört keinem Team fest an; deshalb kein Zusatz „des größeren Teams“ mehr.
 */
export const REGELN: { wert: AuswechselModus; text: string; zusatz: string }[] = [
  { wert: 'ZUFAELLIG', text: 'Zufällig', zusatz: 'aus allen Teilnehmern' },
  { wert: 'ZULETZT_ANGEMELDET', text: 'Zuletzt angemeldeter Spieler', zusatz: 'mit der spätesten Zusage' },
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
 * Anzeigetext einer Springer-Regel samt Zusatz („Zufällig aus allen Teilnehmern“).
 *
 * @param wert Die Regel.
 */
export function regelText(wert: AuswechselModus): string {
  const regel = REGELN.find((r) => r.wert === wert)
  return regel ? `${regel.text} ${regel.zusatz}` : wert
}
