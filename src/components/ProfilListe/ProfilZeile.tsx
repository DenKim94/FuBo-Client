import { Link } from 'react-router'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Icon from '@/components/Icon/Icon'
import style from './ProfilListe.module.scss'

/** Eigenschaften einer Profilzeile. */
type ProfilZeileEigenschaften = {
  profil: SpielerDetails
  /** Das Profil hat zu einer aktiven Kategorie keinen Wert (E7); `false`, solange die Kategorien laden. */
  skillsUnvollstaendig: boolean
}

/** Ein Kennzeichen: Symbol **und** Text, nie allein Farbe. */
function Kennzeichen({ symbol, text, testId }: { symbol: string; text: string; testId: string }) {
  return (
    <li className={style.kennzeichen} data-testid={testId}>
      <Icon name={symbol} groesse={1} />
      {text}
    </li>
  )
}

/**
 * Eine Zeile der Profilliste (C7, 5.4): Name, Kennzeichen, Bilanz.
 *
 * **Keine Skillwerte in der Zeile** (A12; sie erscheinen nur im Formular). Die Zeile ist ein Link zur
 * Bearbeitung, **ausser** beim Adminprofil: Es hat kein Formular, also kein Ziel und kein Tap-Ziel,
 * das ins Leere führte. Das Adminprofil hat keine Bilanz.
 */
export default function ProfilZeile({ profil, skillsUnvollstaendig }: ProfilZeileEigenschaften) {
  const id = profil.spielerId
  const istAdmin = profil.rolle === 'ADMIN'
  const inhalt = (
    <>
      <span className={style.name}>{profil.name}</span>
      <ul className={style.kennzeichenListe}>
        {istAdmin && <Kennzeichen symbol="admin_icon_dark" text="Admin" testId={`profil-admin-${String(id)}`} />}
        {!profil.aktiv && <Kennzeichen symbol="block_icon" text="gesperrt" testId={`profil-gesperrt-${String(id)}`} />}
        {profil.belegt && (
          <Kennzeichen symbol="account_circle_dark" text="online" testId={`profil-online-${String(id)}`} />
        )}
        {!istAdmin && skillsUnvollstaendig && (
          <Kennzeichen
            symbol="warning_icon"
            text="Skillwerte unvollständig"
            testId={`profil-skills-unvollstaendig-${String(id)}`}
          />
        )}
      </ul>
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
      to={ADMIN_PFADE.profilBearbeiten(id)}
      className={style.zeile}
      data-testid={`profil-zeile-${String(id)}`}
    >
      {inhalt}
    </Link>
  )
}
