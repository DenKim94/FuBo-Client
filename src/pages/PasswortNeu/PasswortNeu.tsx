import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { neuesPasswortGueltig, RESET_GUELTIG_MS } from '@/api/auth/passwortRegeln'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import PasswortFeld from '@/components/PasswortFeld/PasswortFeld'
import PasswortRegeln from '@/components/PasswortRegeln/PasswortRegeln'
import PinFeld from '@/components/PinFeld/PinFeld'
import Restzeitbalken from '@/components/Restzeitbalken/Restzeitbalken'
import Textlink from '@/components/Textlink/Textlink'
import { usePasswortBestaetigen } from '@/hooks/usePasswortBestaetigen'
import { useSperre } from '@/hooks/useSperre'
import style from './PasswortNeu.module.scss'

/** Länge der Bestätigungs-PIN aus der E-Mail (Kontrakt). */
const RESET_PIN_LAENGE = 5

/** Hinweis auf der Admin-Anmeldung nach dem Erfolg (E4). */
export const HINWEIS_PASSWORT_GESETZT = 'Passwort gesetzt. Melde dich mit dem neuen Passwort an.'

/** Rückfalltext, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ = 'Das Passwort konnte nicht gesetzt werden. Bitte versuche es erneut.'

/** Uhrzeit ohne Datum, wie sie auf dem Gerät üblich ist („20:58“). */
const UHRZEIT = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })

/**
 * Liest den Zeitpunkt der Anforderung aus dem Navigationszustand.
 *
 * @param zustand Der Navigationszustand, beliebigen Typs.
 * @returns Millisekunden seit 1970 oder `null` (Einstieg über „Ich habe bereits eine PIN“).
 */
function angefordertUmLesen(zustand: unknown): number | null {
  const wert = (zustand as { angefordertUm?: unknown } | null)?.angefordertUm
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : null
}

/**
 * Passwort vergessen, Schritt 2 von 2 (C4, 7.2): Bestätigungs-PIN und neues Passwort.
 *
 * **Restgültigkeit nur als Darstellung:** Aus dem Zeitpunkt der Anforderung
 * (`state.angefordertUm`, liegt in `history.state` und übersteht ein Neuladen im
 * selben Tab) ergeben sich Balken und der feste Satz „Gültig bis 20:58 Uhr.“ –
 * keine tickende Zahl für Screenreader. Ohne Zeitpunkt entfällt der Balken. Ob die
 * PIN noch gilt, entscheidet der Server (`409`).
 *
 * **Versuche zählt nur der Server** (höchstens fünf je PIN): Er kennt den Stand
 * auch nach abgebrochenen Anfragen und von anderen Geräten. Die Ansicht zeigt
 * deshalb nur den festen Hinweis.
 *
 * **Falsche PIN (`401`) ist ein Eingabefehler:** Text am PIN-Feld, PIN leeren,
 * Passwort **behalten**, Fokus ins PIN-Feld. **`409 RESET_UNGUELTIG` heißt neu
 * anfordern, nicht nochmal versuchen** – daher der Link zu Schritt 1.
 *
 * Nach dem Erfolg bleibt die Sitzung `PIN_VERIFIED` (sie gehört nicht dem Admin);
 * die Ansicht geht mit Hinweis zur Admin-Anmeldung.
 */
