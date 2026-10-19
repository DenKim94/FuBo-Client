import type { ReactNode } from 'react'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import type { SkillKategorie } from '@/api/admin/skills'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import Textlink from '@/components/Textlink/Textlink'
import { useProfile } from '@/hooks/admin/useProfile'
import { useSkillKategorien } from '@/hooks/admin/useSkillKategorien'
import style from './ProfilLader.module.scss'

/** Was der Lader seinen Kindern gibt, sobald beides da ist. */
export type ProfilDaten = {
  /** Das Profil mit Skillwerten (nie das Adminprofil: Dafür gibt es keine Ansicht). */
  profil: SpielerDetails
  /** Die aktiven Kategorien in Anzeigereihenfolge. */
  kategorien: SkillKategorie[]
}

/** Eigenschaften des Profil-Laders. */
type ProfilLaderEigenschaften = {
  /** Id des Profils, bereits geprüft (`useSpielerParameter`). */
  spielerId: number
  /** Text des Ladezustands, solange die Kategorien laden. */
  ladetext: string
  /** Zeichnet die Ansicht, sobald Kategorien und Profil vorliegen. */
  children: (daten: ProfilDaten) => ReactNode
}

/** Das Adminprofil hat keine Profilansicht und kein Formular: Es wird über den Anmeldenamen umbenannt. */
function AdminProfilHinweis({ profil }: { profil: SpielerDetails }) {
  return (
    <section className={style.seite} data-testid="admin-profil-admin">
      <div className={style.bereich}>
        <h1 className={style.titel}>{profil.name}</h1>
        <Hinweis data-testid="admin-profil-admin-hinweis">Das Adminprofil wird über den Anmeldenamen umbenannt.</Hinweis>
        <Textlink to={ADMIN_PFADE.nameAendern} data-testid="admin-profil-admin-namenlink">
          Anmeldenamen ändern
        </Textlink>
      </div>
    </section>
  )
}

/**
 * Lädt Kategorien und Profil, bevor eine Profilansicht gebaut wird (Profilansicht und Bearbeiten teilen sich das).
 *
 * **Die Ansicht entsteht aus den Kategorien des Servers** – ohne sie lässt sich nichts bauen, und es wird nichts
 * geraten: Solange sie laden, steht ein Spinner, bei einem Fehler ein Fehlerzustand mit „Erneut versuchen“. Dasselbe
 * gilt für die Profile. Ein Profil, das es nicht (mehr) gibt, zeigt „Profil nicht gefunden“ mit dem Weg zur Liste;
 * das Adminprofil zeigt statt der Ansicht den Hinweis auf den Anmeldenamen.
 */
export default function ProfilLader({ spielerId, ladetext, children }: ProfilLaderEigenschaften) {
  const kategorien = useSkillKategorien()
  const profile = useProfile()

  if (!kategorien.data) {
    return kategorien.isPending ? (
      <Ladespinner groesse="gross" zentriert text={ladetext} />
    ) : (
      <Fehlerzustand fehler={kategorien.error} erneut={() => void kategorien.refetch()} data-testid="admin-profil-kategorien-fehler" />
    )
  }
  if (!profile.data) {
    return profile.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Profil wird geladen" />
    ) : (
      <Fehlerzustand fehler={profile.error} erneut={() => void profile.refetch()} data-testid="admin-profil-fehler-laden" />
    )
  }
  const profil = profile.data.find((p) => p.spielerId === spielerId)
  if (!profil) {
    return (
      <Leerzustand
        titel="Profil nicht gefunden"
        text="Dieses Profil gibt es nicht mehr."
        titelEbene={1}
        aktion={
          <Textlink to={ADMIN_PFADE.profile} data-testid="admin-profil-zur-liste">
            Zur Liste
          </Textlink>
        }
        data-testid="admin-profil-nicht-gefunden"
      />
    )
  }
  if (profil.rolle === 'ADMIN') return <AdminProfilHinweis profil={profil} />
  return children({ profil, kategorien: kategorien.data })
}
