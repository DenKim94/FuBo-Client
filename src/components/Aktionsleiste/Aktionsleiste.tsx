import { useEffect, useRef, type ReactNode } from 'react'
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
 *
 * **Sie verdeckt nichts, was den Fokus bekommt (WCAG 2.4.11):** Eine haftende Leiste liegt über dem unteren Rand der
 * Seite. Tabbt jemand zu einem Feld dicht über dem Rand, scrollt der Browser es nur bis an den Rand – dahinter die
 * Leiste. Deshalb meldet die Leiste ihre **tatsächliche** Höhe (sie wächst mit Zähler und Grund, etwa bei den Teams) als
 * `--aktionsleiste-ist` an die Wurzel; `global.scss` macht daraus `scroll-padding-bottom`.
 */
export default function Aktionsleiste({ children }: AktionsleisteEigenschaften) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const wurzel = document.documentElement
    const messen = () => {
      wurzel.style.setProperty('--aktionsleiste-ist', `${String(element.offsetHeight)}px`)
    }
    messen()
    const beobachter = new ResizeObserver(messen)
    beobachter.observe(element)
    return () => {
      beobachter.disconnect()
      wurzel.style.removeProperty('--aktionsleiste-ist')
    }
  }, [])

  return (
    <div ref={ref} className={style.leiste} data-testid="aktionsleiste">
      {children}
    </div>
  )
}
