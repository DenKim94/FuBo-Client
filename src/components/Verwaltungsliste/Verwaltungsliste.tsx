import { Link } from 'react-router'
import Icon from '@/components/Icon/Icon'
import style from './Verwaltungsliste.module.scss'

/** Ein Eintrag der Liste. */
export type Verwaltungseintrag = {
  /** Ziel des Links. */
  to: string
  /** Name des Bereichs. */
  titel: string
  /** Ein Satz dazu, was man dort tut. */
  text: string
  /** Optionales Symbol aus `public/icons/` ohne Endung (schmückend). */
  symbol?: string
  /** Test-ID des Links. */
  'data-testid': string
}

/** Eine Gruppe von Einträgen unter einer Überschrift. */
export type Verwaltungsgruppe = {
  titel: string
  eintraege: Verwaltungseintrag[]
}

/** Eigenschaften der Verwaltungsliste. */
type VerwaltungslisteEigenschaften = {
  gruppen: Verwaltungsgruppe[]
  /** Test-ID der Navigation. */
  'data-testid'?: string
}

/**
 * Liste der Verwaltungsbereiche als Links (C7, 5.2, 6.2).
 *
 * Eine Navigation (`<nav aria-label="Verwaltung">`) mit je einer `<ul>` pro Gruppe;
 * jede Gruppe trägt eine `h2`. **Keine ARIA-Tab-Rollen:** Die Einträge führen zu
 * eigenen Ansichten, es schalten keine Tafeln um (wie die `TabLeiste`).
 *
 * Jede Zeile ist ein ganzer Link mit Titel, einem Satz und Pfeil; das Tap-Ziel ist
 * mindestens 56 px hoch (A2: einhändig, draußen). Der Pfeil ist reine Darstellung.
 */
export default function Verwaltungsliste({ gruppen, 'data-testid': testId = 'verwaltungsliste' }: VerwaltungslisteEigenschaften) {
  return (
    <nav aria-label="Verwaltung" className={style.liste} data-testid={testId}>
      {gruppen.map((gruppe) => (
        <section key={gruppe.titel} className={style.gruppe}>
          <h2 className={style.gruppenTitel}>{gruppe.titel}</h2>
          <ul className={style.eintraege}>
            {gruppe.eintraege.map((eintrag) => (
              <li key={eintrag.to}>
                <Link to={eintrag.to} className={style.zeile} data-testid={eintrag['data-testid']}>
                  {eintrag.symbol && (
                    <span className={style.symbol}>
                      <Icon name={eintrag.symbol} />
                    </span>
                  )}
                  <span className={style.texte}>
                    <span className={style.titel}>{eintrag.titel}</span>
                    <span className={style.untertitel}>{eintrag.text}</span>
                  </span>
                  <span className={style.pfeil} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  )
}
