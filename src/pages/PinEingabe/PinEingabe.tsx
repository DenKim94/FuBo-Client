import { useEffect, useId, useRef, useState, type CSSProperties, type SubmitEvent } from 'react'
import { Link } from 'react-router'
import { ApiFehler, fehlertextBilden } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import { usePinPruefen } from '@/hooks/usePinPruefen'
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
 * **Ein echtes Eingabefeld unter vier Kästchen.** Die Kästchen sind nur
 * Darstellung; darüber liegt ein durchsichtiges, natives `<input>` mit
 * `inputMode="numeric"`. Ein Tipp darauf öffnet die Zifferntastatur des Geräts –
 * kein nachgebauter Ziffernblock, der Tastatur, Screenreader, Einfügen und
 * Autofill erst nachbilden müsste.
 *
 * **Die Eingabe ist auf vier Zeichen begrenzt** (Entscheidung vom 03.10.2026),
 * passend zu den vier Kästchen. Der Kontrakt schreibt der PIN beim *Prüfen*
 * bewusst kein Format vor, damit ein abweichender Bestandswert aus
 * `FUBO_INITIAL_PIN` eingebbar bleibt; der Betrieb muss deshalb eine
 * vierstellige Anfangs-PIN setzen. „Zutritt" ist ab dem ersten Zeichen aktiv,
 * abgeschickt wird erst auf Tipp – ein automatisches Absenden nach vier Ziffern
 * verbrauchte bei einem Vertipper einen der gedrosselten Versuche.
 *
 * **Nach dem Erfolg navigiert die Ansicht nicht selbst.** Die Sitzung steht dann
 * auf `PIN_VERIFIED`, und `LoginSchrittRoute` leitet zur Namensauswahl um.
 *
 * Bei einer Sperre (`429`) bleibt „Zutritt" für die vom Server genannte
 * Wartezeit gesperrt. Danach verschwindet die Meldung, weil ihre Zeitangabe
 * nicht mehr stimmt.
 */
export default function PinEingabe() {
  const [pin, setPin] = useState('')
  const [sperreBis, setSperreBis] = useState<number | null>(null)
  const pruefung = usePinPruefen()
  const { reset: pruefungZuruecksetzen } = pruefung
  const feld = useRef<HTMLInputElement>(null)

  const id = useId()
  const hinweisId = `${id}-hinweis`
  const fehlerId = `${id}-fehler`

  // Die Ansicht hat genau eine Aufgabe; das Feld bekommt den Fokus sofort.
  useEffect(() => {
    feld.current?.focus()
  }, [])

  // Hebt die Sperre nach der Wartezeit des Servers auf.
  useEffect(() => {
    if (sperreBis === null) return
    const zeitgeber = window.setTimeout(() => {
      setSperreBis(null)
      pruefungZuruecksetzen()
    }, sperreBis - Date.now())
    return () => window.clearTimeout(zeitgeber)
  }, [sperreBis, pruefungZuruecksetzen])

  /** Schickt die PIN ab; reagiert auf Fehler mit geleertem Feld und Sperre. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (pin === '' || pruefung.isPending || sperreBis !== null) return

    pruefung.mutate(pin, {
      onError: (fehler) => {
        // Eine abgelehnte PIN wird geleert, damit der nächste Versuch nicht auf
        // den Resten des letzten aufbaut. Kam gar keine Antwort, war die PIN
        // nicht falsch – dann bleibt sie stehen.
        if (fehler instanceof ApiFehler) setPin('')
        if (fehler instanceof ApiFehler && fehler.code === 'PIN_GESPERRT' && fehler.wartesekunden) {
          setSperreBis(Date.now() + fehler.wartesekunden * 1000)
        }
        feld.current?.focus()
      },
    })
  }

  // Bei einer Antwort des Servers dessen `detail` – er kennt Restversuche und
  // Wartezeit genauer als der Client.
  const fehlertext = pruefung.error ? fehlertextBilden(pruefung.error, FEHLER_ERSATZ) : null
  const felderKlassen = [style.felder, fehlertext && pin === '' && style.fehlerhaft]
    .filter(Boolean)
    .join(' ')

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
        <label className={style.beschriftung} htmlFor={id}>
          Eingabe der zentralen PIN
        </label>

        <div className={felderKlassen}>
          <div
            className={style.kaestchen}
            style={{ '--kaestchen-anzahl': PIN_LAENGE } as CSSProperties}
            aria-hidden="true"
          >
            {Array.from({ length: PIN_LAENGE }, (_, i) => (
              <span
                key={i}
                className={[
                  style.kasten,
                  i < pin.length && style.gefuellt,
                  i === pin.length && style.naechstes,
                ]
                  .filter(Boolean)
                  .join(' ')}
                data-gefuellt={i < pin.length}
                data-testid="pin-kasten"
              />
            ))}
          </div>
          <input
            ref={feld}
            id={id}
            className={style.eingabe}
            type="text"
            // Öffnet die Zifferntastatur, ohne die Eingabe auf Ziffern zu zwingen.
            inputMode="numeric"
            // Kein "one-time-code": iOS böte sonst Codes aus SMS an, und die
            // zentrale PIN ist kein Einmalcode.
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            maxLength={PIN_LAENGE}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            // Während der Prüfung nur lesbar statt gesperrt: `disabled` nähme
            // dem Feld den Fokus und schlösse auf dem Telefon die Tastatur.
            readOnly={pruefung.isPending}
            aria-invalid={fehlertext ? true : undefined}
            aria-describedby={fehlertext ? `${hinweisId} ${fehlerId}` : hinweisId}
            data-testid="pin-feld"
          />
        </div>

        <p className={style.hinweis} id={hinweisId}>
          Die PIN erhältst du von den Admins.
        </p>

        {fehlertext && (
          <Fehlermeldung id={fehlerId} data-testid="pin-fehler">
            {fehlertext}
          </Fehlermeldung>
        )}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          <CustomButton
            type="submit"
            art="primaer"
            breit
            laedt={pruefung.isPending}
            disabled={pin === '' || sperreBis !== null}
            data-testid="pin-absenden"
          >
            Absenden
          </CustomButton>
          <Link className={style.adminLink} to="/admin/anmelden" data-testid="pin-admin-link">
            Als Admin anmelden
          </Link>
        </div>
      </Aktionsleiste>
    </form>
  )
}
