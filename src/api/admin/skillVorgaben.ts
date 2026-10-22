/**
 * Abweichende Vorbelegung einzelner Skillkategorien beim **Anlegen** eines Profils, je Schlüssel.
 *
 * Ohne Eintrag gilt die Mitte der Skala (`mitte` in `skills.ts`). **Torwart startet bei 0** (Vorgabe des
 * Entwicklers vom 22.10.2026): Die meisten Spieler stehen nicht im Tor; mit der Mitte (2 von 3) ginge für jeden
 * neuen Spieler eine Torwartstärke in die Teamgenerierung, die erst jemand bewusst zurücksetzen müsste.
 *
 * **Bewusst eine eigene Datei:** `skills.ts` kennt keine Kategorie beim Namen (die Kategorien sind Daten). Diese
 * Tabelle ist die eine Stelle, an der der Client einen Schlüssel fest kennt. Der Server liefert keine Vorgabewerte
 * (Änderung vom 30.08.2026); liefert er sie eines Tages, entfällt diese Datei. Ein Eintrag ausserhalb des Bereichs
 * der Kategorie (der Bereich kommt vom Server und kann sich ändern) wird ignoriert, dann gilt wieder die Mitte.
 */
export const SKILL_VORGABEN: Readonly<Record<string, number>> = {
  TORWART: 0,
}
