import type { ReactNode } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import type { TerminDetails } from '@/api/termine/termine'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fortschrittsbalken from '@/components/Fortschrittsbalken/Fortschrittsbalken'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import RueckmeldungLeiste from '@/components/RueckmeldungLeiste/RueckmeldungLeiste'
import Teilnehmerliste from '@/components/Teilnehmerliste/Teilnehmerliste'
import TerminKarte from '@/components/TerminKarte/TerminKarte'
import Textlink from '@/components/Textlink/Textlink'
import Zusagestatus from '@/components/Zusagestatus/Zusagestatus'
import { useBegonnen } from '@/hooks/useBegonnen'
import { useSitzung } from '@/hooks/useSitzung'
import { useTermin } from '@/hooks/useTermin'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'
import style from './TerminAnsicht.module.scss'

/** Eigenschaften der Termin-Ansicht. */
type TerminAnsichtEigenschaften = {
  /** Technischer Schlüssel des Termins. */
  terminId: number
  /** Teilnehmerliste zugeklappt (Dashboard, E9) oder offen (Termin-Ansicht). */
  eingeklappt: boolean
  /** Verweise auf Teams und Ergebnis unter dem Inhalt (Termin-Ansicht, 8). */
  verweise?: boolean
  /**
   * Weitere Inhalte der Seite, die **vor** der Aktionsleiste stehen (Dashboard:
   * „Weitere Termine“). Die Leiste ist das letzte Element der Ansicht, damit sie
   * über den ganzen Inhalt unten haftet.
   */
  children?: ReactNode
}

/**
 * Platzsatz unter dem Balken: „18 von 22 Plätzen belegt.“ bzw. „Alle 22 Plätze
 * belegt, 3 auf der Warteschlange.“ Aus Höchstzahl und der Zahl der `wartet`-Einträge.
 */
function platzsatz(termin: TerminDetails): string {
  const { maxTeilnehmer, teilnehmer } = termin.teilnehmerliste
  const wartende = teilnehmer.filter((e) => e.wartet).length
  if (wartende > 0) return `Alle ${maxTeilnehmer} Plätze belegt, ${wartende} auf der Warteschlange.`
  return `${termin.zusagen} von ${maxTeilnehmer} Plätzen belegt.`
}

/**
 * Ein Termin mit Karte, eigener Rückmeldung, Balken, Teilnehmerliste und
 * Aktionsleiste (C5, 6.5). Baustein von Dashboard (`/`) und Termin-Ansicht
 * (`termine/:terminId`): ein Baustein, damit die Logik nicht doppelt steht (E1).
 *
 * **Die Zahlen kommen aus einer Antwort:** Der Balken liest `zusagen` und
 * `mindestzahlErreicht` des Einzeltermins, nicht der Liste – beide können um
 * einen Polling-Takt auseinanderliegen, und im Detail gilt das Detail. Ob die
 * Mindestzahl erreicht ist, rechnet der Client nicht nach (A10).
 *
 * **Aktionen nur, solange sie möglich sind:** Bei `GEPLANT` und vor dem Beginn
 * steht die Leiste. Hat der Termin begonnen (Geräteuhr, nur Darstellung, E8),
 * ersetzt ein Satz sie; bei `ABGESAGT` und `ABGESCHLOSSEN` gibt es keinen
 * Aktionsbereich. Der Server entscheidet weiter (`409`).
 *
 * **Fehler:** ohne Daten ein `Fehlerzustand` mit „Erneut versuchen“ (nur bei
 * Netzfehler und `≥ 500`), mit Daten eine `Fehlermeldung` über dem stehenden
 * Inhalt. `404` heißt: Der Termin ist entfernt – Leerzustand mit Rückweg.
 */
