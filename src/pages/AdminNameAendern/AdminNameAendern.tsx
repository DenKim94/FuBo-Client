import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiFehler, istWiederholbar } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Feld from '@/components/Feld/Feld'
import Textlink from '@/components/Textlink/Textlink'
import { useNameAnfordern } from '@/hooks/admin/useNameAnfordern'
import { useSperre } from '@/hooks/useSperre'
import style from './AdminNameAendern.module.scss'

/** Längste Eingabe: so lang darf ein Profilname sein (Kontrakt). */
const NAME_MAX = 60

/** Hinweis auf Schritt 2 nach der Anforderung. */
export const HINWEIS_PIN_GESENDET = 'Die PIN wurde an deine hinterlegte E-Mail-Adresse gesendet.'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Die PIN konnte nicht angefordert werden. Bitte versuche es erneut.'

/**
 * Anmeldenamen ändern, Schritt 1 (`/admin/name/aendern`, C7 6.4, E20): fordert die
 * Bestätigungs-PIN für einen neuen Namen an.
 *
 * Der Name ändert sich **noch nicht**: Der Server prüft ihn und schickt eine
 * fünfstellige PIN an die hinterlegte Adresse. Erst die Bestätigung (Schritt 2) setzt
 * ihn, und er gilt ab der **nächsten** Anmeldung; die Sitzung bleibt.
 *
 * **Angefordert wird nur auf Tipp.** Jede Anforderung entwertet die zuvor offene PIN
 * und zählt auf drei je Stunde; die Wiederholung im Hintergrund unterbleibt. Wer die PIN
 * schon hat, springt über den Link zu Schritt 2.
 *
 * **Gesendet wird der getrimmte Name** (die Anmeldung trimmt ebenfalls). Ein belegter
 * Name steht am Feld (`NAME_BELEGT`, es wurde nichts gesendet), alles andere im Kasten.
 * Bei `503 VERSAND_FEHLGESCHLAGEN` und Netzfehler wird die Schaltfläche zu „Erneut
 * versuchen“ – laut Kontrakt bleibt nach einem gescheiterten Versand nichts zurück.
 * Nach `202` geht es mit `mutateAsync` weiter, denn die Seite wird beim Wechsel ausgehängt.
 */
export default function AdminNameAendern() {
  const [name, setName] = useState('')
  const navigate = useNavigate()
  const anforderung = useNameAnfordern()
  const sperre = useSperre({ beimEnde: anforderung.reset })
  const nameFeld = useRef<HTMLInputElement>(null)
  const fehlerId = `${useId()}-fehler`

  const getrimmt = name.trim()

  // Beim Betreten steht die Person vor dem Feld.
  useEffect(() => {
    nameFeld.current?.focus()
  }, [])

  /** Fordert die PIN an und geht zu Schritt 2. */
  async function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (getrimmt === '' || anforderung.isPending || sperre.aktiv) return

    try {
      await anforderung.mutateAsync({ neuerName: getrimmt })
      void navigate(ADMIN_PFADE.nameBestaetigen, {
        state: { hinweis: HINWEIS_PIN_GESENDET, neuerName: getrimmt },
      })
    } catch (fehler) {
      sperre.ausFehler(fehler)
      if (fehler instanceof ApiFehler && fehler.code === 'NAME_BELEGT') nameFeld.current?.focus()
    }
  }

  const fehler = anforderung.error
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const felder = apiFehler?.status === 400 ? apiFehler.felder : undefined
  const nameFehler = apiFehler?.code === 'NAME_BELEGT' ? apiFehler.message : (felder?.neuerName ?? null)
  const kastenNoetig = fehler !== null && nameFehler === null
  const erneut = fehler !== null && !sperre.aktiv && istWiederholbar(fehler)

  return (
    <form className={style.seite} onSubmit={(e) => void absenden(e)} noValidate data-testid="admin-name-aendern">
      <div className={style.bereich}>
        <h1 className={style.titel}>Anmeldenamen ändern</h1>
        <p className={style.text}>
          Wir senden eine fünfstellige PIN an die hinterlegte E-Mail-Adresse. Der neue Name gilt erst nach der
          Bestätigung und ab deiner nächsten Anmeldung.
        </p>

        <Feld
          ref={nameFeld}
          beschriftung="Neuer Anmeldename"
          hinweis="Groß- und Kleinschreibung zählen."
          value={name}
          onChange={(e) => {
            // Mit der nächsten Eingabe hat ein Feldfehler seine Aufgabe erfüllt.
            if (anforderung.isError && !sperre.aktiv) anforderung.reset()
            setName(e.target.value)
          }}
          fehler={nameFehler}
          beschriebenDurch={kastenNoetig ? fehlerId : undefined}
          // Der Server vergleicht zeichengenau: iOS soll weder gross schreiben noch korrigieren.
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={NAME_MAX}
          readOnly={anforderung.isPending}
          data-testid="admin-name-neu"
        />

        {kastenNoetig && (
          <Fehlermeldung id={fehlerId} fehler={fehler} ersatz={FEHLER_ERSATZ} data-testid="admin-name-fehler" />
        )}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          <CustomButton
            type="submit"
            art="primaer"
            breit
            className={style.aktion}
            laedt={anforderung.isPending}
            disabled={getrimmt === '' || sperre.aktiv}
            data-testid="admin-name-anfordern"
          >
            {erneut ? 'Erneut versuchen' : 'PIN anfordern'}
          </CustomButton>
          <Textlink to={ADMIN_PFADE.nameBestaetigen} data-testid="admin-name-pin-vorhanden-link">
            Ich habe bereits eine PIN
          </Textlink>
        </div>
      </Aktionsleiste>
    </form>
  )
}
