import type { ReactNode, Ref } from 'react'
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

/**
 * Farbe der Seitenlinie des Kopfbereichs je Status (seit 24.10.2026): grün geplant, rot abgesagt, grau abgeschlossen.
 * Die Linie wiederholt nur, was Text und Hinweis schon sagen; sie macht den Zustand auf einen Blick erkennbar.
 */
const KOPF_STATUS = {
  GEPLANT: style.geplant,
  ABGESAGT: style.abgesagt,
  ABGESCHLOSSEN: style.abgeschlossen,
} as const

/** Eigenschaften der Termin-Ansicht. */
type TerminAnsichtEigenschaften = {
  /** Technischer Schlüssel des Termins. */
  terminId: number
  /** Teilnehmerliste zugeklappt (Dashboard, E9) oder offen (Termin-Ansicht). */
  eingeklappt: boolean
  /** Verweise auf Teams und Ergebnis unter dem Inhalt (Termin-Ansicht, 8). */
  verweise?: boolean
  /**
   * Nur lesen (Admin, C7 E2): kein `Zusagestatus`, keine `RueckmeldungLeiste` und
   * keine Verweise auf Teams und Ergebnis. Der Admin hat weder eine Rückmeldung
   * (`409 PROFIL_GESCHUETZT`) noch einen Zusagestatus; die Ansicht darf ihm keinen
   * vortäuschen („Anmeldung ausstehend“ wäre falsch). Karte, Balken, Warteschlangensatz,
   * Teilnehmerliste und `children` bleiben.
   */
  nurLesen?: boolean
  /** Ebene der Überschrift der Terminkarte; Vorgabe 1. Das Admin-Dashboard setzt sie unter seine eigene Überschrift. */
  kartenEbene?: 1 | 2 | 3
  /**
   * Liest den Termin **ohne Polling** (`useTermin(terminId, 0)`, C7 4.1): Die Verwaltungsansicht des Admins
   * hält einen Stand, an dem ein Formular hängt; ein Abruf im Takt ersetzte ihn unter den Händen. Derselbe
   * Schlüssel wie beim Polling – Dashboard-Karte und Verwaltung teilen sich die Abfrage.
   */
  ohneAktualisierung?: boolean
  /** Fokusziel für die Überschrift der Terminkarte (siehe `TerminKarte`). */
  ueberschriftRef?: Ref<HTMLHeadingElement>
  /**
   * Weitere Inhalte der Seite, die **vor** der Aktionsleiste stehen (Dashboard:
   * „Weitere Termine“). Die Leiste ist das letzte Element der Ansicht, damit sie
   * über den ganzen Inhalt unten haftet.
   */
  children?: ReactNode
}

/**
 * Warteschlangensatz unter dem Balken: „Maximale Teilnehmerzahl von 22 erreicht,
 * 3 auf der Warteschlange.“ Aus Höchstzahl und der Zahl der `wartet`-Einträge.
 *
 * **Nur bei einer Warteschlange (`null` sonst):** Solange Plätze frei sind, sagt
 * der Balken alles Nötige; eine zweite Zahl („8 von 22 Plätzen belegt“) machte
 * den Kopf der Ansicht nur voller. Die Höchstzahl wird erst genannt, wenn sie
 * für die Person etwas bedeutet – ihre Zusage kann dann auf der Warteschlange landen.
 */
function warteschlangensatz(termin: TerminDetails): string | null {
  const { maxTeilnehmer, teilnehmer } = termin.teilnehmerliste
  const wartende = teilnehmer.filter((e) => e.wartet).length
  if (wartende === 0) return null
  return `Maximale Teilnehmerzahl von ${maxTeilnehmer} erreicht, ${wartende} auf der Warteschlange.`
}

/**
 * Ein Termin mit Karte, eigener Rückmeldung, Balken, Teilnehmerliste und
 * Aktionsleiste (C5, 6.5). Karte, Rückmeldung und Zusagenstand stehen in einem
 * **umrandeten Kopfbereich** (`termin-kopf`): Er trennt „worum geht es, wie
 * stehe ich da“ von der Teilnehmerliste und den weiteren Terminen darunter. Baustein von Dashboard (`/`) und Termin-Ansicht
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
export default function TerminAnsicht({
  terminId,
  eingeklappt,
  verweise = false,
  nurLesen = false,
  kartenEbene = 1,
  ohneAktualisierung = false,
  ueberschriftRef,
  children,
}: TerminAnsichtEigenschaften) {
  const abfrage = useTermin(terminId, ohneAktualisierung ? 0 : undefined)
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
    const wartesatz = geplant ? warteschlangensatz(termin) : null

    inhalt = (
      <>
        {nachladefehler && <Fehlermeldung fehler={nachladefehler} data-testid="termin-fehler-meldung" />}

        <div className={`${style.kopf} ${KOPF_STATUS[termin.status]}`} data-testid="termin-kopf">
          <TerminKarte termin={termin} ebene={kartenEbene} ueberschriftRef={ueberschriftRef} />

          {geplant && (
            <>
              {!nurLesen && (
                <Zusagestatus
                  rueckmeldung={termin.eigeneRueckmeldung ?? null}
                  wartet={eigener?.wartet}
                  warteplatz={eigener?.wartet ? eigener.position - liste.maxTeilnehmer : undefined}
                  data-testid="termin-zusagestatus"
                />
              )}
              <div className={style.zusagen}>
                <Fortschrittsbalken
                  wert={termin.zusagen}
                  ziel={liste.minTeilnehmer}
                  erreicht={liste.mindestzahlErreicht}
                  data-testid="termin-balken"
                />
                {wartesatz && (
                  <p className={style.wartesatz} data-testid="termin-wartesatz">
                    {wartesatz}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {geplant && begonnen && (
          <Hinweis data-testid="termin-begonnen">
            Der Termin hat begonnen. Rückmeldungen sind nicht mehr möglich.
          </Hinweis>
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

        {verweise && !nurLesen && geplant && (
          <Textlink to={`/teams/${termin.terminId}`} data-testid="termin-teams-link">
            Teams ansehen
          </Textlink>
        )}
        {verweise && !nurLesen && termin.status === 'ABGESCHLOSSEN' && (
          <Textlink to={`/ergebnisse/${termin.terminId}`} data-testid="termin-ergebnis-link">
            Ergebnis ansehen
          </Textlink>
        )}
      </>
    )

    // Die Leiste nur, solange eine Rückmeldung möglich ist (E8).
    if (geplant && !begonnen && !nurLesen) {
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
