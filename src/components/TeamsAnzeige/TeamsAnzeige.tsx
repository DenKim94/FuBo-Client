import type { Ref } from 'react'
import { zeitpunktKurz } from '@/api/termine/terminZeit'
import type { TeamEintrag, Teameinteilung } from '@/api/teams/teams'
import Hinweis from '@/components/Hinweis/Hinweis'
import Icon from '@/components/Icon/Icon'
import style from './TeamsAnzeige.module.scss'

/** Eigenschaften der Teamanzeige. */
type TeamsAnzeigeEigenschaften = {
  /** Die Einteilung, wie `TerminDetails.teams` sie liefert. */
  teams: Teameinteilung
  /** Anzeigename der eigenen Sitzung, um den eigenen Eintrag zu finden. */
  eigenerName: string | null | undefined
  /** `true` bei einer Gastsitzung; der Name allein genügt nicht, ein Gast könnte so heißen wie ein Profil. */
  eigenerGast: boolean
  /** Ziel für den Fokus nach einer Generierung (Überschrift der Einteilung). */
  ueberschriftRef?: Ref<HTMLHeadingElement>
  /** Die Seite bietet die Neugenerierung an: Der Hinweis „veraltet“ nennt dann den Weg. */
  neuGenerierbar?: boolean
  /** Test-ID des Behälters. */
  'data-testid'?: string
}

/**
 * Die Teameinteilung eines Termins in zwei Listen (A20a, A20b).
 *
 * **Keine Rangfolge:** Die Reihenfolge in `teamA` und `teamB` bedeutet nichts,
 * sie wird wie geliefert angezeigt. Ein Eintrag trägt Name, „(Gast)“, „(du)“ und
 * – genau einmal bei ungerader Zahl – „Auswechselspieler“ als Text mit Symbol.
 * **Keine Skillwerte, keine Teamstärke, keine Gast-Stufe:** Der Server liefert sie
 * nicht (A12), und die Anzeige erfindet nichts.
 *
 * **`veraltet` versteckt nichts:** Die Einteilung bleibt sichtbar, ein neutraler
 * Hinweis sagt, dass sich die Teilnehmerliste seitdem geändert hat. Jemand hat
 * die Aufstellung vielleicht schon vorgelesen.
 *
 * Überschriften: Die Einteilung ist `h2` (unter dem `h1` der Terminkarte) und
 * nimmt den Fokus nach einer Generierung, die Teams sind `h3`.
 */
export default function TeamsAnzeige({
  teams,
  eigenerName,
  eigenerGast,
  ueberschriftRef,
  neuGenerierbar = false,
  'data-testid': testId = 'teams-anzeige',
}: TeamsAnzeigeEigenschaften) {
  return (
    <div className={style.anzeige} data-testid={testId}>
      <h2 className={style.kopf} tabIndex={-1} ref={ueberschriftRef} data-testid={`${testId}-kopf`}>
        Letzte Einteilung am {zeitpunktKurz(teams.erzeugtAm)}
      </h2>

      {teams.veraltet && (
        <Hinweis data-testid={`${testId}-veraltet`}>
          Seit dieser Einteilung hat sich die Teilnehmerliste geändert.
          {neuGenerierbar && ' Du kannst die Teams neu generieren.'}
        </Hinweis>
      )}

      <Team name="Team A" kennung="a" eintraege={teams.teamA} eigenerName={eigenerName} eigenerGast={eigenerGast} testId={testId} />
      <Team name="Team B" kennung="b" eintraege={teams.teamB} eigenerName={eigenerName} eigenerGast={eigenerGast} testId={testId} />
    </div>
  )
}

/** Ein Team als Abschnitt mit Überschrift und Liste; die Zahl zählt den Auswechselspieler mit. */
function Team({
  name,
  kennung,
  eintraege,
  eigenerName,
  eigenerGast,
  testId,
}: {
  name: string
  kennung: string
  eintraege: readonly TeamEintrag[]
  eigenerName: string | null | undefined
  eigenerGast: boolean
  testId: string
}) {
  const titelId = `${testId}-${kennung}-titel`
  return (
    <section className={style.team} aria-labelledby={titelId} data-testid={`${testId}-${kennung}`}>
      <h3 id={titelId} className={style.teamTitel}>
        {name} ({eintraege.length})
      </h3>
      <ul className={style.liste}>
        {eintraege.map((eintrag) => {
          const eigen = eintrag.anzeigeName === eigenerName && eintrag.gast === eigenerGast
          return (
            <li key={`${eintrag.anzeigeName}-${String(eintrag.gast)}`} className={style.eintrag}>
              <span className={style.name}>
                {eintrag.anzeigeName}
                {eintrag.gast && ' (Gast)'}
                {eigen && ' (du)'}
              </span>
              {eintrag.auswechselspieler && (
                <span className={style.auswechsel} data-testid={`${testId}-auswechselspieler`}>
                  <Icon name="person_edit_dark" groesse={1.25} />
                  <span>Auswechselspieler</span>
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
