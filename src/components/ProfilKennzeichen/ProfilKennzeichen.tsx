import type { SpielerDetails } from '@/api/admin/adminProfile'
import Icon from '@/components/Icon/Icon'
import style from './ProfilKennzeichen.module.scss'

/** Eigenschaften der Kennzeichen. */
type ProfilKennzeichenEigenschaften = {
  profil: Pick<SpielerDetails, 'spielerId' | 'rolle' | 'aktiv' | 'belegt'>
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
 * Die Kennzeichen eines Profils (Admin, gesperrt, online, Skillwerte unvollständig) als Liste von Marken.
 *
 * Eine Stelle für Profilliste und Profilansicht: Beide zeigen dieselben Marken mit denselben Test-IDs
 * (`profil-admin-<id>`, `profil-gesperrt-<id>`, `profil-online-<id>`, `profil-skills-unvollstaendig-<id>`).
 * Ohne Kennzeichen rendert die Liste leer und blendet sich aus.
 */
export default function ProfilKennzeichen({ profil, skillsUnvollstaendig }: ProfilKennzeichenEigenschaften) {
  const id = profil.spielerId
  const istAdmin = profil.rolle === 'ADMIN'
  return (
    <ul className={style.liste}>
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
  )
}
