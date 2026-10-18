import { useId, useState } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Dialog from '@/components/Dialog/Dialog'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import { useTeamsGenerieren } from '@/hooks/useTeamsGenerieren'
import style from './TeamsLeiste.module.scss'

/** Eigenschaften der Teams-Leiste. */
type TeamsLeisteEigenschaften = {
  /** Technischer Schlüssel des Termins. */
  terminId: number
  /** Es gibt schon eine Einteilung (`teams !== null`): Die Aktion heißt dann „neu generieren“. */
  vorhanden: boolean
  /** Die vorhandene Einteilung ist nicht mehr aktuell. */
  veraltet: boolean
  /** Wer die vorhandene Einteilung erzeugt hat (für die Rückfrage). */
  erzeugtVon?: string
  /** Server-Wert, nicht nachgerechnet (A10). */
  mindestzahlErreicht: boolean
  /** Server-Wert für den Grund-Text. */
  minTeilnehmer: number
  /** Der Termin hat begonnen: keine Aktion mehr, die Einteilung steht fest (E8). */
  begonnen: boolean
  /** Der Server hat für diese `teilnehmerVersion` `KONTINGENT_ERSCHOEPFT` gemeldet (E15). */
  gesperrtDurchKontingent: boolean
  /** Der Lauf meldete `KONTINGENT_ERSCHOEPFT`: Die Seite merkt sich die `teilnehmerVersion`. */
  beiKontingentErschoepft: () => void
  /** Ein Lauf war erfolgreich und die Daten sind neu gelesen: Die Seite setzt den Fokus. */
  beiErfolg: () => void
  /** Verbleibendes Kontingent; die Seite übergibt in C5 nichts, weil der Server die Zahl nicht liefert (E15). */
  kontingent?: { uebrig: number; max: number }
}

/** Rückfalltext für Fehler, die weder vom Server stammen noch Netzfehler sind. */
const FEHLER_ERSATZ = 'Die Teams konnten nicht generiert werden. Bitte versuche es erneut.'

/**
 * Die eine Aktion des Tabs „Teams“: Teams generieren bzw. neu generieren (A20a).
 *
 * | Zustand | Darstellung |
 * |---|---|
 * | `GEPLANT`, Mindestzahl erreicht, Kontingent offen | Aktion bedienbar |
 * | Mindestzahl nicht erreicht (Server-Wert) | `aria-disabled`, Grund mit Soll und Ist |
 * | Kontingent erschöpft (`409`) | `aria-disabled`, Grund und Weg zur Freigabe |
 * | begonnen | keine Aktion, Hinweis „Die Einteilung steht fest.“ |
 *
 * **Gesperrt heißt `aria-disabled`:** Der Fokus bleibt erreichbar und der Grund
 * wird vorgelesen (`aria-describedby`). Der Klick tut dann nichts.
 *
 * **Kontingent:** Der Server liefert nur den Fehler, nie die Zahl. Nach
 * `KONTINGENT_ERSCHOEPFT` ist die Aktion gesperrt, bis sich die
 * Teilnehmerliste ändert (die Seite hält den Merker). `KONTINGENT_ERSCHOEPFT`
 * ist **keine** Fehlermeldung, sondern der gesperrte Zustand mit Grund.
 *
 * **Rückfrage nur beim Ersetzen einer aktuellen Einteilung** (E16): Ein Lauf
 * löst die bisherige Einteilung ab und verbraucht Kontingent. Ist sie veraltet
 * oder gibt es keine, wird ohne Rückfrage generiert.
 *
 * Nach Erfolg meldet ein Statustext „Teams wurden generiert.“ und die Seite
 * setzt den Fokus auf die Überschrift der Einteilung. Ein Fehler steht als
 * `Fehlermeldung` über der Leiste.
 */
