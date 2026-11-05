import { useId, useState } from 'react'
import type { Kategoriepunkte } from '@/api/admin/adminTeams'
import type { SkillKategorie } from '@/api/admin/skills'
import { teamstaerkenZeilen } from '@/api/admin/teamstaerken'
import CustomButton from '@/components/CustomButton/CustomButton'
import style from './Teamstaerken.module.scss'

/** Eigenschaften der Teamstärken. */
type TeamstaerkenEigenschaften = {
  /** Punktsummen von Team A je Kategorie, ohne den Springer (`gesamtpunkteTeamA`). */
  teamA: Kategoriepunkte
  /** Punktsummen von Team B je Kategorie, ohne den Springer (`gesamtpunkteTeamB`). */
  teamB: Kategoriepunkte
  /** Aktive Kategorien aus `GET /admin/skills/lesen` für Beschriftung und Reihenfolge; fehlen sie, gilt die Antwort. */
  kategorien?: readonly SkillKategorie[]
  /** Anzeigename des Springers oder `null`/fehlend bei gerader Teilnehmerzahl. */
  springer?: string | null
  /** Präfix der Test-IDs: `<präfix>-umschalter`, `<präfix>-tabelle`, `<präfix>-zeile-<SCHLUESSEL>`, `<präfix>-springer`. */
  'data-testid'?: string
}

/**
 * Gesamtpunkte je Team und Kategorie nach der manuellen Generierung (Vertrag vom 05.11.2026, Vorgabe des Entwicklers).
 *
 * **Eingeklappt, bis der Admin sie öffnet:** Eine Schaltfläche „Teamstärken anzeigen“ blendet die Tabelle ein und aus
 * (`aria-expanded`, `aria-controls`; Muster wie `Erklaerung`, aber als beschriftete Schaltfläche, weil ein reines Symbol
 * die Aktion nicht nennt). Die Tabelle steht auch eingeklappt im Baum (`hidden`), damit `aria-controls` immer trifft.
 *
 * **Nur im Adminbereich (A12):** Summen über Skillwerte sind eine Bewertung. Die Komponente wird ausschließlich in
 * `AdminTeams` verwendet; die Werte kommen nur aus `POST /admin/teams/generieren`.
 *
 * **Ohne Springer:** Der Server rechnet ihn nicht mit (er spielt abwechselnd für beide Seiten). Ein Satz unter der
 * Tabelle sagt das; ohne Springer sagt er, dass alle berücksichtigt sind. Die Teamfarben in den Spaltenköpfen
 * wiederholen nur, was „Team A“/„Team B“ als Text sagt.
 */
export default function Teamstaerken({
  teamA,
  teamB,
  kategorien,
  springer,
  'data-testid': testId = 'teamstaerken',
}: TeamstaerkenEigenschaften) {
  const [offen, setOffen] = useState(false)
  const bereichId = useId()
  const titelId = useId()
  const zeilen = teamstaerkenZeilen(teamA, teamB, kategorien)

  return (
    <div className={style.teamstaerken}>
      <CustomButton
        art="sekundaer"
        breit
        symbol="data_table_icon_dark"
        aria-expanded={offen}
        aria-controls={bereichId}
        onClick={() => {
          setOffen((zustand) => !zustand)
        }}
        data-testid={`${testId}-umschalter`}
      >
        {offen ? 'Teamstärken ausblenden' : 'Teamstärken anzeigen'}
      </CustomButton>

      <div id={bereichId} className={style.bereich} hidden={!offen} data-testid={`${testId}-bereich`}>
        <table className={style.tabelle} aria-labelledby={titelId} data-testid={`${testId}-tabelle`}>
          <caption id={titelId} className={style.titel}>
            Gesamtpunkte je Team und Kategorie
          </caption>
          <thead>
            <tr>
              <th scope="col" className={style.kategorie}>
                Kategorie
              </th>
              <th scope="col" className={`${style.team} ${style.teamA}`}>
                <span className={style.marke} aria-hidden="true" />
                Team A
              </th>
              <th scope="col" className={`${style.team} ${style.teamB}`}>
                <span className={style.marke} aria-hidden="true" />
                Team B
              </th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((zeile) => (
              <tr key={zeile.schluessel} data-testid={`${testId}-zeile-${zeile.schluessel}`}>
                <th scope="row" className={style.kategorie}>
                  {zeile.bezeichnung}
                </th>
                <td className={style.zahl}>{zeile.a}</td>
                <td className={style.zahl}>{zeile.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className={style.nebentext} data-testid={`${testId}-springer`}>
          {springer
            ? `Der Springer (${springer}) ist in den Gesamtpunkten nicht berücksichtigt, weil er für beide Teams spielt.`
            : 'Es gibt keinen Springer; alle Eingeteilten sind berücksichtigt.'}
        </p>
      </div>
    </div>
  )
}
