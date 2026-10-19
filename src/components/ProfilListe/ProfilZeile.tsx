import { Link } from 'react-router'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import ProfilKennzeichen from '@/components/ProfilKennzeichen/ProfilKennzeichen'
import style from './ProfilListe.module.scss'

/** Eigenschaften einer Profilzeile. */
type ProfilZeileEigenschaften = {
  profil: SpielerDetails
  /** Das Profil hat zu einer aktiven Kategorie keinen Wert (E7); `false`, solange die Kategorien laden. */
  skillsUnvollstaendig: boolean
}

/**
 * Eine Zeile der Profilliste (C7, 5.4): Name, Kennzeichen, Bilanz.
 *
 * **Keine Skillwerte in der Zeile** (A12; sie erscheinen nur in der Profilansicht und im Formular). Die Zeile ist ein Link zur
 * Profilansicht (Netzdiagramm, von dort „Skills bearbeiten“), **ausser** beim Adminprofil: Es hat keine
 * Profilansicht, also kein Ziel und kein Tap-Ziel, das ins Leere führte. Das Adminprofil hat keine Bilanz.
 */
export default function ProfilZeile({ profil, skillsUnvollstaendig }: ProfilZeileEigenschaften) {
  const id = profil.spielerId
  const istAdmin = profil.rolle === 'ADMIN'
  const inhalt = (
    <>
      <span className={style.name}>{profil.name}</span>
      <ProfilKennzeichen profil={profil} skillsUnvollstaendig={skillsUnvollstaendig} />
      {!istAdmin && (
        <span className={style.bilanz} data-testid={`profil-bilanz-${String(id)}`}>
          {profil.bilanz.siege} S · {profil.bilanz.niederlagen} N · {profil.bilanz.unentschieden} U
        </span>
      )}
    </>
  )

  if (istAdmin) {
    return (
      <div className={`${style.zeile} ${style.ohneZiel}`} data-testid={`profil-zeile-${String(id)}`}>
        {inhalt}
      </div>
    )
  }
  return (
    <Link
      to={ADMIN_PFADE.profilDetail(id)}
      className={style.zeile}
      data-testid={`profil-zeile-${String(id)}`}
    >
      {inhalt}
    </Link>
  )
}
