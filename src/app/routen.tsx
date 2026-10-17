import { createBrowserRouter } from 'react-router'
import AppLayout from '@/layouts/AppLayout/AppLayout'
import type { RoutenAngaben } from '@/app/routenAngaben'
import AdminRoute from '@/app/schutz/AdminRoute'
import GeschuetzteRoute from '@/app/schutz/GeschuetzteRoute'
import LoginSchrittRoute from '@/app/schutz/LoginSchrittRoute'
import { ADMIN_PFADE, LOGIN_PFADE } from '@/app/schutz/zielpfad'
import Platzhalter from '@/components/Platzhalter/Platzhalter'
import Textlink from '@/components/Textlink/Textlink'
import AdminAnmeldung from '@/pages/AdminAnmeldung/AdminAnmeldung'
import Namensauswahl from '@/pages/Namensauswahl/Namensauswahl'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import PasswortAendern from '@/pages/PasswortAendern/PasswortAendern'
import PasswortNeu from '@/pages/PasswortNeu/PasswortNeu'
import PasswortVergessen from '@/pages/PasswortVergessen/PasswortVergessen'
import PinEingabe from '@/pages/PinEingabe/PinEingabe'

/** Login-Schritte haben kein sinnvolles „Zurück" (siehe `RoutenAngaben`). */
const LOGIN_SCHRITT: RoutenAngaben = { ohneZurueck: true }

/**
 * Ansichten direkt unter dem Dashboard: „Zurück" führt dorthin, nicht einen
 * Schritt im Verlauf (C2, Abschnitt 6.1). Routen ohne eindeutige übergeordnete
 * Ansicht bleiben ohne Angabe und gehen einen Schritt zurück.
 */
const ZUM_DASHBOARD: RoutenAngaben = { zurueck: LOGIN_PFADE.start }

/**
 * Routenbaum der Anwendung.
 *
 * Er steht bereits vollstaendig, obwohl die Ansichten erst in spaeteren Paketen
 * entstehen: Der Baum ist die Landkarte der folgenden Arbeitspakete und
 * beantwortet die Frage nach dem Ablageort einer Ansicht, bevor sie entsteht.
 *
 * **Drei Zugriffsebenen**, umgesetzt ueber pfadlose Layout-Routen:
 *
 * 1. **Oeffentlich** – alles, was ohne Sitzung erreichbar sein muss. Das sind
 *    nur die Login-Schritte, und sie sind an ihre Stufe gebunden
 *    (`LoginSchrittRoute`): ohne Sitzung die PIN-Eingabe, in `PIN_VERIFIED` die
 *    Namensauswahl **und die drei Admin-Ansichten** (Anmeldung, Passwort
 *    vergessen, neues Passwort; C4). `/admin/anmelden` ist *nicht* mehr ohne
 *    Sitzung erreichbar: Der Server verlangt dafuer `PIN_VERIFIED`.
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
      // Beim Start ohne Sitzung fuehrt `GeschuetzteRoute` von `/` hierher.
      {
        element: <LoginSchrittRoute schritt="pin" />,
        children: [{ path: 'pin/pruefen', element: <PinEingabe />, handle: LOGIN_SCHRITT }],
      },
      {
        element: <LoginSchrittRoute schritt="name" />,
        children: [
          {
            path: 'anmelden',
            element: <Namensauswahl />,
            handle: LOGIN_SCHRITT,
          },
          // Die Admin-Anmeldung hat ein „Zurück“: zur Namensauswahl, von der der
          // Weg ausgeht (C4, 4.2). Die Folgeschritte gehen je einen Schritt zurück.
          {
            path: 'admin/anmelden',
            element: <AdminAnmeldung />,
            handle: { zurueck: LOGIN_PFADE.name } satisfies RoutenAngaben,
          },
          {
            path: 'admin/passwort/vergessen',
            element: <PasswortVergessen />,
            handle: { zurueck: ADMIN_PFADE.anmelden } satisfies RoutenAngaben,
          },
          {
            path: 'admin/passwort/neu',
            element: <PasswortNeu />,
            handle: { zurueck: ADMIN_PFADE.passwortVergessen } satisfies RoutenAngaben,
          },
        ],
      },

      // --- Nur mit abgeschlossener Anmeldung ------------------------------
      {
        element: <GeschuetzteRoute />,
        children: [
          { index: true, element: <Platzhalter titel="Start" paket="C5" /> },
          {
            path: 'termine/:terminId',
            element: <Platzhalter titel="Termin" paket="C5" />,
            handle: ZUM_DASHBOARD,
          },
          // Ziel offen bis C6: Die übergeordnete Ansicht ist voraussichtlich der
          // Termin – eine Zielangabe mit Parameter kennt `RoutenAngaben` noch nicht.
          { path: 'teams/:terminId', element: <Platzhalter titel="Teams" paket="C6" /> },
          // Die Einstellungen sind fuer jede angemeldete Person erreichbar; den
          // Benachrichtigungsbereich blendet die Ansicht fuer GAST selbst aus
          // (A25d), weil die zugehoerigen Endpunkte dort mit `403` antworten.
          {
            path: 'einstellungen',
            element: <Platzhalter titel="Einstellungen" paket="C8" />,
            handle: ZUM_DASHBOARD,
          },

          // --- Zusaetzlich nur fuer die Rolle ADMIN -------------------------
          {
            element: <AdminRoute />,
            children: [
              {
                path: 'admin',
                children: [
                  // Startseite der Administration (E1): kein „Zurück“, das den
                  // Admin ins User-Dashboard schickte. Der Platzhalter traegt den
                  // Einstieg in „Passwort aendern“, bis das Dashboard in C7 folgt.
                  {
                    index: true,
                    element: (
                      <Platzhalter titel="Administration" paket="C7">
                        <Textlink
                          to={ADMIN_PFADE.passwortAendern}
                          data-testid="admin-passwort-aendern-link"
                        >
                          Passwort ändern
                        </Textlink>
                      </Platzhalter>
                    ),
                    handle: { ohneZurueck: true } satisfies RoutenAngaben,
                  },
                  {
                    path: 'passwort/aendern',
                    element: <PasswortAendern />,
                    handle: { zurueck: ADMIN_PFADE.start } satisfies RoutenAngaben,
                  },
                ],
              },
            ],
          },
        ],
      },

      // Bewusst oeffentlich: Ein Tippfehler in der Adresse soll die Seite
      // „nicht gefunden" zeigen und nicht zur Anmeldung umleiten. Ohne
      // Zurueck-Schaltflaeche: Die Ansicht fuehrt selbst zur Startseite.
      { path: '*', element: <NichtGefunden />, handle: { ohneZurueck: true } satisfies RoutenAngaben },
    ],
  },
])