export default function TeamsLeiste({
  terminId,
  vorhanden,
  veraltet,
  erzeugtVon,
  mindestzahlErreicht,
  minTeilnehmer,
  begonnen,
  gesperrtDurchKontingent,
  beiKontingentErschoepft,
  beiErfolg,
  kontingent,
}: TeamsLeisteEigenschaften) {
  const generieren = useTeamsGenerieren(terminId)
  const [rueckfrage, setRueckfrage] = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const grundId = useId()
  const beschreibungId = useId()

  if (begonnen) {
    return (
      <div className={style.nurHinweis}>
        <Hinweis data-testid="teams-fixiert">Die Einteilung steht fest.</Hinweis>
      </div>
    )
  }

  const laedt = generieren.isPending
  // Reihenfolge der Gründe: Die fehlende Mindestzahl ist behebbar durch Zusagen, das Kontingent durch Zeit und Änderung.
  let grund: string | null = null
  if (!mindestzahlErreicht) {
    grund = `Mindestens ${String(minTeilnehmer)} Zusagen sind erforderlich.`
  } else if (gesperrtDurchKontingent) {
    grund =
      'Das Kontingent für diese Teilnehmerliste ist aufgebraucht. Eine Änderung der Teilnehmerliste setzt es zurück.'
  }
  const gesperrt = grund !== null

  // `KONTINGENT_ERSCHOEPFT` ist der gesperrte Zustand, keine Fehlermeldung.
  const fehler = generieren.error
  const kontingentFehler = fehler instanceof ApiFehler && fehler.code === 'KONTINGENT_ERSCHOEPFT'
  const meldung = generieren.isError && !kontingentFehler ? fehler : null

  /** Startet den Lauf; während eines Aufrufs tut ein zweiter Tipp nichts. */
  function lauf() {
    if (laedt) return
    setErfolg(false)
    generieren.mutate(undefined, {
      onSuccess: () => {
        setErfolg(true)
        beiErfolg()
      },
      onError: (e) => {
        if (e instanceof ApiFehler && e.code === 'KONTINGENT_ERSCHOEPFT') beiKontingentErschoepft()
      },
    })
  }

  /** Tipp auf die Aktion: gesperrt oder laufend nichts, eine aktuelle Einteilung erst nach Rückfrage. */
  function beimTipp() {
    if (gesperrt || laedt) return
    if (vorhanden && !veraltet) setRueckfrage(true)
    else lauf()
  }

  return (
    <>
      {meldung && (
        <div className={style.meldung}>
          <Fehlermeldung fehler={meldung} ersatz={FEHLER_ERSATZ} data-testid="teams-fehler" />
        </div>
      )}
      {erfolg && !generieren.isPending && generieren.isSuccess && (
        <p className={style.erfolg} role="status" data-testid="teams-erfolg">
          Teams wurden generiert.
        </p>
      )}
      <Aktionsleiste>
        {/* Ein Kind: Die Leiste legt ihre Kinder nebeneinander, Grund und Aktion gehören untereinander. */}
        <div className={style.spalte}>
          {kontingent && (
            <p className={style.kontingent} data-testid="teams-kontingent">
              noch {kontingent.uebrig} von {kontingent.max} Generierungen
            </p>
          )}
          {grund && (
            <p id={grundId} className={style.grund} data-testid="teams-grund">
              {grund}
            </p>
          )}
          <CustomButton
            art="primaer"
            breit
            className={style.aktion}
            laedt={laedt}
            aria-disabled={gesperrt ? true : undefined}
            aria-describedby={grund ? grundId : undefined}
            onClick={beimTipp}
            data-testid="teams-generieren"
          >
            {vorhanden ? 'Teams neu generieren' : 'Teams generieren'}
          </CustomButton>
          {/* Im Behälter der Leiste: Sie bleibt das letzte Element der Seite; geschlossen ist der Dialog nicht sichtbar. */}
          <Dialog
            offen={rueckfrage}
            titel="Teams neu generieren?"
            aufSchliessen={() => setRueckfrage(false)}
            beschreibungId={beschreibungId}
            data-testid="teams-ersetzen-dialog"
          >
            <p id={beschreibungId} className={style.text}>
              Die aktuelle Einteilung von {erzeugtVon ?? 'einem anderen Spieler'} wird ersetzt.
            </p>
            <div className={style.aktionen}>
              <CustomButton
                art="primaer"
                breit
                onClick={() => {
                  setRueckfrage(false)
                  lauf()
                }}
                data-testid="teams-ersetzen-bestaetigen"
              >
                Neu generieren
              </CustomButton>
              <CustomButton art="sekundaer" breit onClick={() => setRueckfrage(false)} data-testid="teams-ersetzen-abbrechen">
                Abbrechen
              </CustomButton>
            </div>
          </Dialog>
        </div>
      </Aktionsleiste>
    </>
  )
}
