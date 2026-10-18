import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import { useProfilBlockieren } from '@/hooks/admin/useProfilBlockieren'
import { useProfilEntfernen } from '@/hooks/admin/useProfilEntfernen'
import style from './AdminProfilFormular.module.scss'

/** Rückfalltexte, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ_SPERREN = 'Die Sperre konnte nicht geändert werden. Bitte versuche es erneut.'
const FEHLER_ERSATZ_ENTFERNEN = 'Das Profil konnte nicht entfernt werden. Bitte versuche es erneut.'

/**
 * Abschnitt „Status“ eines Spielerprofils (C7, 7.4): Sperren, Entsperren und Entfernen.
 *
 * Eigener Abschnitt unterhalb der Felder, **nicht** in der Aktionsleiste: Die Leiste gehört der
 * häufigen, ungefährlichen Aktion (Speichern). Beide Aktionen entfallen beim Adminprofil (es hat
 * dieses Formular nicht).
 *
 * - **Sperren/Entsperren:** ohne Dialog, **ausser** beim Sperren eines gerade angemeldeten Profils
 *   (`belegt`): Der Spieler wird sofort abgemeldet, das nennt die `Bestaetigung`. Die Schaltfläche
 *   bleibt dasselbe Element und wechselt nur Beschriftung und Zustandstext; der Fokus bleibt.
 * - **Entfernen:** immer mit `Bestaetigung` (nicht umkehrbar). `409 PROFIL_IN_VERWENDUNG` schliesst
 *   den Dialog und bietet „Stattdessen sperren“ an – der richtige Weg für ein Profil mit Daten.
 *   Nach dem Erfolg geht es mit `mutateAsync` zur Liste (die Seite wird ausgehängt).
 */
export default function ProfilStatus({ profil }: { profil: SpielerDetails }) {
  const [sperrDialog, setSperrDialog] = useState(false)
  const [entfernenDialog, setEntfernenDialog] = useState(false)
  const blockieren = useProfilBlockieren()
  const entfernen = useProfilEntfernen()
  const navigate = useNavigate()

  const gesperrt = !profil.aktiv
  const inVerwendung = entfernen.error instanceof ApiFehler && entfernen.error.code === 'PROFIL_IN_VERWENDUNG'

  /** Sperrt oder entsperrt; bei einem Fehler bleibt der Dialog (falls offen) stehen. */
  async function umschalten() {
    if (blockieren.isPending) return
    try {
      await blockieren.mutateAsync({ spielerId: profil.spielerId, blockieren: !gesperrt })
      setSperrDialog(false)
    } catch (fehler) {
      if (fehler instanceof ApiFehler && fehler.status === 404) {
        void navigate(ADMIN_PFADE.profile, { replace: true, state: { hinweis: 'Dieses Profil gibt es nicht mehr.' } })
      }
    }
  }

  /** Tippen auf „sperren“: Ein angemeldetes Profil verlangt zuerst die Bestätigung. */
  function sperrenAnstossen() {
    blockieren.reset()
    if (!gesperrt && profil.belegt) setSperrDialog(true)
    else void umschalten()
  }

  /** Entfernt das Profil und geht mit Hinweis zur Liste. */
  async function entfernenAusfuehren() {
    if (entfernen.isPending) return
    try {
      await entfernen.mutateAsync(profil.spielerId)
      void navigate(ADMIN_PFADE.profile, { replace: true, state: { hinweis: `Profil „${profil.name}“ entfernt.` } })
    } catch (fehler) {
      if (fehler instanceof ApiFehler && (fehler.code === 'PROFIL_IN_VERWENDUNG' || fehler.status === 404)) {
        setEntfernenDialog(false)
        if (fehler.status === 404) {
          void navigate(ADMIN_PFADE.profile, { replace: true, state: { hinweis: 'Dieses Profil gibt es nicht mehr.' } })
        }
      }
    }
  }

  return (
    <section className={style.status} aria-labelledby="admin-profil-status-titel" data-testid="admin-profil-status">
      <h2 id="admin-profil-status-titel" className={style.statusTitel}>
        Status
      </h2>

      <div className={style.statusZeile}>
        <p className={style.statusText} data-testid="admin-profil-sperre-text">
          {gesperrt
            ? 'Gesperrt: erscheint nicht mehr in der Namensauswahl, der Name bleibt belegt.'
            : 'Aktiv: Das Profil steht in der Namensauswahl.'}
        </p>
        <CustomButton
          art="sekundaer"
          laedt={blockieren.isPending && !sperrDialog}
          onClick={sperrenAnstossen}
          data-testid="admin-profil-sperren"
        >
          {gesperrt ? 'Profil entsperren' : 'Profil sperren'}
        </CustomButton>
        {blockieren.error !== null && !sperrDialog && (
          <Fehlermeldung fehler={blockieren.error} ersatz={FEHLER_ERSATZ_SPERREN} data-testid="admin-profil-status-fehler" />
        )}
      </div>

      <div className={style.statusZeile}>
        <p className={style.statusText}>Entfernen ist nur für ein Profil gedacht, das noch nie benutzt wurde.</p>
        {inVerwendung && (
          <>
            <Hinweis data-testid="admin-profil-in-verwendung">
              Das Profil hat bereits Daten (Rückmeldungen, Teams, Ergebnisse) und lässt sich nicht entfernen.
            </Hinweis>
            {!gesperrt && (
              <CustomButton art="sekundaer" onClick={sperrenAnstossen} data-testid="admin-profil-stattdessen-sperren">
                Stattdessen sperren
              </CustomButton>
            )}
          </>
        )}
        <CustomButton
          art="gefahr"
          onClick={() => {
            entfernen.reset()
            setEntfernenDialog(true)
          }}
          data-testid="admin-profil-entfernen"
        >
          Profil entfernen
        </CustomButton>
      </div>

      <Bestaetigung
        offen={sperrDialog}
        titel="Profil sperren?"
        bestaetigenText="Profil sperren"
        art="gefahr"
        laedt={blockieren.isPending}
        fehler={sperrDialog ? blockieren.error : null}
        fehlerErsatz={FEHLER_ERSATZ_SPERREN}
        beiBestaetigen={() => void umschalten()}
        beiAbbruch={() => setSperrDialog(false)}
        data-testid="admin-profil-sperr-dialog"
      >
        <p>{profil.name} ist gerade angemeldet und wird sofort abgemeldet.</p>
      </Bestaetigung>

      <Bestaetigung
        offen={entfernenDialog}
        titel="Profil entfernen?"
        bestaetigenText="Profil entfernen"
        art="gefahr"
        laedt={entfernen.isPending}
        fehler={entfernenDialog && !inVerwendung ? entfernen.error : null}
        fehlerErsatz={FEHLER_ERSATZ_ENTFERNEN}
        beiBestaetigen={() => void entfernenAusfuehren()}
        beiAbbruch={() => setEntfernenDialog(false)}
        data-testid="admin-profil-entfernen-dialog"
      >
        <p>
          Das ist nur für ein Profil gedacht, das noch nie benutzt wurde, etwa nach einem Tippfehler. Für alles
          andere sperre es.
        </p>
      </Bestaetigung>
    </section>
  )
}
