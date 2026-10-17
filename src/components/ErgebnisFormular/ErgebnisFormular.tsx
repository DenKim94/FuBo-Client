import { useId, useState } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import type { Sieger } from '@/api/ergebnis/ergebnis'
import { ergebnisSatz } from '@/api/ergebnis/ergebnisText'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Dialog from '@/components/Dialog/Dialog'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import { useErgebnisErfassen } from '@/hooks/useErgebnisErfassen'
import style from './ErgebnisFormular.module.scss'

/** Eigenschaften des Ergebnisformulars. */
type ErgebnisFormularEigenschaften = {
  /** Technischer Schlüssel des Termins. */
  terminId: number
  /**
   * Der Lauf ist durch: Das Ergebnis steht am Server – eigenes (`vorhanden = false`) oder
   * das einer anderen Person (`vorhanden = true`, `409 ERGEBNIS_VORHANDEN`). Die Seite
   * zeigt dann statt des Formulars die Anzeige und setzt den Fokus.
   */
  beiAbschluss: (vorhanden: boolean) => void
}

/** Rückfalltext für Fehler, die weder vom Server stammen noch Netzfehler sind. */
const FEHLER_ERSATZ = 'Das Ergebnis konnte nicht eingetragen werden. Bitte versuche es erneut.'

/** Die drei Ausgänge in der Reihenfolge der Anzeige. */
const AUSGAENGE: { wert: Sieger; text: string; testId: string }[] = [
  { wert: 'A', text: 'Team A', testId: 'ergebnis-sieger-a' },
  { wert: 'B', text: 'Team B', testId: 'ergebnis-sieger-b' },
  { wert: 'U', text: 'Unentschieden', testId: 'ergebnis-sieger-u' },
]

/**
 * Formular zum Eintragen des Ergebnisses (A21, E17). Rendert Eingabe **und**
 * Aktionsleiste: Die Schaltfläche hängt am Zustand der Eingabe.
 *
 * **Der erste Eintrag gilt**, und ein Ergebnis lässt sich nicht löschen: Deshalb ein
 * dauerhafter Hinweis über der Schaltfläche **und** ein Bestätigungsdialog mit dem
 * Satz, der nachher dasteht. Mehrere tippen nach dem Abpfiff gleichzeitig.
 *
 * **„Deutlicher Sieg“ gibt es nur bei einem Sieg.** Bei „Unentschieden“ ist der Haken
 * gesperrt und wird zurückgesetzt, der Grund steht als Text – `true` bei `U` ist am
 * Server unzulässig, und `ergebnisErfassen` schickt dann ohnehin `false`.
 *
 * Ohne Auswahl ist die Schaltfläche `aria-disabled` mit Grund (der Fokus bleibt,
 * der Grund wird vorgelesen).
 *
 * **`409 ERGEBNIS_VORHANDEN` ist kein Fehler:** Jemand war schneller. Der Dialog
 * schließt, die Seite liest neu und zeigt dessen Ergebnis (E17). Alle anderen Fehler
 * stehen als `Fehlermeldung` über der Leiste; der zweite Tipp wiederholt.
 */
