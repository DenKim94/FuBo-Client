import type { SkillKategorie } from '@/api/admin/skills'
import {
  BESCHRIFTUNG_ABSTAND,
  FLAECHE,
  MITTE,
  RADIUS,
  anteil,
  ausrichtung,
  punkt,
  ringzahl,
  versatz,
  vieleck,
} from './netzdiagrammGeometrie'
import style from './Netzdiagramm.module.scss'

/** Eigenschaften des Netzdiagramms. */
type NetzdiagrammEigenschaften = {
  /** Die aktiven Kategorien in Anzeigereihenfolge: eine Achse je Kategorie. */
  kategorien: SkillKategorie[]
  /** Die Werte des Profils je Schlüssel; eine fehlende Kategorie liegt im Mittelpunkt und heisst „–“. */
  skills: Record<string, number>
  /** Test-ID der Zeichnung. */
  'data-testid'?: string
}

/** Mindestens drei Achsen ergeben ein Vieleck; darunter bleibt die Liste der Werte. */
const MIN_ACHSEN = 3

/**
 * Netzdiagramm der Skillwerte eines Profils (Prototyp 09c) als SVG.
 *
 * **Das Diagramm ist nie die einzige Quelle:** Jede Ecke trägt Name und Wert als Text, die Zeichnung hat als
 * Ganzes eine Beschreibung (`role="img"`), und die Ansicht zeigt dieselben Werte noch einmal als Liste. Die
 * Achsen entstehen aus den **Kategorien des Servers**, nichts ist auf fünf Achsen festgelegt; ihre Zahl, Namen und
 * Bereiche kommen von dort. Mit weniger als {@link MIN_ACHSEN} Kategorien ergibt sich kein Vieleck, dann entfällt
 * die Zeichnung.
 *
 * Farben nur über Variablen: Raster in der Randfarbe, Fläche und Linie in der Primärfarbe.
 */
export default function Netzdiagramm({ kategorien, skills, 'data-testid': testId = 'netzdiagramm' }: NetzdiagrammEigenschaften) {
  const anzahl = kategorien.length
  if (anzahl < MIN_ACHSEN) return null

  const spanne = Math.max(...kategorien.map((k) => k.maxWert - k.minWert))
  const ringe = Array.from({ length: ringzahl(spanne) }, (_, i) => (RADIUS * (i + 1)) / ringzahl(spanne))
  const werte = kategorien.map((k) => skills[k.schluessel])
  const abstaende = kategorien.map((k, i) => RADIUS * anteil(werte[i], k.minWert, k.maxWert))
  const beschreibung = `Netzdiagramm: ${kategorien
    .map((k, i) => `${k.bezeichnung} ${werte[i] === undefined ? 'nicht bewertet' : String(werte[i])}`)
    .join(', ')}`

  return (
    <svg
      className={style.zeichnung}
      viewBox={`0 0 ${String(FLAECHE.breite)} ${String(FLAECHE.hoehe)}`}
      role="img"
      aria-label={beschreibung}
      data-testid={testId}
    >
      {ringe.map((radius) => (
        <polygon key={radius} className={style.ring} points={vieleck(Array<number>(anzahl).fill(radius))} />
      ))}
      {kategorien.map((k, i) => {
        const ende = punkt(i, anzahl, RADIUS)
        return <line key={k.schluessel} className={style.achse} x1={MITTE.x} y1={MITTE.y} x2={ende.x} y2={ende.y} />
      })}
      <polygon className={style.flaeche} points={vieleck(abstaende)} />
      {abstaende.map((abstand, i) => {
        const p = punkt(i, anzahl, abstand)
        return <circle key={kategorien[i]?.schluessel} className={style.ecke} cx={p.x} cy={p.y} r={4.5} />
      })}
      {kategorien.map((k, i) => {
        const p = punkt(i, anzahl, RADIUS + BESCHRIFTUNG_ABSTAND)
        const wert = werte[i]
        return (
          <text
            key={k.schluessel}
            className={style.beschriftung}
            x={p.x}
            y={p.y + versatz(i, anzahl)}
            textAnchor={ausrichtung(i, anzahl)}
          >
            <tspan x={p.x}>{k.bezeichnung}</tspan>
            <tspan x={p.x} dy="1.2em" className={style.wert}>
              {wert === undefined ? '–' : wert}
            </tspan>
          </text>
        )
      })}
    </svg>
  )
}
