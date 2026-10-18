import type { SpielerDetails } from '@/api/admin/adminProfile'
import { skillsVollstaendig, type SkillKategorie } from '@/api/admin/skills'
import ProfilZeile from './ProfilZeile'
import style from './ProfilListe.module.scss'

/** Eigenschaften der Profilliste. */
type ProfilListeEigenschaften = {
  /** Die Profile in der Reihenfolge des Servers (Spieler vorn, Admin am Ende). */
  profile: SpielerDetails[]
  /**
   * Die aktiven Kategorien oder `undefined`, solange sie laden oder ausgefallen sind: Dann entfällt die
   * Kennzeichnung „Skillwerte unvollständig“ still (kein Flackern, die Liste bleibt benutzbar).
   */
  kategorien?: SkillKategorie[]
}

/**
 * Die Liste der Profile (C7, 5.4).
 *
 * Eine Liste (`<ul>`) aus `ProfilZeile`n in der Reihenfolge des Servers. Die Skillkarte dient nur dem
 * Vergleich mit den Kategorien (E7); **keine Skillwerte stehen im DOM.**
 */
export default function ProfilListe({ profile, kategorien }: ProfilListeEigenschaften) {
  return (
    <ul className={style.liste} data-testid="profil-liste">
      {profile.map((profil) => (
        <li key={profil.spielerId}>
          <ProfilZeile
            profil={profil}
            skillsUnvollstaendig={kategorien !== undefined && !skillsVollstaendig(profil.skills, kategorien)}
          />
        </li>
      ))}
    </ul>
  )
}
