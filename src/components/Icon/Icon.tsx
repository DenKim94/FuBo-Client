import type { CSSProperties } from 'react'
import style from './Icon.module.scss'

/** Eigenschaften des Icons. */
type IconEigenschaften = {
  /** Dateiname in `public/icons/` ohne Endung, z. B. `info_circle_icon`. */
  name: string
  /** Kantenlänge in rem. Vorgabe 1.5 (24 px). */
  groesse?: number
  /**
   * Beschriftung für Screenreader. Fehlt sie, gilt das Symbol als schmückend
   * und wird ausgeblendet – der Normalfall neben einem Text.
   */
  beschriftung?: string
}

/**
 * Zeigt ein Symbol aus `public/icons/` in der Farbe seiner Umgebung (C2, Abschnitt 6).
 *
 * Als CSS-Maske und nicht als Bild: Die vorhandenen SVG-Dateien tragen feste
 * Füllfarben und folgten sonst keinem Zustand – ein Symbol auf der
 * Primärschaltfläche bliebe grau, ein deaktiviertes kräftig. Als Maske liefert
 * `currentColor` die Farbe.
 *
 * Fehlt die Datei, verschwindet das Symbol lautlos. Deshalb prüft
 * `Icon.test.tsx`, dass jeder im Quellbaum benutzte Name in `public/icons/` liegt.
 */
export default function Icon({ name, groesse = 1.5, beschriftung }: IconEigenschaften) {
  return (
    <span
      className={style.icon}
      style={
        {
          '--icon-quelle': `url('/icons/${name}.svg')`,
          '--icon-groesse': `${groesse}rem`,
        } as CSSProperties
      }
      role={beschriftung ? 'img' : undefined}
      aria-label={beschriftung}
      aria-hidden={beschriftung ? undefined : true}
      data-testid={`icon-${name}`}
    />
  )
}
