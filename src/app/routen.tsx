import { createBrowserRouter } from 'react-router'
import AppLayout from '@/layouts/AppLayout/AppLayout'
import AdminRoute from '@/app/schutz/AdminRoute'
import GeschuetzteRoute from '@/app/schutz/GeschuetzteRoute'
import Platzhalter from '@/seiten/Platzhalter/Platzhalter'

/**
 * Routenbaum der Anwendung.
 *
 * Er steht bereits vollstaendig, obwohl die Ansichten erst in spaeteren Paketen
 * entstehen: Der Baum ist die Landkarte der folgenden Arbeitspakete und
 * beantwortet die Frage nach dem Ablageort einer Ansicht, bevor sie entsteht.
 *
 * **Drei Zugriffsebenen**, umgesetzt ueber pfadlose Layout-Routen:
 *
 * 1. **Oeffentlich** – alles, was ohne Sitzung erreichbar sein muss. Dazu
 *    gehoert ausdruecklich auch `/admin/anmelden`: Der Admin muss sich anmelden
 *    koennen, bevor er Admin ist.
 * 2. **`GeschuetzteRoute`** – verlangt eine abgeschlossene Anmeldung
 *    (`stage = PROFILE_AUTHENTICATED`).
 * 3. **`AdminRoute`** – verlangt zusaetzlich die Rolle ADMIN.
 *
 * Beide Guards sind Bedienkomfort, keine Sicherheitsmassnahme; die Durchsetzung
 * liegt in der Filterchain des Servers.
 */
export const routen = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      // --- Oeffentlich ---------------------------------------------------
      { path: 'anmelden', element: <Platzhalter titel="Anmeldung" paket="C3" /> },
      { path: 'admin/anmelden', element: <Platzhalter titel="Admin-Anmeldung" paket="C4" /> },

      // --- Nur mit abgeschlossener Anmeldung ------------------------------
      {
        element: <GeschuetzteRoute />,
        children: [
          { index: true, element: <Platzhalter titel="Start" paket="C5" /> },
          { path: 'termine/:terminId', element: <Platzhalter titel="Termin" paket="C5" /> },
          { path: 'teams/:terminId', element: <Platzhalter titel="Teams" paket="C6" /> },
          // Die Einstellungen sind fuer jede angemeldete Person erreichbar; den
          // Benachrichtigungsbereich blendet die Ansicht fuer GAST selbst aus
          // (A25d), weil die zugehoerigen Endpunkte dort mit `403` antworten.
          { path: 'einstellungen', element: <Platzhalter titel="Einstellungen" paket="C8" /> },

          // --- Zusaetzlich nur fuer die Rolle ADMIN -------------------------
          {
            element: <AdminRoute />,
            children: [
              { path: 'admin', element: <Platzhalter titel="Administration" paket="C7" /> },
            ],
          },
        ],
      },

      // Bewusst oeffentlich: Ein Tippfehler in der Adresse soll die Seite
      // „nicht gefunden" zeigen und nicht zur Anmeldung umleiten.
      { path: '*', element: <Platzhalter titel="Seite nicht gefunden" paket="C2" /> },
    ],
  },
])
