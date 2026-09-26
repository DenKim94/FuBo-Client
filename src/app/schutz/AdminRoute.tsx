import { Navigate, Outlet } from 'react-router'
import { useSitzung } from '@/hooks/useSitzung'

/**
 * Pfadlose Layout-Route: gibt ihre Unterrouten nur der Rolle ADMIN frei.
 *
 * Liegt **innerhalb** von `GeschuetzteRoute`, prueft also nur noch die Rolle –
 * dass ueberhaupt eine abgeschlossene Anmeldung besteht, ist an dieser Stelle
 * bereits sichergestellt.
 *
 * Nicht-Admins gehen auf die Startseite, nicht auf die Anmeldung: Sie sind
 * angemeldet, nur eben nicht zustaendig. Eine Umleitung zur Anmeldung wuerde
 * ihnen nahelegen, sie seien abgemeldet.
 *
 * **Auch das ist Bedienkomfort, keine Sicherheitsmassnahme.** Die Endpunkte
 * unter `/api/v1/admin/` verlangen serverseitig `ROLE_ADMIN`; ein Nutzer, der
 * diesen Guard umginge, saehe eine Ansicht voller `403`-Antworten und keine
 * Daten. Skillwerte etwa verlassen den Server ausschliesslich unterhalb von
 * `/admin/`.
 */
export default function AdminRoute() {
  const { laedt, istAdmin } = useSitzung()

  // Kein Flackern: erst entscheiden, wenn der Zustand bekannt ist.
  if (laedt) return null

  if (!istAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