export default function ErgebnisFormular({ terminId, beiAbschluss }: ErgebnisFormularEigenschaften) {
  const erfassen = useErgebnisErfassen(terminId)
  const [sieger, setSieger] = useState<Sieger | null>(null)
  const [deutlich, setDeutlich] = useState(false)
  const [dialogOffen, setDialogOffen] = useState(false)
  const grundId = useId()
  const hinweisId = useId()
  const beschreibungId = useId()

  const laedt = erfassen.isPending
  const vorhandenFehler = erfassen.error instanceof ApiFehler && erfassen.error.code === 'ERGEBNIS_VORHANDEN'
  const meldung = erfassen.isError && !vorhandenFehler ? erfassen.error : null
  const gesperrt = sieger === null

  /** Wählt den Ausgang; „Unentschieden“ nimmt einen gesetzten Haken zurück. */
  function waehlen(neu: Sieger) {
    setSieger(neu)
    if (neu === 'U') setDeutlich(false)
  }

  /**
   * Schickt das Ergebnis; während eines Aufrufs tut ein zweiter Tipp nichts.
   *
   * **`mutateAsync` statt der Rückrufe von `mutate`:** Der Hook liest den Termin neu,
   * bevor die Mutation endet, und die Seite tauscht dann das Formular gegen die
   * Anzeige. Ein unmontiertes Formular bekäme die Rückrufe von `mutate` nicht mehr –
   * der Abschluss ginge verloren, und mit ihm Hinweis und Fokus. Das Versprechen von
   * `mutateAsync` löst unabhängig vom Einhängen auf.
   */
  async function senden() {
    if (sieger === null || laedt) return
    try {
      await erfassen.mutateAsync({ sieger, deutlich: sieger === 'U' ? false : deutlich })
      setDialogOffen(false)
      beiAbschluss(false)
    } catch (fehler) {
      setDialogOffen(false)
      if (fehler instanceof ApiFehler && fehler.code === 'ERGEBNIS_VORHANDEN') beiAbschluss(true)
    }
  }

  return (
    <>
      <div className={style.formular} data-testid="ergebnis-formular">
        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Wer hat gewonnen?</legend>
          {AUSGAENGE.map((ausgang) => (
            <label key={ausgang.wert} className={style.option}>
              <input
                type="radio"
                name="sieger"
                value={ausgang.wert}
                checked={sieger === ausgang.wert}
                onChange={() => waehlen(ausgang.wert)}
                data-testid={ausgang.testId}
              />
              <span>{ausgang.text}</span>
            </label>
          ))}
        </fieldset>

        <div className={style.deutlich}>
          <label className={style.option}>
            <input
              type="checkbox"
              checked={deutlich}
              disabled={sieger === 'U'}
              onChange={(e) => setDeutlich(e.target.checked)}
              aria-describedby={sieger === 'U' ? hinweisId : undefined}
              data-testid="ergebnis-deutlich"
            />
            <span>Deutlicher Sieg (Tordifferenz ab 3)</span>
          </label>
          {sieger === 'U' && (
            <p id={hinweisId} className={style.nebentext} data-testid="ergebnis-deutlich-grund">
              Nur bei einem Sieg möglich.
            </p>
          )}
        </div>
      </div>

      {meldung && (
        <div className={style.meldung}>
          <Fehlermeldung fehler={meldung} ersatz={FEHLER_ERSATZ} data-testid="ergebnis-fehler" />
        </div>
      )}

      <Aktionsleiste>
        {/* Ein Kind: Die Leiste legt ihre Kinder nebeneinander, Hinweis und Aktion gehören untereinander. */}
        <div className={style.spalte}>
          <p className={style.nebentext} data-testid="ergebnis-hinweis">
            Der erste Eintrag gilt. Ein Ergebnis lässt sich nicht löschen, nur der Admin kann es korrigieren.
          </p>
          {gesperrt && (
            <p id={grundId} className={style.nebentext} data-testid="ergebnis-grund">
              Bitte wähle den Ausgang.
            </p>
          )}
          <CustomButton
            art="primaer"
            breit
            className={style.aktion}
            aria-disabled={gesperrt ? true : undefined}
            aria-describedby={gesperrt ? grundId : undefined}
            onClick={() => {
              if (!gesperrt) setDialogOffen(true)
            }}
            data-testid="ergebnis-absenden"
          >
            Ergebnis eintragen
          </CustomButton>
          {/* Im Behälter der Leiste: Sie bleibt das letzte Element der Seite; geschlossen ist der Dialog nicht sichtbar. */}
          <Dialog
            offen={dialogOffen}
            titel="Ergebnis eintragen?"
            festhalten={laedt}
            aufSchliessen={() => setDialogOffen(false)}
            beschreibungId={beschreibungId}
            data-testid="ergebnis-dialog"
          >
            <div id={beschreibungId} className={style.dialogText}>
              <p className={style.zusammenfassung} data-testid="ergebnis-zusammenfassung">
                {sieger ? ergebnisSatz(sieger, deutlich) : ''}
              </p>
              <p>Der erste Eintrag gilt und lässt sich nicht löschen.</p>
            </div>
            <div className={style.aktionen}>
              <CustomButton art="primaer" breit laedt={laedt} onClick={() => void senden()} data-testid="ergebnis-bestaetigen">
                Eintragen
              </CustomButton>
              <CustomButton
                art="sekundaer"
                breit
                aria-disabled={laedt ? true : undefined}
                onClick={() => {
                  if (!laedt) setDialogOffen(false)
                }}
                data-testid="ergebnis-zurueck"
              >
                Zurück
              </CustomButton>
            </div>
          </Dialog>
        </div>
      </Aktionsleiste>
    </>
  )
}
