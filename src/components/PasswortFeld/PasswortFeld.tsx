import { useEffect, useRef, useState } from 'react'
import { PASSWORT_MAX_LAENGE } from '@/api/auth/passwortRegeln'
import Feld, { type FeldEigenschaften } from '@/components/Feld/Feld'
import style from './PasswortFeld.module.scss'

/** Symbole des Umschalters (liegen in `public/icons/`, 24 × 24 px). */
const SYMBOL_ZEIGEN = '/icons/visibility_on_dark.png'
const SYMBOL_VERBERGEN = '/icons/visibility_off_dark.png'

/** Eigenschaften des Passwortfeldes: die des `Feld`, mit festen Vorgaben für Typ und Länge. */
type PasswortFeldEigenschaften = Omit<
  FeldEigenschaften,
  'type' | 'aktion' | 'maxLength' | 'autoComplete'
> & {
  /**
   * `current-password` für ein vorhandenes Passwort (Anmeldung, bisheriges
   * Passwort), `new-password` für ein neues. Damit füllen Passwortmanager richtig
   * und schlagen beim neuen ein starkes vor.
   */
  autoComplete: 'current-password' | 'new-password'
  /** Test-ID des Eingabeelements; der Umschalter erhält dieselbe mit `-zeigen`. */
  'data-testid'?: string
}

/**
 * Passwortfeld mit Auge-Umschalter (C4, 5.3).
 *
 * **Der Umschalter ist Pflicht, nicht Zugabe:** Ohne Wiederholungsfeld (E3) ist
 * er die einzige Kontrolle gegen Tippfehler im neuen Passwort. Er ist ein
 * `<button type="button" aria-pressed>`, nur mit einem Auge-Symbol (ohne
 * Text) und mindestens `--tapziel-min` breit und hoch.
 *
 * **Name und Zustand getrennt:** Der Name ist fest („Passwort anzeigen“),
 * `aria-pressed` meldet, ob das Passwort gerade lesbar ist. Ein Name, der mit
 * dem Zustand wechselte, ergäbe mit `aria-pressed` eine doppelte Aussage
 * („Passwort verbergen, gedrückt“).
 *
 * **Beim Absenden wird wieder verborgen:** Kommt ein Fehler zurück, bleibt das
 * Passwort nicht lesbar auf dem Bildschirm stehen – auf einem Gerät, das am
 * Spielfeldrand herumgereicht wird. Das Feld hängt sich dafür an das
 * `submit`-Ereignis seines Formulars (über die Schaltfläche als Anker), damit
 * keine Ansicht daran denken muss.
 *
 * **Nur das Symbol** (`visibility_on_dark.png` bzw. `visibility_off_dark.png`)
 * zeigt die **Aktion**, nicht den Zustand: offenes Auge = Passwort anzeigen,
 * durchgestrichenes Auge = verbergen. Das Bild ist schmückend (`alt=""`); den
 * Namen trägt `aria-label` an der Schaltfläche. Bewusst `<img>` statt `Icon`:
 * Beide Dateien sind PNG, `Icon` maskiert nur SVG.
 *
 * Feste Vorgaben für Passwörter: `maxLength` 72 (Kontrakt, BCrypt), **kein
 * Trimmen** (Leerzeichen im Passwort sind gültig), keine Großschreibung am
 * Satzanfang, keine Autokorrektur und keine Rechtschreibprüfung.
 */
export default function PasswortFeld({
  autoComplete,
  'data-testid': testId = 'passwort-feld',
  ...rest
}: PasswortFeldEigenschaften) {
  const [sichtbar, setSichtbar] = useState(false)
  const umschalter = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const formular = umschalter.current?.form
    if (!formular) return
    const verbergen = () => setSichtbar(false)
    formular.addEventListener('submit', verbergen)
    return () => formular.removeEventListener('submit', verbergen)
  }, [])

  return (
    <Feld
      {...rest}
      type={sichtbar ? 'text' : 'password'}
      autoComplete={autoComplete}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      maxLength={PASSWORT_MAX_LAENGE}
      data-testid={testId}
      aktion={
        <button
          ref={umschalter}
          type="button"
          className={style.umschalter}
          aria-label="Passwort anzeigen"
          aria-pressed={sichtbar}
          onClick={() => setSichtbar((aktuell) => !aktuell)}
          data-testid={`${testId}-zeigen`}
        >
          <img
            className={style.symbol}
            src={sichtbar ? SYMBOL_VERBERGEN : SYMBOL_ZEIGEN}
            alt=""
            width={24}
            height={24}
            data-testid={`${testId}-symbol`}
          />
        </button>
      }
    />
  )
}
