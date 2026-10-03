import { useNavigate } from 'react-router'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'
import CustomButton from '@/components/CustomButton/CustomButton'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import style from './NichtGefunden.module.scss'

/**
 * Ansicht für unbekannte Adressen (Route `*`).
 *
 * Bewusst öffentlich und ohne Guard (siehe `routen.tsx`): Ein Tippfehler in der
 * Adresse soll diese Seite zeigen und nicht zur Anmeldung umleiten. Die Aktion
 * führt zur Startseite; ohne Sitzung leitet `GeschuetzteRoute` von dort zur PIN.
 *
 * Erster Verbraucher von `Leerzustand`: Die Seite nennt den Grund und den
 * nächsten Schritt, statt nur „404“ zu sagen.
 */
export default function NichtGefunden() {
  const navigate = useNavigate()

  return (
    <section className={style.nichtGefunden} data-testid="nicht-gefunden">
      <Leerzustand
        titel="Seite nicht gefunden"
        text="Diese Adresse gibt es in der Anwendung nicht. Vielleicht hat sich ein Tippfehler eingeschlichen."
        titelEbene={1}
        aktion={
          <CustomButton art="primaer" onClick={() => void navigate(LOGIN_PFADE.start)} data-testid="nicht-gefunden-start">
            Zur Startseite
          </CustomButton>
        }
      />
    </section>
  )
}
