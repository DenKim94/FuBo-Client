import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'
import { ApiFehler } from '@/api/common/fehler'
import BilanzKarte from '@/components/BilanzKarte/BilanzKarte'
import ErgebnisAnzeige from '@/components/ErgebnisAnzeige/ErgebnisAnzeige'
import ErgebnisFormular from '@/components/ErgebnisFormular/ErgebnisFormular'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import TeamsAnzeige from '@/components/TeamsAnzeige/TeamsAnzeige'
import TerminKarte from '@/components/TerminKarte/TerminKarte'
import Textlink from '@/components/Textlink/Textlink'
import { useSitzung } from '@/hooks/useSitzung'
import { useTermin } from '@/hooks/useTermin'
import { useTerminParameter } from '@/hooks/useTerminParameter'
import { useVerlauf } from '@/hooks/useVerlauf'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import style from './ErgebnisSeite.module.scss'

/**
 * Tab „Ergebnisse“ (`/ergebnisse`) und Ergebnis eines gewählten Termins
 * (`ergebnisse/:terminId`), C5, 10.3.
 *
 * **Welcher Termin?** Mit Parameter dieser; die Adresse wird geprüft, bevor etwas
 * abgerufen wird (ungültig heißt „nicht gefunden“). Ohne Parameter der zuletzt
 * abgeschlossene Termin (E13). Beide Wege enden in derselben Ansicht.
 */
export default function ErgebnisSeite() {
  const { vorhanden, gueltig, terminId } = useTerminParameter()

  if (vorhanden && (!gueltig || terminId === undefined)) return <NichtGefunden />
  if (terminId !== undefined) return <ErgebnisTermin key={terminId} terminId={terminId} />
  return <ErgebnisHub />
}

/** Bestimmt den zuletzt abgeschlossenen Termin und zeigt dessen Ergebnis. */
function ErgebnisHub() {
  const verlauf = useVerlauf()
  const daten = verlauf.data

  if (!daten) {
    return verlauf.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Termine werden geladen" />
    ) : (
      <Fehlerzustand
        fehler={verlauf.error}
        erneut={() => void verlauf.refetch()}
        data-testid="ergebnisse-fehler-zustand"
      />
    )
  }

  if (!daten.letzter) {
    // Die Bilanz bleibt sichtbar: Sie hängt nicht an einem einzelnen Termin.
    return (
      <div className={style.seite} data-testid="ergebnisse-seite">
        <div className={style.inhalt}>
          <BilanzKarte />
          <Leerzustand
            titel="Noch kein abgeschlossener Termin"
            text="Sobald ein Termin vorbei ist, kannst du hier das Ergebnis eintragen."
            data-testid="ergebnisse-leer"
          />
        </div>
      </div>
    )
  }
  return <ErgebnisTermin key={daten.letzter.terminId} terminId={daten.letzter.terminId} />
}

/**
 * Ergebnis eines Termins: Bilanz, Karte, Einteilung und – je nach Zustand – Anzeige,
 * Formular oder ein Hinweis (die Zustandsmatrix von C5, 10.3).
 *
 * | Status | Einteilung | Ergebnis | Zeigt |
 * |---|---|---|---|
 * | ABGESCHLOSSEN | – | ja | Anzeige |
 * | ABGESCHLOSSEN | ja | nein | Formular |
 * | ABGESCHLOSSEN | nein | nein | Leerzustand (ohne Einteilung kein Ergebnis) |
 * | GEPLANT | | | Hinweis „erst nach Abschluss“ |
 * | ABGESAGT | | | Hinweis „abgesagt“ |
 *
 * **`ERGEBNIS_VORHANDEN` ist ein Hinweis, kein Fehler** (E17): Jemand war schneller,
 * der Lauf endet in der Anzeige mit dem Satz „Das Ergebnis war bereits erfasst“. Nach
 * beiden Wegen springt der Fokus auf die Überschrift der Anzeige.
 *
 * Wie `TeamsTermin` ist das Formular mit seiner Leiste das letzte Element der Seite,
 * damit die Leiste über dem ganzen Inhalt unten haftet.
 */