export default function TerminAnsicht({ terminId, eingeklappt, verweise = false, children }: TerminAnsichtEigenschaften) {
  const abfrage = useTermin(terminId)
  const { sitzung, istGast } = useSitzung()
  const termin = abfrage.data
  const begonnen = useBegonnen(termin)

  let inhalt: ReactNode
  let leiste: ReactNode = null

  if (termin) {
    const liste = termin.teilnehmerliste
    const eigenerName = sitzung?.anzeigeName
    // Der eigene Eintrag: Name allein genügt nicht, ein Gast könnte wie ein Profil heißen.
    const eigener = liste.teilnehmer.find((e) => e.anzeigeName === eigenerName && e.gast === istGast)
    const geplant = termin.status === 'GEPLANT'
    const nachladefehler = abfrage.failureReason

    inhalt = (
      <>
        {nachladefehler && <Fehlermeldung fehler={nachladefehler} data-testid="termin-fehler-meldung" />}

        <TerminKarte termin={termin} ebene={1} />

        {geplant && (
          <>
            <Zusagestatus
              rueckmeldung={termin.eigeneRueckmeldung ?? null}
              wartet={eigener?.wartet}
              warteplatz={eigener?.wartet ? eigener.position - liste.maxTeilnehmer : undefined}
              data-testid="termin-zusagestatus"
            />
            <div className={style.zusagen}>
              <Fortschrittsbalken
                wert={termin.zusagen}
                ziel={liste.minTeilnehmer}
                erreicht={liste.mindestzahlErreicht}
                data-testid="termin-balken"
              />
              <p className={style.platzsatz} data-testid="termin-platzsatz">
                {platzsatz(termin)}
              </p>
            </div>
            {begonnen && (
              <Hinweis data-testid="termin-begonnen">
                Der Termin hat begonnen. Rückmeldungen sind nicht mehr möglich.
              </Hinweis>
            )}
          </>
        )}
        {termin.status === 'ABGESAGT' && <Hinweis data-testid="termin-abgesagt">Dieser Termin wurde abgesagt.</Hinweis>}
        {termin.status === 'ABGESCHLOSSEN' && (
          <Hinweis data-testid="termin-abgeschlossen">Dieser Termin ist abgeschlossen.</Hinweis>
        )}

        {termin.status !== 'ABGESAGT' && (
          <Teilnehmerliste
            liste={liste}
            eigenerName={eigenerName}
            eigenerGast={istGast}
            eingeklappt={eingeklappt}
            beendet={!geplant}
          />
        )}

        {verweise && geplant && (
          <Textlink to={`/teams/${termin.terminId}`} data-testid="termin-teams-link">
            Teams ansehen
          </Textlink>
        )}
        {verweise && termin.status === 'ABGESCHLOSSEN' && (
          <Textlink to={`/ergebnisse/${termin.terminId}`} data-testid="termin-ergebnis-link">
            Ergebnis ansehen
          </Textlink>
        )}
      </>
    )

    // Die Leiste nur, solange eine Rückmeldung möglich ist (E8).
    if (geplant && !begonnen) {
      leiste = <RueckmeldungLeiste eigeneRueckmeldung={termin.eigeneRueckmeldung ?? null} terminId={termin.terminId} />
    }
  } else if (abfrage.isPending) {
    inhalt = <Ladespinner groesse="gross" zentriert text="Termin wird geladen" />
  } else if (abfrage.error instanceof ApiFehler && abfrage.error.code === 'INHALT_NICHT_GEFUNDEN') {
    inhalt = (
      <Leerzustand
        titel="Termin nicht gefunden"
        text="Dieser Termin existiert nicht mehr. Vielleicht wurde er entfernt."
        aktion={
          <Textlink to={LOGIN_PFADE.start} data-testid="termin-nicht-gefunden-zurueck">
            Zum Dashboard
          </Textlink>
        }
        data-testid="termin-nicht-gefunden"
      />
    )
  } else {
    inhalt = <Fehlerzustand fehler={abfrage.error} erneut={() => void abfrage.refetch()} data-testid="termin-fehler" />
  }

  return (
    <div className={style.ansicht} data-testid="termin-ansicht">
      <div className={style.inhalt}>
        {inhalt}
        {children}
      </div>
      {leiste}
    </div>
  )
}
