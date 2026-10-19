/**
 * Geometrie des Netzdiagramms (reine Rechnung, ohne React): Ecken, Anteile und Ringe.
 * Der Mittelpunkt und der Radius sind Maße der Zeichenfläche (`viewBox`), nicht der Bildschirmpixel.
 */

/** Breite und Höhe der Zeichenfläche in Einheiten der `viewBox`. */
export const FLAECHE = { breite: 320, hoehe: 290 } as const

/** Mittelpunkt der Zeichenfläche. */
export const MITTE = { x: 160, y: 142 } as const

/** Radius des äußeren Rings. Klein genug, damit die Beschriftungen seitlich noch Platz haben. */
export const RADIUS = 72

/** Abstand der Beschriftung vom äußeren Ring. */
export const BESCHRIFTUNG_ABSTAND = 16

/** Ein Punkt der Zeichenfläche. */
export type Punkt = { x: number; y: number }

/**
 * Winkel der Achse `index` bei `anzahl` Achsen: Die erste zeigt nach oben, die weiteren folgen im Uhrzeigersinn.
 *
 * @param index Nummer der Achse ab 0.
 * @param anzahl Zahl der Achsen.
 * @returns Winkel im Bogenmaß (0 = rechts, `-π/2` = oben).
 */
export function winkel(index: number, anzahl: number): number {
  return -Math.PI / 2 + (index * 2 * Math.PI) / anzahl
}

/**
 * Punkt auf der Achse `index` im Abstand `abstand` vom Mittelpunkt.
 *
 * @param index Nummer der Achse ab 0.
 * @param anzahl Zahl der Achsen.
 * @param abstand Abstand vom Mittelpunkt in Einheiten der `viewBox`.
 */
export function punkt(index: number, anzahl: number, abstand: number): Punkt {
  const w = winkel(index, anzahl)
  return { x: MITTE.x + abstand * Math.cos(w), y: MITTE.y + abstand * Math.sin(w) }
}

/**
 * Anteil eines Werts an seinem Bereich, begrenzt auf 0 bis 1.
 *
 * Ein fehlender Wert (`undefined`, Karte mit Lücke) liegt im Mittelpunkt (0). Ein Bereich ohne Spanne (`min` = `max`)
 * gilt als voll, weil kein Wert darunter liegen kann.
 *
 * @param wert Der Wert oder `undefined`.
 * @param min Untere Grenze der Kategorie.
 * @param max Obere Grenze der Kategorie.
 */
export function anteil(wert: number | undefined, min: number, max: number): number {
  if (wert === undefined) return 0
  if (max <= min) return 1
  return Math.min(1, Math.max(0, (wert - min) / (max - min)))
}

/**
 * Zahl der Ringe: je Wertstufe einer, höchstens sechs; bei größerer Spanne vier gleich große Stufen.
 *
 * @param spanne Größte Spanne (`max - min`) der Kategorien.
 */
export function ringzahl(spanne: number): number {
  if (spanne <= 0) return 1
  return spanne <= 6 ? spanne : 4
}

/**
 * Ein Vieleck als Wert für das Attribut `points` einer SVG-Fläche.
 *
 * @param abstaende Abstand je Achse vom Mittelpunkt, in der Reihenfolge der Achsen.
 */
export function vieleck(abstaende: readonly number[]): string {
  return abstaende
    .map((abstand, index) => {
      const p = punkt(index, abstaende.length, abstand)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}

/**
 * Ausrichtung der Beschriftung zur Ecke: rechts der Mitte linksbündig, links rechtsbündig, oben und unten zentriert.
 *
 * @param index Nummer der Achse ab 0.
 * @param anzahl Zahl der Achsen.
 */
export function ausrichtung(index: number, anzahl: number): 'start' | 'middle' | 'end' {
  const kosinus = Math.cos(winkel(index, anzahl))
  if (kosinus > 0.3) return 'start'
  if (kosinus < -0.3) return 'end'
  return 'middle'
}

/**
 * Senkrechter Versatz der Beschriftung: Oberhalb der Mitte steht sie über der Ecke, unterhalb darunter.
 * Die Beschriftung hat zwei Zeilen (Name, Wert); der Versatz bezieht sich auf die Grundlinie der ersten.
 *
 * @param index Nummer der Achse ab 0.
 * @param anzahl Zahl der Achsen.
 */
export function versatz(index: number, anzahl: number): number {
  const sinus = Math.sin(winkel(index, anzahl))
  if (sinus < -0.5) return -22
  if (sinus > 0.5) return 12
  return -6
}
