import { useId, useRef, useState, type SubmitEvent } from 'react'
import { neuesPasswortGueltig } from '@/api/auth/passwortRegeln'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import PasswortFeld from '@/components/PasswortFeld/PasswortFeld'
import PasswortRegeln from '@/components/PasswortRegeln/PasswortRegeln'
import { usePasswortAendern } from '@/hooks/usePasswortAendern'
import { useSperre } from '@/hooks/useSperre'
import style from './PasswortAendern.module.scss'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Das Passwort konnte nicht geändert werden. Bitte versuche es erneut.'

/**
 * Passwort ändern im angemeldeten Zustand (C4, Abschnitt 8), unter `AdminRoute`.
 *
 * **Nach dem Erfolg verlässt die Ansicht die Sitzung** (`usePasswortAendern`): Der
 * Server hat alle Adminsitzungen widerrufen. Die Ansicht navigiert nicht selbst;
 * der Hinweis steht danach auf der PIN-Eingabe.
 *
 * **Ein falsches bisheriges Passwort ist ein Eingabefehler**, kein Sitzungsende:
 * Text am Feld „Bisheriges Passwort“, nur dieses wird geleert, Fokus dorthin. Es
 * zählt auf denselben Brute-Force-Zähler wie die Anmeldung (`429 PIN_GESPERRT`).
 *
 * Das neue Passwort wird nicht wiederholt abgefragt (E3); „zeigen“ am Feld und die
 * Regelliste sind die Kontrolle gegen Tippfehler.
 */
export default function PasswortAendern() {
  const [alt, setAlt] = useState('')
  const [neu, setNeu] = useState('')
  const aenderung = usePasswortAendern()
  const sperre = useSperre({ beimEnde: aenderung.reset })
  const altFeld = useRef<HTMLInputElement>(null)

  const kennung = useId()
  const fehlerId = `${kennung}-fehler`
  const regelnId = `${kennung}-regeln`

  const absendenMoeglich = alt !== '' && neuesPasswortGueltig(neu)

  /** Schickt die Änderung ab. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!absendenMoeglich || aenderung.isPending || sperre.aktiv) return

    aenderung.mutate(
      { altesPasswort: alt, neuesPasswort: neu },
      {
        onError: (fehler) => {
          // Nur das abgelehnte bisherige Passwort wird geleert; das neue bleibt.
          if (fehler instanceof ApiFehler && fehler.code === 'ADMIN_PASSWORT_FALSCH') {
            setAlt('')
            altFeld.current?.focus()
          }
          sperre.ausFehler(fehler)
        },
      },
    )
  }

  const fehler = aenderung.error
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const felder = apiFehler?.status === 400 ? apiFehler.felder : undefined

  const altFehler =
    apiFehler?.code === 'ADMIN_PASSWORT_FALSCH' ? apiFehler.message : (felder?.altesPasswort ?? null)
  const neuFehler = felder?.neuesPasswort ?? null
  const kastenNoetig = fehler !== null && altFehler === null && neuFehler === null

  return (
    <form className={style.aendern} onSubmit={absenden} noValidate data-testid="passwort-aendern">
      <div className={style.bereich}>
        <h1 className={style.titel}>Passwort ändern</h1>

        <PasswortFeld
          ref={altFeld}
          beschriftung="Bisheriges Passwort"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          fehler={altFehler}
          beschriebenDurch={kastenNoetig ? fehlerId : undefined}
          autoComplete="current-password"
          readOnly={aenderung.isPending}
          data-testid="passwort-aendern-alt"
        />

        <PasswortFeld
          beschriftung="Neues Passwort"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          fehler={neuFehler}
          beschriebenDurch={regelnId}
          autoComplete="new-password"
          readOnly={aenderung.isPending}
          data-testid="passwort-aendern-neu"
        />
        <PasswortRegeln passwort={neu} id={regelnId} data-testid="passwort-aendern-regeln" />

        {kastenNoetig && (
          <Fehlermeldung
            id={fehlerId}
            fehler={fehler}
            ersatz={FEHLER_ERSATZ}
            data-testid="passwort-aendern-fehler"
          />
        )}
      </div>

      <Aktionsleiste>
        <CustomButton
          type="submit"
          art="primaer"
          breit
          laedt={aenderung.isPending}
          disabled={!absendenMoeglich || sperre.aktiv}
          data-testid="passwort-aendern-absenden"
        >
          Passwort ändern
        </CustomButton>
      </Aktionsleiste>
    </form>
  )
}
