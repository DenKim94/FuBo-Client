import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'
import { ApiFehler } from '@/api/common/fehler'
import { spieltMit } from '@/api/termine/teilnahme'
import { naechsterTermin } from '@/api/termine/terminZeit'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import TeamsAnzeige from '@/components/TeamsAnzeige/TeamsAnzeige'
import TeamsLeiste from '@/components/TeamsLeiste/TeamsLeiste'
import TerminKarte from '@/components/TerminKarte/TerminKarte'
import Textlink from '@/components/Textlink/Textlink'
import { useBegonnen } from '@/hooks/useBegonnen'
import { useSitzung } from '@/hooks/useSitzung'
import { useTermin } from '@/hooks/useTermin'
import { useTermine } from '@/hooks/useTermine'
import { useTerminParameter } from '@/hooks/useTerminParameter'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import style from './TeamsSeite.module.scss'

/**
 * Tab „Teams“ (`/teams`) und Teams eines gewählten Termins (`teams/:terminId`),
 * C5, 10.1 und 10.2.
 *
 * **Welcher Termin?** Mit Parameter dieser; die Adresse wird geprüft, bevor etwas
 * abgerufen wird (ungültig heißt „nicht gefunden“). Ohne Parameter der nächste
 * geplante Termin (E13). Beide Wege enden in derselben Ansicht.
 */
export default function TeamsSeite() {
  const { vorhanden, gueltig, terminId } = useTerminParameter()

  if (vorhanden && (!gueltig || terminId === undefined)) return <NichtGefunden />
  if (terminId !== undefined) return <TeamsTermin key={terminId} terminId={terminId} />
  return <TeamsHub />
}

/** Bestimmt den nächsten geplanten Termin (E2) und zeigt dessen Teams. */
function TeamsHub() {
  const termine = useTermine()
  const liste = termine.data

  if (!liste) {
    return termine.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Termine werden geladen" />
    ) : (
      <Fehlerzustand fehler={termine.error} erneut={() => void termine.refetch()} data-testid="teams-fehler-zustand" />
    )
  }

  const { termin } = naechsterTermin(liste)
  if (!termin) {
    return (
      <Leerzustand
        titel="Kein Termin geplant"
        text="Sobald der Admin einen Termin anlegt, kannst du hier die Teams generieren."
        titelEbene={1}
        data-testid="teams-leer"
      />
    )
  }
  return <TeamsTermin key={termin.terminId} terminId={termin.terminId} />
}

/**
 * Teams eines Termins: Karte, Einteilung (oder „Noch keine Einteilung“) und Leiste.
 *
 * **`teams = null` ist ein Zustand, kein leerer Wert:** „Noch keine Einteilung“ hat
 * einen eigenen Leerzustand. Die Einteilung kommt aus dem Einzeltermin mit dessen
 * Polling, damit eine fremde Generierung und „veraltet“ ohne Neuladen erscheinen.
 *
 * **Kontingent:** Der Einzeltermin nennt das Restkontingent der eigenen Sitzung (`kontingentGenerierung`, seit
 * 22.10.2026); die Leiste sperrt bei `uebrig = 0` sofort. Einen eigenen Merker nach `409 KONTINGENT_ERSCHOEPFT`
 * braucht die Seite nicht mehr: Der Hook liest danach neu, und der Server-Wert sperrt.
 *
 * Wie `TerminAnsicht` ist die Leiste das letzte Element der Seite, damit sie über
 * dem ganzen Inhalt unten haftet.
 */
function TeamsTermin({ terminId }: { terminId: number }) {
  const abfrage = useTermin(terminId)
  const termin = abfrage.data
  const begonnen = useBegonnen(termin)
  const { sitzung, istGast, istAdmin } = useSitzung()
  const ueberschriftRef = useRef<HTMLHeadingElement>(null)
  // Zählt erfolgreiche Läufe: Jeder setzt den Fokus einmal auf die Überschrift.
  const [fokusAnfragen, setFokusAnfragen] = useState(0)

  useEffect(() => {
    if (fokusAnfragen > 0) ueberschriftRef.current?.focus()
  }, [fokusAnfragen])

  let inhalt: ReactNode
  let leiste: ReactNode = null

  if (termin) {
    const geplant = termin.status === 'GEPLANT'
    const liste = termin.teilnehmerliste
    const teams = termin.teams ?? null
    const nachladefehler = abfrage.failureReason
    // Generieren dürfen der Admin (wie am Server) und wer mitspielt: zugesagt und – strenger als der Server, Vorgabe
    // des Entwicklers vom 22.10.2026 – nicht auf der Warteschlange. Auch „Du kannst die Teams neu generieren“ gilt nur dann.
    const berechtigt = istAdmin || spieltMit(termin, sitzung?.anzeigeName, istGast)

    inhalt = (
      <>
        {nachladefehler && <Fehlermeldung fehler={nachladefehler} data-testid="teams-seite-fehler" />}
        <TerminKarte termin={termin} ebene={1} kompakt />
        {termin.status === 'ABGESAGT' && <Hinweis data-testid="teams-abgesagt">Dieser Termin wurde abgesagt.</Hinweis>}
        {teams && (
          <TeamsAnzeige
            teams={teams}
            eigenerName={sitzung?.anzeigeName}
            eigenerGast={istGast}
            ueberschriftRef={ueberschriftRef}
            neuGenerierbar={geplant && !begonnen && berechtigt}
          />
        )}
        {!teams && termin.status !== 'ABGESAGT' && (
          <Leerzustand
            titel="Noch keine Einteilung"
            text={
              geplant
                ? 'Sobald jemand die Teams generiert hat, erscheinen sie hier. Sei der erste!'
                : 'Für diesen Termin wurde keine Einteilung erzeugt.'
            }
            data-testid="teams-nicht-generiert"
          />
        )}
      </>
    )

    if (geplant) {
      leiste = (
        <TeamsLeiste
          terminId={termin.terminId}
          vorhanden={teams !== null}
          veraltet={teams?.veraltet ?? false}
          erzeugtVon={teams?.erzeugtVon}
          berechtigt={berechtigt}
          mindestzahlErreicht={liste.mindestzahlErreicht}
          minTeilnehmer={liste.minTeilnehmer}
          begonnen={begonnen}
          kontingent={termin.kontingentGenerierung}
          beiErfolg={() => setFokusAnfragen((n) => n + 1)}
        />
      )
    }
  } else if (abfrage.isPending) {
    inhalt = <Ladespinner groesse="gross" zentriert text="Termin wird geladen" />
  } else if (abfrage.error instanceof ApiFehler && abfrage.error.code === 'INHALT_NICHT_GEFUNDEN') {
    inhalt = (
      <Leerzustand
        titel="Termin nicht gefunden"
        text="Dieser Termin existiert nicht mehr."
        aktion={
          <Textlink to={LOGIN_PFADE.start} data-testid="teams-nicht-gefunden-zurueck">
            Zum Dashboard
          </Textlink>
        }
        data-testid="teams-nicht-gefunden"
      />
    )
  } else {
    inhalt = <Fehlerzustand fehler={abfrage.error} erneut={() => void abfrage.refetch()} data-testid="teams-fehler-zustand" />
  }

  return (
    <div className={style.seite} data-testid="teams-seite">
      <div className={style.inhalt}>{inhalt}</div>
      {leiste}
    </div>
  )
}
