import { useId, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { istWiederholbar } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Textlink from '@/components/Textlink/Textlink'
import { usePasswortAnfordern } from '@/hooks/usePasswortAnfordern'
import { useSperre } from '@/hooks/useSperre'
import style from './PasswortVergessen.module.scss'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Die PIN konnte nicht angefordert werden. Bitte versuche es erneut.'

/**
 * Passwort vergessen, Schritt 1 von 2 (C4, 7.1): fordert die Bestätigungs-PIN an.
 *
 * Der Server sendet eine fünfstellige PIN an die hinterlegte E-Mail-Adresse des
 * Admin-Kontos; die Adresse erscheint nie in der Antwort. Die Ansicht liegt hinter
 * der zentralen PIN (`PIN_VERIFIED`).
 *
 * **Angefordert wird nur auf Tipp.** Jede Anforderung entwertet die zuvor offene
 * PIN (und zählt auf drei je Stunde, `RESET_GEDROSSELT`); ein Aufruf beim Betreten
 * der Ansicht machte eine gerade eingetroffene E-Mail wertlos.
 *
 * Nach `204` geht es zu Schritt 2 – mit dem Zeitpunkt der Anforderung im
 * Navigationszustand, aus dem die Restgültigkeit gezeigt wird. Wer die PIN schon
 * hat, springt über den Link direkt dorthin (ohne Zeitpunkt).
 *
 * **Bei einem Fehler wird die Schaltfläche zu „Erneut versuchen“**, wenn ein
 * zweiter Versuch etwas ändern kann (`503 VERSAND_FEHLGESCHLAGEN`, Netzfehler):
 * Laut Kontrakt bleibt nach einem gescheiterten Versand kein Vorgang zurück.
 */
export default function PasswortVergessen() {
  const navigate = useNavigate()
  const anforderung = usePasswortAnfordern()
  const sperre = useSperre({ beimEnde: anforderung.reset })

  const fehlerId = `${useId()}-fehler`

  /** Löst die Anforderung aus. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (anforderung.isPending || sperre.aktiv) return

    anforderung.mutate(undefined, {
      onSuccess: () =>
        void navigate(ADMIN_PFADE.passwortNeu, { state: { angefordertUm: Date.now() } }),
      onError: (fehler) => sperre.ausFehler(fehler),
    })
  }

  const fehler = anforderung.error
  const erneut = fehler !== null && !sperre.aktiv && istWiederholbar(fehler)

  return (
    <form
      className={style.vergessen}
      onSubmit={absenden}
      noValidate
      data-testid="passwort-vergessen"
    >
      <div className={style.bereich}>
        <header className={style.kopf}>
          <p className={style.schritt} data-testid="passwort-vergessen-schritt">
            Schritt 1 von 2
          </p>
          <h1 className={style.titel}>Passwort zurücksetzen</h1>
        </header>
        <p className={style.text}>
          Nach Anforderung wird eine 5-stellige Bestätigungs-PIN an die hinterlegte E-Mail-Adresse des
          Admin-Kontos gesendet.
        </p>

        {fehler !== null && (
          <Fehlermeldung
            id={fehlerId}
            fehler={fehler}
            ersatz={FEHLER_ERSATZ}
            data-testid="passwort-vergessen-fehler"
          />
        )}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          <CustomButton
            type="submit"
            art="primaer"
            breit
            laedt={anforderung.isPending}
            disabled={sperre.aktiv}
            data-testid="passwort-vergessen-absenden"
          >
            {erneut ? 'Erneut versuchen' : 'PIN anfordern'}
          </CustomButton>
          <Textlink to={ADMIN_PFADE.passwortNeu} data-testid="passwort-vergessen-pin-vorhanden-link">
            Ich habe bereits eine PIN
          </Textlink>
        </div>
      </Aktionsleiste>
    </form>
  )
}
