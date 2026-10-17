import { NavLink } from 'react-router'
import style from './TabLeiste.module.scss'

/** Die vier Bereiche des Dashboards in fester Reihenfolge. */
const EINTRAEGE = [
  { pfad: '/', text: 'Termine', testId: 'tab-termine', ende: true },
  { pfad: '/teams', text: 'Teams', testId: 'tab-teams', ende: false },
  { pfad: '/ergebnisse', text: 'Ergebnisse', testId: 'tab-ergebnisse', ende: false },
  { pfad: '/verlauf', text: 'Verlauf', testId: 'tab-verlauf', ende: false },
] as const

/**
 * Menüleiste des Dashboards mit den Bereichen Termine, Teams, Ergebnisse und
 * Verlauf (C5, 9.1).
 *
 * **Vier Links, kein ARIA-Tab-Muster** (E11): Das Tab-Muster beschreibt das
 * Umschalten von Bereichen *auf derselben Seite* und verspricht Pfeiltasten und
 * einen einzigen Tabstopp. Hier wechselt die Route – jede Ansicht hat eine
 * Adresse (Lesezeichen, Zurück-Taste, später der Link aus einer Push-Meldung) –,
 * und ein `role="tab"` ließe Screenreader Bedienung erwarten, die es nicht gibt.
 * `NavLink` setzt `aria-current="page"` auf den aktiven Eintrag; für `/` mit
 * `end`, sonst wäre „Termine“ immer aktiv.
 *
 * Der aktive Eintrag trägt einen Balken, nicht nur eine andere Farbe. Text
 * statt Symbolen: Vier Wörter sind eindeutiger als vier Piktogramme.
 */
export default function TabLeiste() {
  return (
    <nav className={style.leiste} aria-label="Bereiche" data-testid="tab-leiste">
      <ul className={style.liste}>
        {EINTRAEGE.map((eintrag) => (
          <li key={eintrag.pfad}>
            <NavLink to={eintrag.pfad} end={eintrag.ende} className={style.eintrag} data-testid={eintrag.testId}>
              {eintrag.text}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