function ErgebnisTermin({ terminId }: { terminId: number }) {
  const abfrage = useTermin(terminId)
  const termin = abfrage.data
  const { sitzung, istGast } = useSitzung()
  const ueberschriftRef = useRef<HTMLHeadingElement>(null)
  const [abschluss, setAbschluss] = useState<'erfasst' | 'vorhanden' | null>(null)
  // Zählt abgeschlossene Läufe: Jeder setzt den Fokus einmal auf die Überschrift.
  const [fokusAnfragen, setFokusAnfragen] = useState(0)

  // Der Fokus folgt, sobald die Anzeige da ist: Der Lauf meldet sich eventuell vor dem Render,
  // der den Termin mit Ergebnis zeigt, und die Überschrift existiert dann noch nicht.
  const hatErgebnis = termin?.ergebnis != null
  useEffect(() => {
    if (fokusAnfragen > 0 && hatErgebnis) ueberschriftRef.current?.focus()
  }, [fokusAnfragen, hatErgebnis])

  let inhalt: ReactNode
  let formular: ReactNode = null

  if (termin) {
    const teams = termin.teams ?? null
    const ergebnis = termin.ergebnis ?? null
    const nachladefehler = abfrage.failureReason
    let zustand: ReactNode

    if (termin.status === 'ABGESAGT') {
      zustand = <Hinweis data-testid="ergebnis-abgesagt">Dieser Termin wurde abgesagt.</Hinweis>
    } else if (termin.status === 'GEPLANT') {
      zustand = (
        <Hinweis data-testid="ergebnis-noch-nicht">
          Das Ergebnis lässt sich eintragen, sobald der Termin abgeschlossen ist.
        </Hinweis>
      )
    } else if (ergebnis) {
      zustand = (
        <>
          {abschluss && (
            <Hinweis data-testid={abschluss === 'vorhanden' ? 'ergebnis-vorhanden' : 'ergebnis-erfasst'}>
              {abschluss === 'vorhanden'
                ? 'Das Ergebnis war bereits erfasst; es gilt der erste Eintrag.'
                : 'Das Ergebnis wurde eingetragen.'}
            </Hinweis>
          )}
          <ErgebnisAnzeige ergebnis={ergebnis} ueberschriftRef={ueberschriftRef} />
        </>
      )
    } else if (teams) {
      formular = (
        <ErgebnisFormular
          terminId={termin.terminId}
          beiAbschluss={(vorhandenGewesen) => {
            setAbschluss(vorhandenGewesen ? 'vorhanden' : 'erfasst')
            setFokusAnfragen((n) => n + 1)
          }}
        />
      )
    } else {
      zustand = (
        <Leerzustand
          titel="Keine Einteilung"
          text="Für diesen Termin wurden keine Teams eingeteilt, ein Ergebnis lässt sich daher nicht eintragen."
          data-testid="ergebnis-ohne-einteilung"
        />
      )
    }

    inhalt = (
      <>
        {nachladefehler && <Fehlermeldung fehler={nachladefehler} data-testid="ergebnis-seite-fehler" />}
        <BilanzKarte />
        <TerminKarte termin={termin} ebene={1} kompakt />
        {teams && (
          <TeamsAnzeige teams={teams} eigenerName={sitzung?.anzeigeName} eigenerGast={istGast} />
        )}
        {zustand}
      </>
    )
  } else if (abfrage.isPending) {
    inhalt = <Ladespinner groesse="gross" zentriert text="Termin wird geladen" />
  } else if (abfrage.error instanceof ApiFehler && abfrage.error.code === 'INHALT_NICHT_GEFUNDEN') {
    inhalt = (
      <Leerzustand
        titel="Termin nicht gefunden"
        text="Dieser Termin existiert nicht mehr."
        aktion={
          <Textlink to={LOGIN_PFADE.start} data-testid="ergebnis-nicht-gefunden-zurueck">
            Zum Dashboard
          </Textlink>
        }
        data-testid="ergebnis-nicht-gefunden"
      />
    )
  } else {
    inhalt = (
      <Fehlerzustand
        fehler={abfrage.error}
        erneut={() => void abfrage.refetch()}
        data-testid="ergebnis-fehler-zustand"
      />
    )
  }

  return (
    <div className={style.seite} data-testid="ergebnisse-seite">
      <div className={style.inhalt}>{inhalt}</div>
      {formular}
    </div>
  )
}
