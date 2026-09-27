import type { ReactNode } from 'react'
import style from './Aktionsleiste.module.scss'

/** Eigenschaften der Aktionsleiste. */
type AktionsleisteEigenschaften = {
  /** Die primäre Aktion der Ansicht, bei zwei Aktionen die wichtigere zuletzt. */
  children: ReactNode
}

/**
 * Hält die primäre Aktion einer Ansicht am unteren Rand, in Daumenreichweite (A2).
 *
 * Die Leiste klebt am unteren Rand und liegt **über** dem Home-Indicator, nicht
 * darunter. Sie ist bewusst eine Komponente und keine Klasse: Der Abstand zur
 * Safe Area und die Höhe müssen an einer Stelle stehen, sonst rutscht in einer
 * der acht Ansichten ab C3 die Schaltfläche unter den Bildschirmrand – und
 * genau dort ist sie im Vollbildmodus nicht mehr erreichbar.
 */
export default function Aktionsleiste({ children }: AktionsleisteEigenschaften) {
  return (
    <div className={style.leiste} data-testid="aktionsleiste">
      {children}
    </div>
  )
}
