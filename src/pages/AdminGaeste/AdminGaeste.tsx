import { useEffect, useRef, useState } from 'react'
import type { GastPlatzInfo } from '@/api/admin/adminKonfiguration'
import { zeitpunktKurz } from '@/api/termine/terminZeit'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Icon from '@/components/Icon/Icon'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useGaesteFreigeben } from '@/hooks/admin/useGaesteFreigeben'
import { useGaesteInTerminen } from '@/hooks/admin/useGaesteInTerminen'
import { useGastplaetze } from '@/hooks/admin/useGastplaetze'
import GaesteInTerminen from './GaesteInTerminen'
import style from './AdminGaeste.module.scss'

const FEHLER_ERSATZ = 'Der Platz konnte nicht freigegeben werden. Bitte versuche es erneut.'

const STUFEN_TEXT = { STARK: 'Stark', MITTEL: 'Mittel', SCHWACH: 'Schwach' } as const

/** Ein belegter Platz ohne lebende Sitzung: Es sitzt niemand mehr dahinter, die Freigabe ist gefahrlos. */
function istVerwaist(platz: GastPlatzInfo): boolean {
  return platz.belegt && platz.sitzungGueltig === false
}

/**
 * Gäste-Verwaltung (`/admin/gaeste`): Gäste der kommenden Termine samt Stufe und die Gastplätze (C8 9.3, E13, E15).
 *
 * **Zwei Dinge, zwei Abschnitte.** „Gäste in Terminen“ sind die Zusagen von Gästen; dort ändert der Admin die Stufe
 * (seit 24.10.2026 nur noch hier, nicht mehr in der Terminverwaltung). „Gastplätze“ sind die **Anmeldungen**: Ein Platz
 * wird beim Abmelden frei, die Zusage bleibt. Ohne diese Trennung sähe der Admin nach dem Abmelden eines Gastes
 * „0 von n Plätzen belegt“ und keinen Gast, obwohl einer zugesagt hat (Befund vom 24.10.2026).
 *
 * **Gastplätze:**
 * Beantwortet die Frage „warum bekommt der nächste Gast keinen Platz?“: Oft ist ein Platz belegt, obwohl die Sitzung
 * abgelaufen ist (**verwaist**) – das räumt sonst erst der nächtliche Lauf auf. Die Liste zeigt die **belegten** Plätze
 * (auch unwirksame); freie stehen nur in der Zusammenfassung „n von m Plätzen belegt“ (n = belegte **wirksame**,
 * m = alle wirksamen; ein belegter unwirksamer Platz trägt stattdessen den Vermerk „wird nicht mehr vergeben“).
 *
 * **Freigeben meldet den Gast ab.** Darum fragt der Dialog bei einem Platz mit lebender Sitzung, bei einem verwaisten
 * nicht. „Verwaiste freigeben (n)“ sendet die `slotIds` der verwaisten Plätze – **nie `alle: true`** (E15), das träfe auch
 * aktive Gäste. Lesen ohne Polling: „Aktualisieren“ lädt neu, denn der Zustand ändert sich ohne Zutun des Admins.
 *
 * **Fokus:** Mit der Freigabe verschwindet die Zeile samt Schaltfläche; der Fokus geht auf die Überschrift (sonst liegt
 * er auf `body`).
 */
