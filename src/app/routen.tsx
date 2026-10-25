import type { ReactElement } from 'react'
import { createBrowserRouter } from 'react-router'
import AppLayout from '@/layouts/AppLayout/AppLayout'
import type { RoutenAngaben } from '@/app/routenAngaben'
import AdminRoute from '@/app/schutz/AdminRoute'
import GeschuetzteRoute from '@/app/schutz/GeschuetzteRoute'
import LoginSchrittRoute from '@/app/schutz/LoginSchrittRoute'
import { ADMIN_PFADE, LOGIN_PFADE } from '@/app/schutz/zielpfad'
import StartLader from '@/components/StartLader/StartLader'
import DashboardLayout from '@/layouts/DashboardLayout/DashboardLayout'
import Dashboard from '@/pages/Dashboard/Dashboard'
import Einstellungen from '@/pages/Einstellungen/Einstellungen'
import ErgebnisSeite from '@/pages/ErgebnisSeite/ErgebnisSeite'
import Namensauswahl from '@/pages/Namensauswahl/Namensauswahl'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import PinEingabe from '@/pages/PinEingabe/PinEingabe'
import TeamsSeite from '@/pages/TeamsSeite/TeamsSeite'
import TerminDetail from '@/pages/TerminDetail/TerminDetail'
import VerlaufSeite from '@/pages/VerlaufSeite/VerlaufSeite'

/** Login-Schritte haben kein sinnvolles „Zurück" (siehe `RoutenAngaben`). */
const LOGIN_SCHRITT: RoutenAngaben = { ohneZurueck: true }

/**
 * Ansichten direkt unter dem Dashboard: „Zurück" führt dorthin, nicht einen
 * Schritt im Verlauf (C2, Abschnitt 6.1). Routen ohne eindeutige übergeordnete
 * Ansicht bleiben ohne Angabe und gehen einen Schritt zurück.
 */
const ZUM_DASHBOARD: RoutenAngaben = { zurueck: LOGIN_PFADE.start }

/**
 * Die vier Bereiche des Dashboards (Termine, Teams, Ergebnisse, Verlauf) sind
 * gleichrangig: Von dort gibt es kein „Zurück“, die Tab-Leiste ist der Weg (C5, E12).
 */
const OHNE_ZURUECK: RoutenAngaben = { ohneZurueck: true }

/** Verwaltungsansichten direkt unter dem Admin-Dashboard: „Zurück“ führt immer dorthin (C7, E1). */
const ZUM_ADMIN_DASHBOARD: RoutenAngaben = { zurueck: ADMIN_PFADE.start }

/** Anlegen und Profilansicht: „Zurück“ führt zur Liste, nicht einen Schritt im Verlauf (C7, 7.3). */
const ZUM_ADMIN_PROFILE: RoutenAngaben = { zurueck: ADMIN_PFADE.profile }

/**
 * Bearbeiten eines Profils: „Zurück“ führt zur Profilansicht desselben Profils (Prototyp 09b → 09c). Ist die Id
 * ungültig, zeigt die Seite „nicht gefunden“ und das Ziel ist die Liste.
 */
const ZUR_PROFILANSICHT: RoutenAngaben = {
  zurueck: ({ spielerId }) =>
    spielerId !== undefined && /^[1-9]\d*$/.test(spielerId)
      ? ADMIN_PFADE.profilDetail(Number(spielerId))
      : ADMIN_PFADE.profile,
}

/** Anlegen und Verwalten eines Termins: „Zurück“ führt zur Terminliste (C7, 8.3). */
const ZUM_ADMIN_TERMINE: RoutenAngaben = { zurueck: ADMIN_PFADE.termine }

/** Lädt alle Admin-Ansichten als ein gemeinsames Paket (Begründung in `adminSeiten.ts`). */
const adminSeitenLaden = () => import('@/app/adminSeiten')

/** Die Seiten aus `adminSeiten.ts`. */
type AdminSeiten = Awaited<ReturnType<typeof adminSeitenLaden>>

/**
 * Lazy Route für eine Admin-Ansicht: Das Paket wird erst geladen, wenn eine Admin-Adresse angesteuert wird.
 *
 * Während des Ladens bleibt die bisherige Ansicht stehen (der Router wartet, bevor er wechselt); beim Direktaufruf
 * einer Admin-Adresse zeigt die Wurzel `StartLader`. **Nachladen ist kein Schutz:** Wer eine Admin-Adresse
 * aufruft, lädt den Code, bevor `AdminRoute` prüft. Der Code enthält keine Daten; die Durchsetzung liegt im Server.
 *
 * @param erzeugen Baut das Element aus den geladenen Seiten, etwa `(s) => <s.AdminTermine />`.
 */
function adminSeite(erzeugen: (seiten: AdminSeiten) => ReactElement) {
  return async () => ({ element: erzeugen(await adminSeitenLaden()) })
}

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
 *
 * **Admin-Ansichten werden nachgeladen** (`adminSeite`, 18.10.2026): Spieler laden
 * den Admin-Bereich nie, der Start wird kleiner.
 */
