import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import PinFeld from '@/components/PinFeld/PinFeld'
import { usePinAendern } from '@/hooks/admin/usePinAendern'
import style from './AdminPin.module.scss'

/** Stellenzahl der zentralen PIN (Kontrakt: `^\d{4}$`). */
const PIN_STELLEN = 4

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Die PIN konnte nicht geändert werden. Bitte versuche es erneut.'

/**
 * Zentrale PIN ändern (`/admin/pin`, C7 6.3, E19).
 *
 * **Eine Änderung mit Folgen für alle:** Der Server widerruft **alle** Sitzungen –
 * Spieler, Gäste und die des Admins – und gibt belegte Gastplätze frei. Deshalb
 * öffnet „PIN ändern“ erst eine `Bestaetigung`, die die Folgen nennt, bevor etwas
 * gesendet wird („gehört als Hinweis in die Bestätigung, nicht als Überraschung“).
 * Nach dem Erfolg räumt der **Hook** auf und leitet zur PIN-Eingabe (`usePinAendern`).
 *
 * **Die PIN steht sichtbar im Feld** (`PinFeld` zeigt Ziffern offen): Es ist ein
 * geteilter Code, kein persönliches Passwort. Eine Wiederholung entfällt wie beim
 * Passwort (C4, E3); die Sichtbarkeit ist die Kontrolle gegen Tippfehler.
 *
 * **Fehler:** Meldet der Server `400` mit `felder.neuePin`, schließt der Dialog und
 * der Text steht am Feld (dort ist etwas zu korrigieren). Jeder andere Fehler
 * steht **im Dialog**, der offen bleibt – ein zweiter Tipp wiederholt die Änderung.
 * Der Absenden-Knopf ist bis vier Ziffern `aria-disabled` mit Grund als Text (der
 * Fokus bleibt, der Grund wird vorgelesen).
 */
export default function AdminPin() {
  const [pin, setPin] = useState('')
  const [dialogOffen, setDialogOffen] = useState(false)
  const aenderung = usePinAendern()
  const grundId = useId()
  const pinFeld = useRef<HTMLInputElement>(null)
  const fokusNachDialog = useRef(false)

  // Der Fokus geht erst ins Feld, wenn der Dialog zu ist: `close()` gibt ihn sonst an den
  // Auslöser zurück (der Effekt des Dialogs läuft als Kind vor diesem).
  useEffect(() => {
    if (dialogOffen || !fokusNachDialog.current) return
    fokusNachDialog.current = false
    pinFeld.current?.focus()
  }, [dialogOffen])

  const vollstaendig = pin.length === PIN_STELLEN
  const apiFehler = aenderung.error instanceof ApiFehler ? aenderung.error : null
  const feldFehler = apiFehler?.status === 400 ? (apiFehler.felder?.neuePin ?? null) : null

  /** Öffnet die Bestätigung; gesendet wird erst dort. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!vollstaendig || aenderung.isPending) return
    setDialogOffen(true)
  }

  /**
   * Sendet die neue PIN. **`mutateAsync` mit `try`/`catch`:** Bei Erfolg beendet der Hook
   * die Sitzung, und die Seite wird ausgehängt; ein `mutate`-Rückruf käme nicht mehr an.
   */
  async function senden() {
    if (!vollstaendig || aenderung.isPending) return
    try {
      await aenderung.mutateAsync({ neuePin: pin })
    } catch (fehler) {
      // Ein Feldfehler gehört ans Feld, nicht in den Dialog.
      if (fehler instanceof ApiFehler && fehler.status === 400 && fehler.felder?.neuePin) {
        fokusNachDialog.current = true
        setDialogOffen(false)
      }
    }
  }

  return (
    <form className={style.seite} onSubmit={absenden} noValidate data-testid="admin-pin">
      <div className={style.bereich}>
        <h1 className={style.titel}>Zentrale PIN ändern</h1>
        <p className={style.text}>
          Die PIN erhalten die Spieler über deinen Weg. Alle Angemeldeten werden mit der Änderung abgemeldet.
        </p>

        <PinFeld
          ref={pinFeld}
          stellen={PIN_STELLEN}
          wert={pin}
          beiAenderung={(wert) => {
            // Mit der nächsten Eingabe hat der Fehler seine Aufgabe erfüllt.
            if (aenderung.isError) aenderung.reset()
            setPin(wert)
          }}
          beschriftung="Neue PIN"
          hinweis="Genau vier Ziffern."
          fehler={feldFehler}
          autoComplete="off"
          ausrichtung="start"
          readOnly={aenderung.isPending}
          testIdPraefix="admin-pin"
        />
      </div>

      <Aktionsleiste>
        {/* Ein Kind: Die Leiste legt ihre Kinder nebeneinander, Grund und Aktion gehören untereinander. */}
        <div className={style.aktionen}>
          {!vollstaendig && (
            <p id={grundId} className={style.nebentext} data-testid="admin-pin-grund">
              Bitte gib vier Ziffern ein.
            </p>
          )}
          <CustomButton
            type="submit"
            art="primaer"
            breit
            className={style.aktion}
            aria-disabled={!vollstaendig ? true : undefined}
            aria-describedby={!vollstaendig ? grundId : undefined}
            data-testid="admin-pin-absenden"
          >
            PIN ändern
          </CustomButton>

          {/* Im Behälter der Leiste: Sie bleibt das letzte Element der Seite; geschlossen ist der Dialog unsichtbar. */}
          <Bestaetigung
            offen={dialogOffen}
            titel="Zentrale PIN ändern?"
            bestaetigenText="PIN ändern"
            art="gefahr"
            laedt={aenderung.isPending}
            fehler={dialogOffen && feldFehler === null ? aenderung.error : null}
            fehlerErsatz={FEHLER_ERSATZ}
            beiBestaetigen={() => void senden()}
            beiAbbruch={() => setDialogOffen(false)}
            data-testid="admin-pin-dialog"
          >
            <p>
              Alle Angemeldeten werden sofort abgemeldet, auch Spieler und Gäste, und du selbst. Sie brauchen die neue
              PIN über deinen Weg. Teile sie vorher oder direkt danach mit.
            </p>
          </Bestaetigung>
        </div>
      </Aktionsleiste>
    </form>
  )
}
