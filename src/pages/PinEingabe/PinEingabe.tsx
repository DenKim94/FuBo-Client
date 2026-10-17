import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import PinFeld from '@/components/PinFeld/PinFeld'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { usePinPruefen } from '@/hooks/usePinPruefen'
import { useSperre } from '@/hooks/useSperre'
import style from './PinEingabe.module.scss'

/**
 * Länge der zentralen PIN: vier Ziffern (DESIGN.md, `PinAendernRequest`).
 * Bestimmt die Zahl der Kästchen und begrenzt die Eingabe.
 */
const PIN_LAENGE = 4

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Die PIN konnte nicht geprüft werden. Bitte versuche es erneut.'

/**
 * Erste Stufe des Logins: Eingabe der zentralen PIN (A1/A3, Screen 01 der Prototypen).
 *
 * **Ein echtes Eingabefeld unter vier Kästchen** – siehe {@link PinFeld}, aus
 * dieser Ansicht herausgelöst (C4, 5.2).
 *
 * **Die Eingabe ist auf vier Zeichen begrenzt** (Entscheidung vom 03.10.2026),
 * passend zu den vier Kästchen. Der Kontrakt schreibt der PIN beim *Prüfen*
 * bewusst kein Format vor, damit ein abweichender Bestandswert aus
 * `FUBO_INITIAL_PIN` eingebbar bleibt; der Betrieb muss deshalb eine
 * vierstellige Anfangs-PIN setzen. Das Feld zwingt die Eingabe deshalb auch
 * nicht auf Ziffern (`nurZiffern={false}`). „Zutritt" ist ab dem ersten Zeichen
 * aktiv, abgeschickt wird erst auf Tipp – ein automatisches Absenden nach vier
 * Ziffern verbrauchte bei einem Vertipper einen der gedrosselten Versuche.
 *
 * **Kein Einstieg in die Admin-Anmeldung hier** (C4, E5): Sie verlangt serverseitig
 * `PIN_VERIFIED`, vor der PIN wäre sie nicht nutzbar. Der Link steht in der
 * Namensauswahl.
 *
 * **Nach dem Erfolg navigiert die Ansicht nicht selbst.** Die Sitzung steht dann
 * auf `PIN_VERIFIED`, und `LoginSchrittRoute` leitet zur Namensauswahl um.
 *
 * Bei einer Sperre (`429`) bleibt „Zutritt" für die vom Server genannte
 * Wartezeit gesperrt (`useSperre`). Danach verschwindet die Meldung, weil ihre
 * Zeitangabe nicht mehr stimmt.
 */
export default function PinEingabe() {
  const [pin, setPin] = useState('')
  const pruefung = usePinPruefen()
  const sperre = useSperre({ beimEnde: pruefung.reset })
  const hinweis = useNavigationsHinweis()
  const feld = useRef<HTMLInputElement>(null)

  const fehlerId = `${useId()}-fehler`

  // Die Ansicht hat genau eine Aufgabe; das Feld bekommt den Fokus sofort.
  useEffect(() => {
    feld.current?.focus()
  }, [])

  /** Schickt die PIN ab; reagiert auf Fehler mit geleertem Feld und Sperre. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (pin === '' || pruefung.isPending || sperre.aktiv) return

    hinweis.verbergen()
    pruefung.mutate(pin, {
      onError: (fehler) => {
        // Eine abgelehnte PIN wird geleert, damit der nächste Versuch nicht auf
        // den Resten des letzten aufbaut. Kam gar keine Antwort, war die PIN
        // nicht falsch – dann bleibt sie stehen.
        if (fehler instanceof ApiFehler) setPin('')
        sperre.ausFehler(fehler)
        feld.current?.focus()
      },
    })
  }

  const fehlerhaft = pruefung.error !== null

  return (
    <form className={style.pinEingabe} onSubmit={absenden} noValidate data-testid="pin-eingabe">
      <div className={style.bereich}>
        <img
          className={style.logo}
          src="/icons/pwa/app-icon-384.png"
          alt="app-icon"
          width={120}
          height={120}
          data-testid="pin-logo"
        />
        <h1 className={style.titel}>MONTAGS-KICKER</h1>

        {/* Nach einem erzwungenen Sitzungsende mit Begründung (C4, E4), etwa nach
            dem Passwortwechsel. Neutral, kein Fehler; weg mit der nächsten Eingabe. */}
        {hinweis.hinweis !== null && <Hinweis data-testid="pin-hinweis">{hinweis.hinweis}</Hinweis>}

        <PinFeld
          ref={feld}
          stellen={PIN_LAENGE}
          wert={pin}
          beiAenderung={(wert) => {
            hinweis.verbergen()
            setPin(wert)
          }}
          beschriftung="Eingabe der zentralen PIN"
          hinweis="Die PIN erhältst du von den Admins."
          fehlerhaft={fehlerhaft}
          beschriebenDurch={fehlerId}
          // Kein "one-time-code": iOS böte sonst Codes aus SMS an, und die
          // zentrale PIN ist kein Einmalcode.
          autoComplete="off"
          // Der Kontrakt schreibt beim Prüfen kein Format vor (siehe oben).
          nurZiffern={false}
          readOnly={pruefung.isPending}
        />

        {/* Bei einer Antwort des Servers dessen `detail` – er kennt Restversuche
            und Wartezeit genauer als der Client. Ein Netzfehler ersetzt hier den
            Offline-Hinweis. */}
        {fehlerhaft && (
          <Fehlermeldung id={fehlerId} fehler={pruefung.error} ersatz={FEHLER_ERSATZ} data-testid="pin-fehler" />
        )}
      </div>

      <Aktionsleiste>
        <CustomButton
          type="submit"
          art="primaer"
          breit
          laedt={pruefung.isPending}
          disabled={pin === '' || sperre.aktiv}
          data-testid="pin-absenden"
        >
          Absenden
        </CustomButton>
      </Aktionsleiste>
    </form>
  )
}
