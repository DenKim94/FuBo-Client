/**
 * Zusatzangaben einer Route, abgelegt in ihrem `handle`.
 *
 * Eigene Datei statt in `routen.tsx`: Das Layout liest die Angaben, und
 * `routen.tsx` bindet das Layout ein – ein Import in umgekehrter Richtung wäre
 * ein Zirkelbezug.
 */
export type RoutenAngaben = {
  /**
   * Blendet die Zurück-Schaltfläche aus. Für Ansichten, hinter denen es kein
   * sinnvolles „Zurück" gibt: die Login-Schritte. Von der Namensauswahl
   * zurück zur PIN führte der Guard sofort wieder vorwärts, weil die Stufe
   * `PIN_VERIFIED` dorthin gehört.
   */
  ohneZurueck?: boolean
  /**
   * Übergeordnete Ansicht, zu der die Zurück-Schaltfläche führt (C2, Abschnitt 6.1).
   *
   * „Einen Schritt zurück" und „zur übergeordneten Ansicht" sind verschiedene
   * Dinge: Aus der Ergebniserfassung zur Teamansicht und von dort wieder
   * zurück landete man mit `navigate(-1)` erneut in der Ergebniserfassung. Die
   * Zielangabe ist deshalb die Regel, der Schritt im Verlauf die Abkürzung für
   * Routen ohne eindeutige übergeordnete Ansicht. Bei verschachtelten Routen
   * gilt die Angabe der innersten.
   */
  zurueck?: string
}