export default function AdminGaeste() {
  const abfrage = useGastplaetze()
  const gaeste = useGaesteInTerminen()
  const freigeben = useGaesteFreigeben()
  const [dialog, setDialog] = useState<GastPlatzInfo | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const ueberschrift = useRef<HTMLHeadingElement>(null)
  const [fokusUeberschrift, setFokusUeberschrift] = useState(0)
  const [terminMeldung, setTerminMeldung] = useState<string | null>(null)
  const termineTitel = useRef<HTMLHeadingElement>(null)
  const [fokusTermine, setFokusTermine] = useState(0)

  // Nach einer Freigabe gehört der Fokus auf die Überschrift (die Schaltfläche ist mit der Zeile verschwunden).
  useEffect(() => {
    if (fokusUeberschrift > 0) ueberschrift.current?.focus()
  }, [fokusUeberschrift])

  // Nach dem Entfernen eines Gastes: Fokus auf die Überschrift des Abschnitts (Zeile und Schaltfläche sind weg).
  useEffect(() => {
    if (fokusTermine > 0) termineTitel.current?.focus()
  }, [fokusTermine])

  const plaetze = abfrage.data
  if (!plaetze) {
    return abfrage.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Gäste werden geladen" />
    ) : (
      <Fehlerzustand fehler={abfrage.error} erneut={() => void abfrage.refetch()} data-testid="admin-gaeste-laden-fehler" />
    )
  }

  const belegte = plaetze.filter((p) => p.belegt)
  const verwaiste = belegte.filter(istVerwaist)
  const wirksam = plaetze.filter((p) => p.wirksam)
  const belegtWirksam = wirksam.filter((p) => p.belegt)

  async function ausfuehren(nummern: number[], text: string) {
    if (freigeben.isPending) return
    setMeldung(null)
    try {
      await freigeben.mutateAsync(nummern)
      setDialog(null)
      setMeldung(text)
      setFokusUeberschrift((n) => n + 1)
    } catch {
      // Der Fehler steht im Dialog oder, ohne Dialog, über der Liste.
    }
  }

  /** „Freigeben“ an einem Platz: verwaist ohne Rückfrage, sonst mit Dialog (der Gast wird abgemeldet). */
  function freigebenGeklickt(platz: GastPlatzInfo) {
    freigeben.reset()
    setMeldung(null)
    if (istVerwaist(platz)) void ausfuehren([platz.nummer], `Platz ${String(platz.nummer)} ist wieder frei.`)
    else setDialog(platz)
  }

  return (
    <section className={style.seite} data-testid="admin-gaeste">
      <h1 ref={ueberschrift} tabIndex={-1} className={style.titel}>
        Gäste
      </h1>

      <section className={style.abschnitt} aria-labelledby="admin-gaeste-termine-titel" data-testid="admin-gaeste-termine">
        <h2 id="admin-gaeste-termine-titel" ref={termineTitel} tabIndex={-1} className={style.abschnittTitel}>
          Gäste in Terminen
        </h2>
        <p className={style.nebentext}>
          Die Stufe gilt je Termin. Sie bestimmt, wie ein Gast bei der Teamgenerierung zählt.
        </p>
        {terminMeldung !== null && <Hinweis data-testid="admin-gaeste-termine-hinweis">{terminMeldung}</Hinweis>}
        {gaeste.fehler && <Fehlermeldung fehler={gaeste.fehler} data-testid="admin-gaeste-termine-fehler" />}
        {gaeste.daten === undefined ? (
          !gaeste.fehler && <Ladespinner text="Termine werden geladen" />
        ) : gaeste.daten.length === 0 ? (
          <p data-testid="admin-gaeste-termine-leer">Für kommende Termine hat kein Gast zugesagt.</p>
        ) : (
          <GaesteInTerminen
            termine={gaeste.daten}
            plaetze={plaetze}
            beiEntfernt={(text) => {
              setTerminMeldung(text)
              setFokusTermine((n) => n + 1)
            }}
          />
        )}
      </section>

      <section className={style.abschnitt} aria-labelledby="admin-gaeste-plaetze-titel" data-testid="admin-gaeste-plaetze">
        <h2 id="admin-gaeste-plaetze-titel" className={style.abschnittTitel}>
          Gastplätze
        </h2>
        <p className={style.zusammenfassung} data-testid="admin-gaeste-zusammenfassung">
          {String(belegtWirksam.length)} von {String(wirksam.length)} Plätzen belegt
        </p>
        <p className={style.nebentext}>
          Ein Platz ist belegt, solange ein Gast angemeldet ist. Meldet er sich ab, wird der Platz frei; seine Zusagen
          bleiben bestehen.
        </p>

        {meldung !== null && <Hinweis data-testid="admin-gaeste-hinweis">{meldung}</Hinweis>}
        {abfrage.isError && <Fehlermeldung fehler={abfrage.error} data-testid="admin-gaeste-aktualisieren-fehler" />}
        {dialog === null && freigeben.isError && (
          <Fehlermeldung fehler={freigeben.error} ersatz={FEHLER_ERSATZ} data-testid="admin-gaeste-fehler" />
        )}

        {belegte.length === 0 ? (
          <p data-testid="admin-gaeste-leer">Zurzeit ist kein Gast angemeldet.</p>
        ) : (
          <ul className={style.liste}>
            {belegte.map((platz) => {
              const verwaist = istVerwaist(platz)
              return (
                <li key={platz.nummer} className={style.karte} data-testid={`admin-gast-${String(platz.nummer)}`}>
                  <div className={style.kopf}>
                    <h3 className={style.platz}>Platz {String(platz.nummer)}</h3>
                    <p className={style.name} data-testid={`admin-gast-name-${String(platz.nummer)}`}>
                      {platz.gastName}
                    </p>
                  </div>
                  <p className={style.angabe}>
                    {platz.gastStufe ? `Stufe: ${STUFEN_TEXT[platz.gastStufe]}` : ''}
                    {platz.gastStufe && platz.belegtSeit ? ' · ' : ''}
                    {platz.belegtSeit ? `seit ${zeitpunktKurz(platz.belegtSeit)}` : ''}
                  </p>
                  <p className={style.zustand} data-testid={`admin-gast-zustand-${String(platz.nummer)}`}>
                    <span className={style.symbol}>
                      <Icon name={verwaist ? 'warning_icon' : 'check_circle_icon'} />
                    </span>
                    <span>{verwaist ? 'Sitzung abgelaufen' : 'angemeldet'}</span>
                  </p>
                  {!platz.wirksam && (
                    <p className={style.angabe} data-testid={`admin-gast-unwirksam-${String(platz.nummer)}`}>
                      wird nicht mehr vergeben
                    </p>
                  )}
                  <CustomButton
                    art={verwaist ? 'sekundaer' : 'gefahrUmriss'}
                    aria-label={`Platz ${String(platz.nummer)} freigeben`}
                    laedt={freigeben.isPending && freigeben.variables?.includes(platz.nummer)}
                    onClick={() => {
                      freigebenGeklickt(platz)
                    }}
                    data-testid={`admin-gast-freigeben-${String(platz.nummer)}`}
                  >
                    Freigeben
                  </CustomButton>
                </li>
              )
            })}
          </ul>
        )}

        {verwaiste.length > 0 && (
          <CustomButton
            art="primaer"
            laedt={freigeben.isPending && dialog === null && freigeben.variables?.length === verwaiste.length}
            onClick={() => {
              freigeben.reset()
              void ausfuehren(
                verwaiste.map((p) => p.nummer),
                verwaiste.length === 1 ? `Platz ${String(verwaiste[0].nummer)} ist wieder frei.` : `${String(verwaiste.length)} Plätze sind wieder frei.`,
              )
            }}
            data-testid="admin-gaeste-verwaiste"
          >
            Verwaiste freigeben ({String(verwaiste.length)})
          </CustomButton>
        )}
      </section>

      <CustomButton
        art="sekundaer"
        laedt={abfrage.isFetching || gaeste.laedt}
        onClick={() => void Promise.all([abfrage.refetch(), gaeste.neuLesen()])}
        data-testid="admin-gaeste-aktualisieren"
      >
        Aktualisieren
      </CustomButton>

      <Bestaetigung
        offen={dialog !== null}
        titel="Platz freigeben?"
        bestaetigenText="Platz freigeben"
        art="gefahr"
        laedt={freigeben.isPending}
        fehler={dialog !== null ? freigeben.error : null}
        fehlerErsatz={FEHLER_ERSATZ}
        beiBestaetigen={() => {
          if (dialog) void ausfuehren([dialog.nummer], `Platz ${String(dialog.nummer)} ist wieder frei.`)
        }}
        beiAbbruch={() => {
          freigeben.reset()
          setDialog(null)
        }}
        data-testid="admin-gaeste-freigeben-dialog"
      >
        <p>
          {dialog?.gastName ?? 'Der Gast'} wird sofort abgemeldet. Der Platz wird frei und kann neu vergeben werden.
        </p>
      </Bestaetigung>
    </section>
  )
}