export default function PasswortNeu() {
  const [pin, setPin] = useState('')
  const [passwort, setPasswort] = useState('')
  const navigate = useNavigate()
  const angefordertUm = angefordertUmLesen(useLocation().state)
  const bestaetigung = usePasswortBestaetigen()
  const sperre = useSperre({ beimEnde: bestaetigung.reset })
  const pinFeld = useRef<HTMLInputElement>(null)

  const kennung = useId()
  const fehlerId = `${kennung}-fehler`
  const regelnId = `${kennung}-regeln`

  // Beim Betreten steht die Person vor dem ersten Feld.
  useEffect(() => {
    pinFeld.current?.focus()
  }, [])

  const pinVollstaendig = pin.length === RESET_PIN_LAENGE
  const absendenMoeglich = pinVollstaendig && neuesPasswortGueltig(passwort)

  /** Löst die PIN ein und setzt das Passwort. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!absendenMoeglich || bestaetigung.isPending || sperre.aktiv) return

    bestaetigung.mutate(
      { bestaetigungsPin: pin, neuesPasswort: passwort },
      {
        onSuccess: () =>
          void navigate(ADMIN_PFADE.anmelden, {
            replace: true,
            state: { hinweis: HINWEIS_PASSWORT_GESETZT },
          }),
        onError: (fehler) => {
          // Eine abgelehnte PIN wird geleert, das Passwort bleibt: Es war nicht
          // falsch, und ein neu getipptes Passwort sähe man nicht.
          if (fehler instanceof ApiFehler && fehler.code === 'RESET_PIN_FALSCH') {
            setPin('')
            pinFeld.current?.focus()
          }
          sperre.ausFehler(fehler)
        },
      },
    )
  }

  const fehler = bestaetigung.error
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const felder = apiFehler?.status === 400 ? apiFehler.felder : undefined

  const pinFehler =
    apiFehler?.code === 'RESET_PIN_FALSCH' ? apiFehler.message : (felder?.bestaetigungsPin ?? null)
  const passwortFehler = felder?.neuesPasswort ?? null
  const kastenNoetig = fehler !== null && pinFehler === null && passwortFehler === null
  const neuAnfordern = apiFehler?.code === 'RESET_UNGUELTIG'

  return (
    <form className={style.neu} onSubmit={absenden} noValidate data-testid="passwort-neu">
      <div className={style.bereich}>
        <header className={style.kopf}>
          <p className={style.schritt} data-testid="passwort-neu-schritt">
            Schritt 2 von 2
          </p>
          <h1 className={style.titel}>Neues Passwort setzen</h1>
        </header>

        <div className={style.gueltigkeit}>
          {angefordertUm === null ? (
            <p data-testid="passwort-neu-gueltigkeit">Die PIN ist 15 Minuten ab Anforderung gültig.</p>
          ) : (
            <>
              <Restzeitbalken
                ende={angefordertUm + RESET_GUELTIG_MS}
                dauer={RESET_GUELTIG_MS}
                data-testid="passwort-neu-balken"
              />
              <p data-testid="passwort-neu-gueltigkeit">
                Gültig bis {UHRZEIT.format(angefordertUm + RESET_GUELTIG_MS)} Uhr.
              </p>
            </>
          )}
        </div>

        <PinFeld
          ref={pinFeld}
          stellen={RESET_PIN_LAENGE}
          wert={pin}
          beiAenderung={setPin}
          beschriftung="Bestätigungs-PIN"
          hinweis="Höchstens fünf Versuche, danach muss eine neue PIN angefordert werden."
          fehler={pinFehler}
          fehlerhaft={kastenNoetig}
          beschriebenDurch={fehlerId}
          // Die PIN kommt per E-Mail; iOS schlägt sie über dieses Token vor.
          autoComplete="one-time-code"
          ausrichtung="start"
          readOnly={bestaetigung.isPending}
          testIdPraefix="reset-pin"
        />

        <PasswortFeld
          beschriftung="Neues Passwort"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          fehler={passwortFehler}
          beschriebenDurch={regelnId}
          autoComplete="new-password"
          readOnly={bestaetigung.isPending}
          data-testid="passwort-neu-passwort"
        />
        <PasswortRegeln passwort={passwort} id={regelnId} data-testid="passwort-neu-regeln" />

        {kastenNoetig && (
          <div className={style.fehler}>
            <Fehlermeldung
              id={fehlerId}
              fehler={fehler}
              ersatz={FEHLER_ERSATZ}
              data-testid="passwort-neu-fehler"
            />
            {neuAnfordern && (
              <Textlink to={ADMIN_PFADE.passwortVergessen} data-testid="passwort-neu-neu-anfordern">
                Neue PIN anfordern
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
          laedt={bestaetigung.isPending}
          disabled={!absendenMoeglich || sperre.aktiv}
          data-testid="passwort-neu-absenden"
        >
          Passwort speichern
        </CustomButton>
      </Aktionsleiste>
    </form>
  )
}
