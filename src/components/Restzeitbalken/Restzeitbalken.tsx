import { useEffect, useState, type CSSProperties } from 'react'
import style from './Restzeitbalken.module.scss'

/** Eigenschaften des Restzeitbalkens. */
type RestzeitbalkenEigenschaften = {
  /** Ende der Gültigkeit als Millisekunden seit 1970. */
  ende: number
  /** Gesamte Gültigkeitsdauer in Millisekunden; sie bestimmt, wie voll der Balken beginnt. */
  dauer: number
  /** Test-ID der Spur; die Füllung erhält dieselbe mit `-fuellung`. */
  'data-testid'?: string
}

/** Takt der Anzeige: Ein Balken über 15 Minuten braucht keine Sekundenschritte. */
const TAKT_MS = 5_000

/**
 * Zeigt, wie viel von einer Gültigkeitsdauer noch übrig ist (C4, 7.2).
 *
 * **Reiner Schmuck** (`aria-hidden`): Die Aussage steht in einem festen Satz
 * daneben („Gültig bis 20:58 Uhr.“). Eine tickende Zahl läse ein Screenreader
 * nicht sinnvoll vor (Entscheidung aus C3, Ablauf-Dialog).
 *
 * **Die Geräteuhr ist nur Darstellung:** Ob eine PIN noch gilt, entscheidet der
 * Server (`409`). Läuft der Balken leer, ändert das nichts an der Bedienbarkeit.
 *
 * Eigene Komponente statt `Fortschrittsbalken`: Dieser zählt Zusagen
 * (`role="progressbar"`, „x von y Zusagen“) und passt weder in Text noch
 * Semantik zu einer Restzeit.
 */
export default function Restzeitbalken({
  ende,
  dauer,
  'data-testid': testId = 'restzeitbalken',
}: RestzeitbalkenEigenschaften) {
  const [jetzt, setJetzt] = useState(() => Date.now())

  useEffect(() => {
    const zeitgeber = window.setInterval(() => setJetzt(Date.now()), TAKT_MS)
    return () => window.clearInterval(zeitgeber)
  }, [])

  const anteil = Math.round(Math.min(1, Math.max(0, (ende - jetzt) / dauer)) * 100)

  return (
    <div className={style.spur} aria-hidden="true" data-testid={testId}>
      <div
        className={style.fuellung}
        style={{ '--fuellung-anteil': `${anteil}%` } as CSSProperties}
        data-testid={`${testId}-fuellung`}
      />
    </div>
  )
}
