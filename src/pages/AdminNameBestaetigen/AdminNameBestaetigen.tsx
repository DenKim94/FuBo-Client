import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import PinFeld from '@/components/PinFeld/PinFeld'
import Textlink from '@/components/Textlink/Textlink'
import { useNameBestaetigen } from '@/hooks/admin/useNameBestaetigen'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useSperre } from '@/hooks/useSperre'
import style from './AdminNameBestaetigen.module.scss'

/** Länge der Bestätigungs-PIN aus der E-Mail (Kontrakt: `^\d{5}$`). */
const NAME_PIN_LAENGE = 5

/** Hinweis auf dem Dashboard nach dem Erfolg. */
export const HINWEIS_NAME_GEAENDERT = 'Anmeldename geändert. Er gilt ab der nächsten Anmeldung.'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Der Anmeldename konnte nicht geändert werden. Bitte versuche es erneut.'

/**
 * Liest den angeforderten Namen aus dem Navigationszustand (reine Anzeige).
 *
 * @param zustand Der Navigationszustand, beliebigen Typs.
 * @returns Der Name oder `null` (Direkteinstieg über „Ich habe bereits eine PIN“, nach einem Neuladen).
 */
function neuerNameLesen(zustand: unknown): string | null {
  const wert = (zustand as { neuerName?: unknown } | null)?.neuerName
  return typeof wert === 'string' && wert !== '' ? wert : null
}

/**
 * Anmeldenamen ändern, Schritt 2 (`/admin/name/bestaetigen`, C7 6.4, E20): löst die
 * fünfstellige PIN aus der E-Mail ein.
 *
 * **Kein Name im Körper:** Der Server kennt den angeforderten Namen; die Zeile „Neuer
 * Anmeldename“ ist nur Anzeige und fehlt nach einem Neuladen oder beim Direkteinstieg.
 * **Keine Restzeitanzeige:** Die Gültigkeitsdauer steht nicht im Vertrag, der feste
 * Satz nennt nur die Grenzen, die feststehen (kurz gültig, fünf Versuche).
 *
 * **Die Sitzung bleibt.** Es gibt weder Sitzungsende noch Neuladen; der Name gilt
 * ab der nächsten Anmeldung. Nach `204` geht es mit Hinweis zum Dashboard.
 *
 * **Nur nach dem jeweiligen Code geleert** (C4-Regel): `NAME_PIN_FALSCH` (`401`, kein
 * Sitzungsende) ist ein Eingabefehler am PIN-Feld – PIN leeren, Fokus ins Feld. `409
 * NAME_AENDERUNG_UNGUELTIG` und `409 NAME_BELEGT` heißen **neu anfordern**, nicht nochmal
 * versuchen: Kasten mit Link. `429 PIN_GESPERRT` sperrt über `useSperre`. Bei Netzfehler
 * und `≥ 500` bleibt alles stehen.
 */
export default function AdminNameBestaetigen() {
  const [pin, setPin] = useState('')
  const navigate = useNavigate()
  const neuerName = neuerNameLesen(useLocation().state)
  const hinweis = useNavigationsHinweis()
  const bestaetigung = useNameBestaetigen()
  const sperre = useSperre({ beimEnde: bestaetigung.reset })
  const pinFeld = useRef<HTMLInputElement>(null)
  const fehlerId = `${useId()}-fehler`

  // Beim Betreten steht die Person vor dem Feld.
  useEffect(() => {
    pinFeld.current?.focus()
  }, [])

  const vollstaendig = pin.length === NAME_PIN_LAENGE

  /** Löst die PIN ein. */
  async function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!vollstaendig || bestaetigung.isPending || sperre.aktiv) return

    try {
      await bestaetigung.mutateAsync({ bestaetigungsPin: pin })
      void navigate(ADMIN_PFADE.start, { replace: true, state: { hinweis: HINWEIS_NAME_GEAENDERT } })
    } catch (fehler) {
      // Eine abgelehnte PIN wird geleert; bei jedem anderen Fehler war sie nicht falsch.
      if (fehler instanceof ApiFehler && fehler.code === 'NAME_PIN_FALSCH') {
        setPin('')
        pinFeld.current?.focus()
      }
      sperre.ausFehler(fehler)
    }
  }

  const fehler = bestaetigung.error
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const felder = apiFehler?.status === 400 ? apiFehler.felder : undefined
  const pinFehler = apiFehler?.code === 'NAME_PIN_FALSCH' ? apiFehler.message : (felder?.bestaetigungsPin ?? null)
  const kastenNoetig = fehler !== null && pinFehler === null
  const neuAnfordern = apiFehler?.code === 'NAME_AENDERUNG_UNGUELTIG' || apiFehler?.code === 'NAME_BELEGT'

  return (
    <form className={style.seite} onSubmit={(e) => void absenden(e)} noValidate data-testid="admin-name-bestaetigen-seite">
      <div className={style.bereich}>
        <h1 className={style.titel}>Anmeldenamen bestätigen</h1>

        {hinweis.hinweis !== null && <Hinweis data-testid="admin-name-hinweis">{hinweis.hinweis}</Hinweis>}

        {neuerName !== null && (
          <p className={style.text} data-testid="admin-name-angefordert">
            Neuer Anmeldename: <strong>{neuerName}</strong>
          </p>
        )}

        <PinFeld
          ref={pinFeld}
          stellen={NAME_PIN_LAENGE}
          wert={pin}
          beiAenderung={(wert) => {
            hinweis.verbergen()
            setPin(wert)
          }}
          beschriftung="Bestätigungs-PIN"
          hinweis="Die PIN ist nur kurz gültig und auf fünf Versuche begrenzt."
          fehler={pinFehler}
          fehlerhaft={kastenNoetig}
          beschriebenDurch={fehlerId}
          // Die PIN kommt per E-Mail; iOS schlägt sie über dieses Token vor.
          autoComplete="one-time-code"
          ausrichtung="start"
          readOnly={bestaetigung.isPending}
          testIdPraefix="admin-name-pin"
        />

        {kastenNoetig && (
          <div className={style.fehler}>
            <Fehlermeldung id={fehlerId} fehler={fehler} ersatz={FEHLER_ERSATZ} data-testid="admin-name-bestaetigen-fehler" />
            {neuAnfordern && (
              <Textlink to={ADMIN_PFADE.nameAendern} data-testid="admin-name-neu-anfordern">
                Neu anfordern
              </Textlink>
            )}
          </div>
        )}
      </div>

      <Aktionsleiste>
        <CustomButton
          type="submit"
          art="primaer"
          breit
          className={style.aktion}
          laedt={bestaetigung.isPending}
          disabled={!vollstaendig || sperre.aktiv}
          data-testid="admin-name-bestaetigen"
        >
          Anmeldenamen ändern
        </CustomButton>
      </Aktionsleiste>
    </form>
  )
}
