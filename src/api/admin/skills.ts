import type { components } from '@/api/common/types/schema'

/** Eine aktive Skillkategorie samt Wertebereich (`GET /admin/skills/lesen`). */
export type SkillKategorie = components['schemas']['SkillKategorieInfo']

/**
 * Hilfsfunktionen für Skillwerte (C7, 5.3). Rein und ohne feste Kategorien: Die
 * Kategorien sind **Daten, keine Spalten** – eine neue Kategorie ist eine Datenänderung.
 * Nichts hier kennt `ANGRIFF` oder `TORWART`; die Tests prüfen es mit erfundenen Kategorien.
 */

/**
 * Mitte der Skala einer Kategorie – der **sichtbare** Vorschlag beim Anlegen.
 *
 * `0 bis 6` ergibt 3, `0 bis 3` ergibt 2 (1,5 wird aufgerundet). Der Server kennt keine
 * Vorgabewerte mehr (Änderung vom 30.08.2026): Ein Wert, den niemand bewusst gesetzt hat,
 * ginge sonst als Stärke in die Teamgenerierung. Die Vorbelegung ist deshalb nur eine
 * Eingabehilfe, die die Seite benennt.
 *
 * @param kategorie Die Kategorie.
 */
export function mitte(kategorie: SkillKategorie): number {
  return Math.round((kategorie.minWert + kategorie.maxWert) / 2)
}

/**
 * Hat das Profil zu **jeder** aktiven Kategorie einen Wert?
 *
 * `GET /admin/user/lesen` liefert nur Kategorien, zu denen eine Zeile existiert. Profile
 * aus einem Datenimport können Lücken haben (E7); der Client erkennt sie, indem er die
 * Karte gegen die Kategorien hält.
 *
 * @param skills Die Karte eines Profils.
 * @param kategorien Die aktiven Kategorien.
 */
export function skillsVollstaendig(skills: Record<string, number>, kategorien: SkillKategorie[]): boolean {
  return kategorien.every((kategorie) => skills[kategorie.schluessel] !== undefined)
}

/**
 * Liest die Eingabe einer Kategorie.
 *
 * **Die Werte bleiben Text bis zum Senden:** Leer ist ein Zustand (nichts eingetragen), 0
 * ein Wert. Eine Zahl-Eingabe, die gleich `Number` wandelte, machte aus leer eine 0.
 *
 * @param text Die Eingabe des Feldes.
 * @param kategorie Die Kategorie mit ihrem Wertebereich.
 * @returns Die ganze Zahl im Bereich oder `null` (leer, Dezimalzahl, Text, ausserhalb des Bereichs).
 */
export function skillZahl(text: string, kategorie: SkillKategorie): number | null {
  const getrimmt = text.trim()
  if (!/^\d+$/.test(getrimmt)) return null
  const zahl = Number(getrimmt)
  if (!Number.isSafeInteger(zahl) || zahl < kategorie.minWert || zahl > kategorie.maxWert) return null
  return zahl
}

/**
 * Nur die Kategorien, deren Wert sich geändert hat (Bearbeiten, E6).
 *
 * Eine Kategorie, die vorher fehlte und jetzt einen Wert hat, **ist** eine Änderung.
 *
 * @param vorher Die Karte, wie sie der Server lieferte.
 * @param jetzt Die Werte, wie sie jetzt gelten sollen.
 * @returns Die geänderten Kategorien; leer: nichts zu senden.
 */
export function skillsAenderung(
  vorher: Record<string, number>,
  jetzt: Record<string, number>,
): Record<string, number> {
  const geaendert: Record<string, number> = {}
  for (const [schluessel, wert] of Object.entries(jetzt)) {
    if (vorher[schluessel] !== wert) geaendert[schluessel] = wert
  }
  return geaendert
}

/**
 * Nur das Geänderte an einem Profil: Name und geänderte Kategorien (E6).
 *
 * **Warum nur das Geänderte:** Der Server nimmt eine Teilmenge an und lässt den Rest
 * unberührt. Wer alles sendet, überschriebe fremde Änderungen und fasste Kategorien an, die
 * er nicht angezeigt hat. Zudem ändern Skillwerte die `teilnehmerVersion` künftiger
 * Termine; unnötige Schreibvorgänge entwerten Einteilungen.
 *
 * - **Name:** getrimmt und **zeichengenau** verglichen. „Pruefspieler a“ → „Pruefspieler A“
 *   ist eine Änderung (der Server erlaubt die Korrektur der Schreibweise).
 * - **Skills:** Nur gültige Eingaben (`skillZahl`) zählen. Ein leeres Feld ist „nichts
 *   eingetragen“, auch bei einer Kategorie, die in der Karte fehlt. Ungültige Eingaben meldet
 *   das Formular selbst und sperrt „Speichern“.
 *
 * @param vorher Name und Karte, wie der Server sie lieferte.
 * @param jetzt Name und Texteingaben je Kategorie.
 * @param kategorien Die aktiven Kategorien (Wertebereiche).
 * @returns Das Geänderte oder `null`, wenn nichts geändert ist (Speichern gesperrt).
 */
export function profilAenderung(
  vorher: { name: string; skills: Record<string, number> },
  jetzt: { name: string; skills: Record<string, string> },
  kategorien: SkillKategorie[],
): { name?: string; skills?: Record<string, number> } | null {
  const ergebnis: { name?: string; skills?: Record<string, number> } = {}

  const name = jetzt.name.trim()
  if (name !== vorher.name) ergebnis.name = name

  const eingaben: Record<string, number> = {}
  for (const kategorie of kategorien) {
    const zahl = skillZahl(jetzt.skills[kategorie.schluessel] ?? '', kategorie)
    if (zahl !== null) eingaben[kategorie.schluessel] = zahl
  }
  const skills = skillsAenderung(vorher.skills, eingaben)
  if (Object.keys(skills).length > 0) ergebnis.skills = skills

  return ergebnis.name === undefined && ergebnis.skills === undefined ? null : ergebnis
}
