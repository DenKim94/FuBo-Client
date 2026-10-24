import { useNavigate } from 'react-router'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import ProfilListe from '@/components/ProfilListe/ProfilListe'
import Textlink from '@/components/Textlink/Textlink'
import { useProfile } from '@/hooks/admin/useProfile'
import { useSkillKategorien } from '@/hooks/admin/useSkillKategorien'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import style from './AdminProfile.module.scss'

/**
 * Liste der Spielerprofile (`/admin/profile`, C7 7.2).
 *
 * Überschrift, ein Satz mit der Zahl der Spielerprofile (**ohne** das Adminprofil), die Liste und die
 * Aktion „Profil anlegen“ in der Leiste. Ein Hinweis aus der Navigation („Profil … angelegt.“, „… entfernt.“)
 * steht oben.
 *
 * **Die Kategorien sind nachrangig:** Sie dienen nur der Kennzeichnung „Skillwerte unvollständig“ (E7).
 * Solange sie laden oder ausfallen, entfällt die Kennzeichnung still; die Liste bleibt benutzbar und
 * zeigt keinen Fehlerzustand für etwas, das sie nicht braucht.
 *
 * **Leerzustand**, wenn es kein Profil mit der Rolle `USER` gibt – das Adminprofil bleibt dennoch in der Liste.
 */
export default function AdminProfile() {
  const profile = useProfile()
  const kategorien = useSkillKategorien()
  const hinweis = useNavigationsHinweis()
  const navigate = useNavigate()

  const daten = profile.data
  const anzahl = daten?.filter((p) => p.rolle === 'USER').length ?? 0

  let inhalt
  if (!daten) {
    inhalt = profile.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Profile werden geladen" />
    ) : (
      <Fehlerzustand fehler={profile.error} erneut={() => void profile.refetch()} data-testid="admin-profile-fehler" />
    )
  } else {
    inhalt = (
      <>
        {anzahl === 0 && (
          <Leerzustand
            titel="Noch keine Spielerprofile"
            text="Lege ein Profil an, damit sich der erste Spieler anmelden kann."
            aktion={
              <Textlink to={ADMIN_PFADE.profilNeu} data-testid="admin-profil-anlegen-leer">
                Profil anlegen
              </Textlink>
            }
            data-testid="admin-profile-leer"
          />
        )}
        <ProfilListe profile={daten} kategorien={kategorien.data} />
      </>
    )
  }

  return (
    <section className={style.seite} data-testid="admin-profile">
      <div className={style.bereich}>
        <h1 className={style.titel}>Spielerprofile</h1>
        {daten && (
          <p className={style.text} data-testid="admin-profile-anzahl">
            {anzahl === 1 ? '1 Spielerprofil' : `${String(anzahl)} Spielerprofile`}
          </p>
        )}
        {hinweis.hinweis !== null && <Hinweis data-testid="admin-profile-hinweis">{hinweis.hinweis}</Hinweis>}
        {inhalt}
      </div>

      <Aktionsleiste>
        <CustomButton
          art="primaer"
          symbol="person_add_dark"
          breit
          className={style.aktion}
          onClick={() => void navigate(ADMIN_PFADE.profilNeu)}
          data-testid="admin-profil-anlegen"
        >
          Profil anlegen
        </CustomButton>
      </Aktionsleiste>
    </section>
  )
}
