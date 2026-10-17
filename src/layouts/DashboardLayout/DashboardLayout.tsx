import { Navigate, Outlet } from 'react-router'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import TabLeiste from '@/components/TabLeiste/TabLeiste'
import { useSitzung } from '@/hooks/useSitzung'

/**
 * Rahmen der vier Bereiche Termine, Teams, Ergebnisse und Verlauf (C5, 9.2):
 * pfadlose Layout-Route **innerhalb** von `GeschuetzteRoute`.
 *
 * **Der Admin sieht diese Bereiche nicht** (E7): Er geht nach `/admin`. Die
 * Adminanzeige gehört ins Admin-Dashboard (C7), und die Seiten tragen deshalb
 * keine Admin-Zweige. Das ist Bedienkomfort, keine Sicherheitsmaßnahme: Der
 * Server lehnt die Rückmeldung eines Admins mit `409 PROFIL_GESCHUETZT` ab.
 *
 * Die Detailansichten (`termine/:terminId` u. a.) stehen **außerhalb** dieses
 * Layouts und tragen keine Leiste (E12): Bei einem Termin aus dem Verlauf wäre
 * sonst zu entscheiden, welcher Bereich aktiv ist.
 */
export default function DashboardLayout() {
  const { istAdmin } = useSitzung()

  if (istAdmin) return <Navigate to={ADMIN_PFADE.start} replace />

  return (
    <>
      <TabLeiste />
      <Outlet />
    </>
  )
}
