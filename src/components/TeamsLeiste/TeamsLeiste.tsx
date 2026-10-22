import { useId, useState } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import type { KontingentGenerierung } from '@/api/termine/termine'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Dialog from '@/components/Dialog/Dialog'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
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
  /**
   * Der Aufrufer darf generieren: der Admin, sonst wer mitspielt (zugesagt, nicht auf der Warteschlange; `spieltMit`).
   * Sonst ist die Aktion gesperrt (Vorgabe des Entwicklers vom 22.10.2026). Der Server lässt die Warteschlange zu, der
   * Client bewusst nicht.
   */
  berechtigt: boolean
  /** Server-Wert, nicht nachgerechnet (A10). */
  mindestzahlErreicht: boolean
  /** Server-Wert für den Grund-Text. */
  minTeilnehmer: number
  /** Der Termin hat begonnen: keine Aktion mehr, die Einteilung steht fest (E8). */
  begonnen: boolean
  /**
   * Restkontingent der eigenen Sitzung (`kontingentGenerierung` der Einzelansicht, Server-Wert seit 22.10.2026) oder
   * `null` (darf nicht generieren oder Termin nicht `GEPLANT`). `uebrig = 0` sperrt die Aktion sofort.
   */
  kontingent: KontingentGenerierung | null
  /** Ein Lauf war erfolgreich und die Daten sind neu gelesen: Die Seite setzt den Fokus. */
  beiErfolg: () => void
}

/** Rückfalltext für Fehler, die weder vom Server stammen noch Netzfehler sind. */
const FEHLER_ERSATZ = 'Die Teams konnten nicht generiert werden. Bitte versuche es erneut.'

/**
 * Die eine Aktion des Tabs „Teams“: Teams generieren bzw. neu generieren (A20a).
 *
 * | Zustand | Darstellung |
 * |---|---|
 * | `GEPLANT`, berechtigt, Mindestzahl erreicht, Kontingent offen | Aktion bedienbar |
 * | nicht zugesagt, abgesagt oder auf der Warteschlange (nicht Admin) | `aria-disabled`, Grund „Nur Teilnehmer …“ |
 * | Mindestzahl nicht erreicht (Server-Wert) | `aria-disabled`, Grund mit Soll und Ist |
 * | Kontingent erschöpft (`kontingent.uebrig = 0`) | `aria-disabled`, Grund und Weg zur Freigabe |
 * | begonnen | keine Aktion, Hinweis „Die Einteilung steht fest.“ |
 *
 * **Gesperrt heißt `aria-disabled`:** Der Fokus bleibt erreichbar und der Grund
 * wird vorgelesen (`aria-describedby`). Der Klick tut dann nichts.
 *
 * **Kontingent aus dem Termin** (seit 22.10.2026): Der Einzeltermin nennt das Restkontingent der eigenen Sitzung
 * (`kontingentGenerierung`). Nach dem letzten erlaubten Lauf liest der Hook den Termin neu, `uebrig` ist `0`, und
 * die Aktion ist **sofort** gesperrt – ohne einen Fehlversuch. Solange Läufe übrig sind, steht „noch x von y
 * Generierungen“ über der Aktion. Die Zahl ist eine Anzeige; durchgesetzt wird das Kontingent vom Server. Meldet
 * er trotzdem `KONTINGENT_ERSCHOEPFT` (jemand war schneller, Stand veraltet), ist das **keine** Fehlermeldung: Der
 * Hook liest neu, und `uebrig = 0` sperrt mit Grund. Eine Absage öffnet das Kontingent nicht, eine neue Zusage schon.
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
  berechtigt,
  mindestzahlErreicht,
  minTeilnehmer,
  begonnen,
  kontingent,
  beiErfolg,
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
  // Reihenfolge der Gründe: Wer nicht mitspielt, darf grundsätzlich nicht; die fehlende Mindestzahl ist behebbar
  // durch Zusagen, das Kontingent durch eine neue Zusage.
  let grund: string | null = null
  if (!berechtigt) {
    grund = 'Nur Teilnehmer des Termins dürfen den Team-Generator nutzen.'
  } else if (!mindestzahlErreicht) {
    grund = `Mindestens ${String(minTeilnehmer)} Zusagen sind erforderlich.`
  } else if (kontingent?.uebrig === 0) {
    grund = 'Das Kontingent für diese Teilnehmerliste ist aufgebraucht. Eine Änderung der Teilnehmerliste setzt es zurück.'
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
          {/* Nur solange etwas übrig ist und nichts anderes sperrt: Bei 0 sagt der Grund dasselbe genauer. */}
          {kontingent && !gesperrt && (
            <p className={style.kontingent} data-testid="teams-kontingent">
              noch {kontingent.uebrig} von {kontingent.erlaubt} {kontingent.erlaubt === 1 ? 'Generierung' : 'Generierungen'}
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
            <Knopfgruppe untereinander className={style.aktionen}>
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
            </Knopfgruppe>
          </Dialog>
        </div>
      </Aktionsleiste>
    </>
  )
}
