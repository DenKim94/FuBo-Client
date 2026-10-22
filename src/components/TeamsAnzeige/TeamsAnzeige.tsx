import type { Ref } from 'react'
import { zeitpunktKurz } from '@/api/termine/terminZeit'
import type { Teameinteilung } from '@/api/teams/teams'
import Hinweis from '@/components/Hinweis/Hinweis'
import TeamListen from '@/components/TeamListen/TeamListen'
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
 * Die beiden Teamspalten stehen seit C8 in `TeamListen` (dort auch die Regeln zu „(Gast)“, „(du)“ und Auswechselspieler);
 * hier bleiben Kopf, Hinweis „veraltet“ und das Fokusziel.
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

      <TeamListen
        teamA={teams.teamA}
        teamB={teams.teamB}
        eigenerName={eigenerName}
        eigenerGast={eigenerGast}
        data-testid={testId}
      />
    </div>
  )
}
