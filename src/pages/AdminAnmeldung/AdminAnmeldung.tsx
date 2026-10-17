import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Feld from '@/components/Feld/Feld'
import Hinweis from '@/components/Hinweis/Hinweis'
import PasswortFeld from '@/components/PasswortFeld/PasswortFeld'
import Textlink from '@/components/Textlink/Textlink'
import { useAdminAnmelden } from '@/hooks/useAdminAnmelden'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useSperre } from '@/hooks/useSperre'
import style from './AdminAnmeldung.module.scss'

/** Grenze des Anmeldenamens laut Kontrakt (`AdminAnmeldeRequest`). */
const NAME_MAX = 60

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.'

/**
 * Admin-Anmeldung (C4, Abschnitt 6): Anmeldename und Passwort.
 *
 * **Sie liegt hinter der zentralen PIN** (Stufe `PIN_VERIFIED`, C4 1.1) und ist
 * Geschwister der Namensauswahl; der Einstieg ist der Link dort. Nach dem Erfolg
 * navigiert die Ansicht **nicht selbst**: `LoginSchrittRoute` leitet nach
 * `zielFuerStufe` zur Administration.
 *
 * **Der Name wird zeichengenau verglichen** (Server). Deshalb `autoCapitalize="none"`
 * – iOS schriebe sonst das erste Zeichen groß, und ein Admin namens „admin"
 * könnte sich auf dem iPhone nie anmelden. Der Client trimmt weder Name noch
 * Passwort; Randleerzeichen des Namens entfernt der Server selbst.
 *
 * **Falsche Angaben stehen im Kasten, nicht an einem Feld:** Der Kontrakt lässt
 * `ADMIN_PASSWORT_FALSCH` bewusst offen, ob Name oder Passwort nicht stimmt. Das
 * Passwort wird geleert, der Name bleibt, der Fokus geht ins Passwortfeld.
 */
export default function AdminAnmeldung() {
  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const anmeldung = useAdminAnmelden()
  const sperre = useSperre({ beimEnde: anmeldung.reset })
  const hinweis = useNavigationsHinweis()
  const nameFeld = useRef<HTMLInputElement>(null)
  const passwortFeld = useRef<HTMLInputElement>(null)

  const fehlerId = `${useId()}-fehler`

  // Beim Betreten steht die Person vor dem ersten Feld.
  useEffect(() => {
    nameFeld.current?.focus()
  }, [])

  /** Schickt die Anmeldung ab. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (name === '' || passwort === '' || anmeldung.isPending || sperre.aktiv) return

    hinweis.verbergen()
    anmeldung.mutate(
      { anmeldename: name, passwort },
      {
        onError: (fehler) => {
          // Ein abgelehntes Passwort wird geleert; der Name bleibt. Bei jedem
          // anderen Fehler (Sperre, Serverfehler, keine Antwort) war nichts falsch
          // – dann bleibt alles stehen, und ein neuer Versuch ist ein Tipp.
          if (fehler instanceof ApiFehler && fehler.code === 'ADMIN_PASSWORT_FALSCH') {
            setPasswort('')
            passwortFeld.current?.focus()
          }
          sperre.ausFehler(fehler)
        },
      },
    )
  }

  const fehler = anmeldung.error
  // `400` nennt die betroffenen Felder; alles andere gehört in den Kasten.
  const felder = fehler instanceof ApiFehler && fehler.status === 400 ? fehler.felder : undefined
  const nameFehler = felder?.anmeldename ?? null
  const passwortFehler = felder?.passwort ?? null
  const kastenNoetig = fehler !== null && nameFehler === null && passwortFehler === null

  return (
    <form className={style.anmeldung} onSubmit={absenden} noValidate data-testid="admin-anmeldung">
      <div className={style.bereich}>
        <h1 className={style.titel}>Administration – Anmelden</h1>

        {hinweis.hinweis !== null && <Hinweis data-testid="admin-hinweis">{hinweis.hinweis}</Hinweis>}

        <Feld
          ref={nameFeld}
          beschriftung="Name"
          hinweis="Groß- und Kleinschreibung beachten"
          value={name}
          onChange={(e) => {
            hinweis.verbergen()
            setName(e.target.value)
          }}
          fehler={nameFehler}
          beschriebenDurch={kastenNoetig ? fehlerId : undefined}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={NAME_MAX}
          readOnly={anmeldung.isPending}
          data-testid="admin-name"
        />

        <PasswortFeld
          ref={passwortFeld}
          beschriftung="Passwort"
          value={passwort}
          onChange={(e) => {
            hinweis.verbergen()
            setPasswort(e.target.value)
          }}
          fehler={passwortFehler}
          beschriebenDurch={kastenNoetig ? fehlerId : undefined}
          autoComplete="current-password"
          readOnly={anmeldung.isPending}
          data-testid="admin-passwort"
        />

        {kastenNoetig && (
          <Fehlermeldung id={fehlerId} fehler={fehler} ersatz={FEHLER_ERSATZ} data-testid="admin-fehler" />
        )}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          <CustomButton
            type="submit"
            art="primaer"
            breit
            laedt={anmeldung.isPending}
            disabled={name === '' || passwort === '' || sperre.aktiv}
            data-testid="admin-absenden"
          >
            Anmelden
          </CustomButton>
          <Textlink to={ADMIN_PFADE.passwortVergessen} data-testid="admin-passwort-vergessen-link">
            Passwort vergessen?
          </Textlink>
        </div>
      </Aktionsleiste>
    </form>
  )
}