export const routen = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    // Steht nur beim Start, solange ein nachgeladenes Paket fehlt (Direktaufruf einer Admin-Adresse).
    hydrateFallbackElement: <StartLader />,
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
            lazy: adminSeite((s) => <s.AdminAnmeldung />),
            handle: { zurueck: LOGIN_PFADE.name } satisfies RoutenAngaben,
          },
          {
            path: 'admin/passwort/vergessen',
            lazy: adminSeite((s) => <s.PasswortVergessen />),
            handle: { zurueck: ADMIN_PFADE.anmelden } satisfies RoutenAngaben,
          },
          {
            path: 'admin/passwort/neu',
            lazy: adminSeite((s) => <s.PasswortNeu />),
            handle: { zurueck: ADMIN_PFADE.passwortVergessen } satisfies RoutenAngaben,
          },
        ],
      },

      // --- Nur mit abgeschlossener Anmeldung ------------------------------
      {
        element: <GeschuetzteRoute />,
        children: [
          // Die vier Bereiche teilen sich `DashboardLayout` (Tab-Leiste; der Admin
          // geht von dort nach `/admin`, E7). Alle vier Bereiche sind ausgebaut.
          {
            element: <DashboardLayout />,
            children: [
              { index: true, element: <Dashboard />, handle: OHNE_ZURUECK },
              { path: 'teams', element: <TeamsSeite />, handle: OHNE_ZURUECK },
              { path: 'ergebnisse', element: <ErgebnisSeite />, handle: OHNE_ZURUECK },
              { path: 'verlauf', element: <VerlaufSeite />, handle: OHNE_ZURUECK },
            ],
          },
          // Detailansichten stehen ausserhalb des Layouts: keine Tab-Leiste (E12).
          { path: 'termine/:terminId', element: <TerminDetail />, handle: ZUM_DASHBOARD },
          // Ohne Zielangabe: Die uebergeordnete Ansicht ist der Termin, eine Zielangabe
          // mit Parameter kennt `RoutenAngaben` nicht. „Zurueck“ geht einen Schritt im
          // Verlauf, beim Direkteinstieg zur Startseite.
          { path: 'teams/:terminId', element: <TeamsSeite /> },
          // Wie `teams/:terminId`: ohne Zielangabe (vom Verlauf oder vom Termin aus erreichbar).
          { path: 'ergebnisse/:terminId', element: <ErgebnisSeite /> },
          // Die Einstellungen sind fuer jede angemeldete Person erreichbar; den
          // Benachrichtigungsbereich blendet die Ansicht fuer GAST selbst aus
          // (A25d), weil die zugehoerigen Endpunkte dort mit `403` antworten (C9).
          // Nicht im Admin-Paket: Die Seite gehoert allen Angemeldeten. „Zurück“
          // fuehrt zur Startseite; fuer den Admin leitet `/` nach `/admin` weiter.
          { path: 'einstellungen', element: <Einstellungen />, handle: ZUM_DASHBOARD },

          // --- Zusaetzlich nur fuer die Rolle ADMIN -------------------------
          {
            element: <AdminRoute />,
            children: [
              {
                path: 'admin',
                children: [
                  // Startseite der Administration (E1): kein „Zurück“, das den
                  // Admin ins User-Dashboard schickte. Von hier erreicht er jede Verwaltung.
                  { index: true, lazy: adminSeite((s) => <s.AdminDashboard />), handle: OHNE_ZURUECK },
                  {
                    path: 'passwort/aendern',
                    lazy: adminSeite((s) => <s.PasswortAendern />),
                    handle: ZUM_ADMIN_DASHBOARD,
                  },

                  // --- Zugangsdaten (C7, Stufe 1) -----------------------------
                  { path: 'pin', lazy: adminSeite((s) => <s.AdminPin />), handle: ZUM_ADMIN_DASHBOARD },
                  { path: 'name/aendern', lazy: adminSeite((s) => <s.AdminNameAendern />), handle: ZUM_ADMIN_DASHBOARD },
                  {
                    path: 'name/bestaetigen',
                    lazy: adminSeite((s) => <s.AdminNameBestaetigen />),
                    handle: { zurueck: ADMIN_PFADE.nameAendern } satisfies RoutenAngaben,
                  },

                  // --- Verwaltungen -------------------------------------------
                  // `neu` steht vor dem dynamischen Segment; React Router wertet statische vor dynamischen Pfaden.
                  // --- Spielerprofile (C7, Stufe 2) ---------------------------
                  { path: 'profile', lazy: adminSeite((s) => <s.AdminProfile />), handle: ZUM_ADMIN_DASHBOARD },
                  { path: 'profile/neu', lazy: adminSeite((s) => <s.AdminProfilFormular modus="neu" />), handle: ZUM_ADMIN_PROFILE },
                  { path: 'profile/:spielerId', lazy: adminSeite((s) => <s.AdminProfilDetail />), handle: ZUM_ADMIN_PROFILE },
                  {
                    path: 'profile/:spielerId/bearbeiten',
                    lazy: adminSeite((s) => <s.AdminProfilFormular modus="bearbeiten" />),
                    handle: ZUR_PROFILANSICHT,
                  },
                  { path: 'termine', lazy: adminSeite((s) => <s.AdminTermine />), handle: ZUM_ADMIN_DASHBOARD },
                  // „neu“ steht vor „:terminId“, damit der Pfad nicht als Id gelesen wird.
                  { path: 'termine/neu', lazy: adminSeite((s) => <s.AdminTerminNeu />), handle: ZUM_ADMIN_TERMINE },
                  { path: 'termine/:terminId', lazy: adminSeite((s) => <s.AdminTerminDetail />), handle: ZUM_ADMIN_TERMINE },
                  { path: 'gaeste', lazy: adminSeite((s) => <s.AdminGaeste />), handle: ZUM_ADMIN_DASHBOARD },
                  { path: 'konfiguration', lazy: adminSeite((s) => <s.AdminKonfiguration />), handle: ZUM_ADMIN_DASHBOARD },
                  { path: 'teams', lazy: adminSeite((s) => <s.AdminTeams />), handle: ZUM_ADMIN_DASHBOARD },
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
