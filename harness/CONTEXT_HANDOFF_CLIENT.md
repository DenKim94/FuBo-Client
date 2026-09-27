# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) um den
> frontendseitigen Anteil. Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.

> Projektordner: `<Projektordner>/PRJ_FuBo`, Frontend unter `client/`
> Git-Repository: **eigenständiges Repository mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`),
> Arbeitsbranch `dev_client`. **Kein Monorepo.** Das Backend liegt in einem getrennten Repository
> (`FuBo-Server`, Ordner `server/`). Der übergeordnete Ordner `PRJ_FuBo/` sowie `PRJ_FuBo/harness/`
> sind bewusst **nicht** versioniert; `client/harness/tmp/` ebenfalls nicht (Entscheidung 25.09.2026).
> Stand: 27.09.2026 (nach C1, nach dem Struktur-Umbau und den Schritten 1 bis 5 von C2).
> Vorfassung: `archive/CONTEXT_HANDOFF_CLIENT_2026-09-26.md`.

---

## 1. Kontext
Frontend der Anwendung **MONTAGS-KICKER**: Login (PIN, Namensauswahl, Gast), Terminteilnahme,
Teamübersicht, Ergebniserfassung sowie ein Admin-Dashboard. Mobile-First, durchgängig deutschsprachig,
Tablet/Desktop nachrangig. Zugang über zentrale PIN, danach Namensidentität. Rollen ADMIN, USER, GAST.
Ausgeliefert wird als installierbare PWA im Anzeigemodus `standalone` (A25a).

*„FuBo" ist Projekt- und Repositoriumsname und erscheint nicht in der Oberfläche.*

## 2. Techstack & Rahmen (Client)
- React 19, Vite 8, TypeScript 6, SCSS mit CSS Modules, TanStack Query, React Router 7.
- PWA: `vite-plugin-pwa` 1.3.0 mit **`strategies: 'injectManifest'`** und eigenem Service Worker
  (`src/sw.ts`), `registerType: 'prompt'`.
- Tests: Vitest + React Testing Library, Playwright (E2E).
- Hosting: Cloudflare Pages, Origin `app.<domain>`; API unter `api.<domain>`.
- UI-Vorgaben in `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Fassung vom 25.09.2026, gegen `AGENT.md`
  abgeglichen); Prototypen unter `/PRJ_FuBo/harness/assets/Design/FuBo_Design_Prototypen.html` als
  Referenz, Abweichungen zulässig.

## 3. Wichtige Entscheidungen (clientrelevant)
Vollständige Liste in `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`, Abschnitt 3. Frontendseitig besonders relevant:
- Authentifizierung über serverseitiges HttpOnly-Cookie; **kein Token im `localStorage`**, Aufrufe mit
  `credentials: 'include'`. Das Frontend kennt den Token nicht.
- Zweistufiger Login (PIN → Namensauswahl) gemäß Server-`stage`; `401` ⇒ automatischer Logout.
  Sitzung: gleitendes Leerlauf-Fenster **plus** harte, nicht verlängerbare Obergrenze – beide Werte
  liefert der Server (`gueltigBis`, `absolutGueltigBis`).
- **Keine Skillwerte für USER/GAST**: Skills erscheinen ausschließlich in Admin-Ansichten.
- Namensbelegung wird per TanStack-Query-Polling aktuell gehalten (belegte Namen ausgrauen).
  Zyklische Abrufe tragen den Kopf `X-FuBo-Kein-Refresh: true`, sonst läuft das gleitende Fenster nie
  ab, solange ein Tab offen ist.
- Teilnehmerliste ist **eine** bereits sortierte Liste mit `wartet`, nicht zwei; im Frontend nicht
  umsortieren. Balken rot unter der Mindestanzahl, sonst grün.
- Bei Teilnehmeränderung wird eine bestehende Team-Einteilung als veraltet gekennzeichnet.
- **Entscheidungen aus C0 (25.09.2026):** React Router statt TanStack Router; PWA über
  `injectManifest`; Anwendungsname `MONTAGS-KICKER` in Titel und Manifest;
  `client/harness/tmp/` unversioniert. Die damalige Festlegung auf deutsche Ordnernamen ist am
  27.09.2026 aufgehoben (Abschnitt 6.4).
- **Ergänzt am 26.09.2026:** Der Manifest-`short_name` ist **`GUT-KICK`**. Der `name` bleibt
  `MONTAGS-KICKER`, wird auf dem Startbildschirm aber nach rund zwölf Zeichen abgeschnitten; „FuBo"
  scheidet als Kurzform aus, weil der Projektname nicht in der Oberfläche erscheint.
- **Entscheidungen aus C1 (26.09.2026):**
  - **`aufrufen` aus `src/api/common/httpService.ts` ist der einzige Zugang zum Server.** Im Quellbaum gibt
    es genau ein `fetch(` – das ist zugleich der Abnahmetest des Pakets.
  - **Keine Übersetzungstabelle `Fehlercode → Text` im Frontend.** Der Server liefert `detail`
    deutschsprachig und oft genauer; eine zweite Fassung im Client liefe auseinander. Programmlogik
    verzweigt über `code`, nie über den Text.
  - **`openapi-typescript` wird nicht installiert, sondern über `npx` mit fester Fassung 7.13.0
    aufgerufen** (`npm run api:typen`). Das Werkzeug verlangt als Peer TypeScript 5, das Projekt fährt
    6; das Generat selbst übersetzt unter `strict` einwandfrei. Es läuft einmal und erzeugt eine
    eingecheckte Datei – ein Zwang in der Sperrdatei wäre dauerhaft, sein Grund in einem Jahr
    vergessen.
  - **Der MSW-Browser-Modus ist zurückgestellt.** `msw init` legte einen zweiten Service Worker im
    Geltungsbereich `/` an; ein Geltungsbereich trägt nur eine Registrierung, und die zweite ersetzt
    die erste stillschweigend. Entwickelt wird gegen den lokalen Server, getestet im Node-Modus.
  - **Der Offline-Zustand wird aus zwei Quellen gebildet**: `navigator.onLine` **und** dem Ergebnis
    des letzten Aufrufs (`src/api/common/verbindungsStatus.ts`). Der Browserwert meldet auch im WLAN ohne
    Weg ins Internet `true` – dem Alltagsfall am Sportplatz.

## 4. Schnittstelle zum Server (Vertrag)
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kernpunkte: REST/JSON gegen `api.<domain>`,
Aufrufe mit `credentials: 'include'`, zweistufiger Auth-Fluss, `401`/`403`-Behandlung, Teamdaten ohne
Skillwerte, Belegtstatus-Polling, einheitliches Fehler-JSON (`ProblemDetail` mit deutschsprachigem
`detail` und einem von 34 `Fehlercode`-Werten).

**Kontrakt-Kopie:** `client/harness/assets/fubo-api.json`, **44 Operationen**, am 25.09.2026 vom
Server-Stand aufgefrischt. **Am 26.09.2026 zweimal gegen `server/fubo-api.json` verglichen – zuletzt
vor der Typgenerierung in C1: byteweise identisch.** Das eingecheckte Generat
`src/api/common/types/schema.d.ts` stammt aus genau diesem Stand; eine Vertragsänderung wird dadurch im Diff
sichtbar. Sie trug zuvor nur 38 Operationen und kannte die sechs Push-Endpunkte aus A25 nicht –
daraus war der falsche Schluss entstanden, das serverseitige Paket S8 sei offen.
**Massgeblich bleibt `server/fubo-api.json`;** Vertragsänderungen werden immer zuerst dort abgebildet,
der Client zieht nach. Bei getrennten Repositories gibt es keinen gemeinsamen Commit.

Aus der Auffrischung folgt fachlich: Das Voll-Update der Konfiguration hat **fünfzehn** Pflichtfelder
(`pushAktiv` und `pushErinnerungStunden` sind hinzugekommen). Ein Formular, das eines weglässt,
bekommt `400`.

## 5. Meilensteine & Aufwandsschätzung (Client)
Mid-Level-Entwickler, KI-gestützt, ca. 6,5 h/Woche. **Neu geschnitten am 25.09.2026** – die
Begründung steht in Abschnitt 5.1.

| MS | Inhalt | Aufwand (h) | Stand |
|---|---|---|---|
| C0 | Projektfundament: Vorlagenreste, tsconfig/`strict`, Ordnerstruktur, SCSS inkl. `_globalVars.scss` und Safe-Area, Routing mit Zurück-Navigation, TanStack Query, PWA-Basis (`injectManifest`), `_headers`/`_redirects`, Dev-Proxy, Testwerkzeuge, CI | 14 | **abgeschlossen**: umgesetzt 25.09.2026, Abnahme auf dem Entwicklungsrechner erfolgreich, committet als `e6f8bad`, nachgeprüft und korrigiert am 26.09.2026 (Abschnitt 6.1) |
| C1 | Vertrag, Datenzugriff, Mocks: `openapi-typescript`, fetch-Schicht, Fehlerübersetzung, globales `401`, MSW, Offline-Hinweis | 10 | **abgeschlossen**: umgesetzt 26.09.2026 nach `harness/tmp/C1_UMSETZUNG.md`, verifiziert (Abschnitt 6.2) |
| C2 | Design-System & Basis-Layout: Tokens, Raster, Basis-Komponenten (Button, Dropdown, Balken, Info-Icon, Dialog, Lade-/Leer-/Fehlerzustand) | 12 | offen – Anleitung: `harness/tmp/C2_UMSETZUNG.md` (26.09.2026) |
| C3 | Sitzung & Spieler-Login: PIN, Namensauswahl mit Polling und Ausgrauen, Gast + Info-Icon + „(Gast)", Countdown, Erneuerung, Auto-Logout, Routen-Schutz | 14 | offen |
| C4 | Admin-Zugang: Login (zwei Pflichtfelder, zeichengenau), dreistufiger Passwort-Reset, Passwortwechsel | 8 | offen |
| C5 | Termin & Teilnahme: User-Dashboard, Zu-/Absage, Teilnehmerliste mit Balken und Warteschlange, Bilanz | 14 | offen |
| C6 | Teams & Ergebnis: Teamansicht inkl. Generierung, Kontingent, Veraltet-Kennzeichnung, Auswechselspieler, Ergebniseintrag | 12 | offen |
| C7 | Admin-Verwaltung: Profile + Skills, Gäste + Stufen, Termine (Einzel/Serie), PIN, Konfiguration (Voll-Update, 15 Pflichtfelder), Hallenabsage, Ergebniskorrektur, manueller Teamlauf | 20 | offen |
| C8 | PWA-Onboarding & Push (A25): Installationshinweis, Abonnement, Einstellungsansicht mit zwei Bedienelementen und dreiteiligem Zustand, Abo-Neuanmeldung bei Start, Benachrichtigungen im Service Worker | 14 | offen |
| C9 | Abnahme: E2E-Suite, Barrierefreiheit (WCAG 2.1 AA), Härtung, Deployment auf die feste Domain, Doku | 12 | offen |

**Summe 130 h** (vorher 96 h in sieben Paketen; der Fliesstext nannte damals ≈92 h, was mit der
Tabelle nicht zusammenpasste).

### 5.1 Warum neu geschnitten wurde

Drei strukturelle Lücken im alten Schnitt C0–C6:

1. **A25 hatte kein Paket.** PWA und Push steckten implizit in „Härtung". Der Server hat A25 aus genau
   diesem Grund zu einem eigenen Paket (S8) gemacht; der Client zieht nach. → C8.
2. **Die Vertragsanbindung fehlte vollständig.** Typgenerierung aus `fubo-api.json` und die
   Mock-Schicht sind an anderer Stelle vorgeschrieben, kamen aber in keinem Paket vor. → C1.
3. **Alle Tests lagen in C6.** Am Ende geschriebene Tests sind ein eigenes Projekt, kein
   Sicherheitsnetz. Die Werkzeuge stehen jetzt in C0, die Tests entstehen im jeweiligen Paket, und C9
   behält nur die E2E-Suite und die Abnahme.

Dazu zwei Schnittfehler: Die Teamansicht wurde in C3 gebaut und in C4 um Kontingent und
Veraltet-Hinweis erweitert – Nacharbeit an derselben Ansicht. Und C5 bündelte acht Admin-Screens mit
rund 15 Endpunkten in einem nicht prüfbaren Block.

**Zum Aufwand:** Die Differenz von 34 h ist überwiegend nicht Aufblähung, sondern bisher
Nichtbudgetiertes – rund 14 h für A25, rund 10 h für Vertrag und Mocks, der Rest Umverteilung und die
vorgezogenen Testwerkzeuge.

### 5.2 Abhängigkeiten

- **C1 bis C8 sind nicht blockiert.** Der Server ist fachlich vollständig (S0 bis S8, 44 Endpunkte);
  entwickelt wird gegen die Mock-Schicht aus C1 oder eine lokal gestartete Instanz.
- **C9 ist blockiert**, bis die Custom Domain `app.<domain>` in Cloudflare Pages steht. `pages.dev`
  steht auf der Public Suffix List und wäre gegenüber `api.<domain>` cross-site – das Sitzungs-Cookie
  mit `SameSite=Lax` ginge nicht mit, und die Anmeldung schlüge produktiv fehl. Zudem ist eine PWA an
  ihren Origin gebunden: Wer von `*.pages.dev` installiert, hat später zwei getrennte Anwendungen auf
  dem Gerät.

## 6. Aktueller Code-Zustand

**C0 und C1 sind abgeschlossen.** C0 wurde am 25.09.2026 umgesetzt (Commit `e6f8bad`) und am
26.09.2026 nachgeprüft (Abschnitt 6.1); C1 am 26.09.2026 (Abschnitt 6.2). Der C0-Stand im
Einzelnen:

- Vite-Vorlagenreste entfernt (`App.tsx`, `App.module.scss`, `main.scss`, `react.svg`, README).
- `tsconfig.app.json` mit `strict`, `DOM.Iterable`, `noUncheckedSideEffectImports`, Pfad-Alias `@/*`;
  eigener `tsconfig.worker.json` für den Service Worker (`lib: WebWorker`); die wirkungslose
  `types`-Angabe im Solution-File entfernt.
- Ordnerstruktur (Stand 27.09.2026 umgebaut, siehe Abschnitt 6.4)
  `src/{api,app,components,context,hooks,layouts,styles,test}`, Routenbaum mit
  Platzhaltern für C3 bis C8, `AppLayout` mit sichtbarer Zurück-Navigation und Safe-Area-Rändern.
- **Routen-Schutz in drei Ebenen** (`src/app/schutz/`): öffentlich (`/anmelden`,
  `/admin/anmelden`, „nicht gefunden"), `GeschuetzteRoute` (verlangt
  `stage = PROFILE_AUTHENTICATED`, eine Sitzung in `PIN_VERIFIED` gilt als nicht angemeldet) und
  darin `AdminRoute` (verlangt `rolle = ADMIN`, leitet sonst auf die Startseite statt zur Anmeldung).
  Beide sind **Bedienkomfort, keine Sicherheitsmassnahme** – durchgesetzt wird in der Filterchain des
  Servers. Quelle des Zustands ist `useSitzung` (TanStack Query auf
  `GET /auth/session/lesen`), nicht ein lokaler Kontext: Das Cookie ist HttpOnly, und ein lokales
  Abbild liefe beim Sitzungsablauf stillschweigend auseinander.
- SCSS-Fundament: `_globalVars.scss` (Farben als Platzhalter, Abstände, Tap-Ziel 44 px, Safe-Area),
  `_reset.scss`, `global.scss`.
- `index.html` mit `viewport-fit=cover`, `theme-color` und Titel `MONTAGS-KICKER`.
- PWA: `injectManifest` mit `src/sw.ts` (Precache der App-Shell, Navigationsroute mit `/api/`-Denylist,
  `SKIP_WAITING`), Manifest mit vier Ikonen inklusive einer neu erzeugten maskierbaren Fassung,
  `includeManifestIcons: false`, `devOptions` aktiv. `AktualisierungsHinweis` über
  `virtual:pwa-register/react`.
- `public/_headers` und `public/_redirects` gemäß den vier Cloudflare-Auflagen aus A25.
- Dev-Proxy `/api` → `localhost:8080`, `.env.example` mit `VITE_API_BASE_URL`.
- Vitest + RTL mit **neun Tests in drei Dateien** (Layout, `GeschuetzteRoute`, `AdminRoute`).
  Playwright mit **sieben Geräteprojekten** (360 px bis Desktop, nach Breite sortiert) und zwei
  Testdateien: `layout.spec.ts` läuft überall (Rahmen, Zurück-Navigation, Tap-Ziel 44×44 px, kein
  waagerechtes Scrollen, Verbrauch der Safe-Area-Tokens), `pwa.spec.ts` nur in den drei
  Chromium-Projekten (Service Worker, Manifest, Inhaltstyp von `sw.js`), weil Playwright Service
  Worker nur dort unterstützt. `npm run e2e:browser` installiert Chromium und WebKit. CI-Workflow für
  Lint, Typprüfung, Bau und Unit-Tests.
- Vier `tsconfig`-Teilprojekte: `app`, `node`, `worker` (Service Worker, `lib: WebWorker`) und `e2e`
  (DOM-Typen für die Rückrufe von `page.evaluate`). Ohne Letzteres lagen die E2E-Tests ausserhalb
  jeder Typprüfung.
- `.gitignore` um `dev-dist`, Testartefakte, `harness/tmp/` und `!.env.example` ergänzt.

### 6.1 Nachprüfung und Korrekturen vom 26.09.2026

Der abgeschlossene C0-Stand wurde gegen `harness/tmp/C0_UMSETZUNG.md` und die Vorgaben geprüft. Sechs
Punkte wurden korrigiert; die ersten beiden sind sachlich, die übrigen betreffen Vorgabentreue und
Dokumentation.

1. **`npm ci` schlug fehl – und damit jeder CI-Lauf.** `package-lock.json` war nicht mit
   `package.json` synchron: Fehlermeldung `Missing: sass@1.103.1 from lock file`. Ursache ist das
   `npm uninstall sass` aus C0, Schritt 2.3. Die Plattform-Rückfallpakete
   `sass-embedded-all-unknown` und `sass-embedded-unknown-all` hängen hart an `sass`; npm hat den
   Eintrag `node_modules/sass` beim Deinstallieren aber aus der Sperrdatei entfernt. Behoben mit
   `npm install --package-lock-only`; der Eintrag steht jetzt als `optional: true, dev: true` darin
   und wird auf bekannten Plattformen nicht mitinstalliert. Nebenbei hat npm vierzehn veraltete
   `"peer": true`-Vermerke bereinigt.
   **Warum das durch die Abnahme fiel:** Auf dem Entwicklungsrechner wurde `npm install` gefahren,
   und das schreibt die Sperrdatei stillschweigend zurecht, statt sie zu prüfen. Nur `npm ci`
   vergleicht beide Dateien – und genau das tut CI als ersten Schritt. Nach jedem `npm uninstall`
   gehört deshalb ein `npm ci` in einem frischen Baum dazu.
2. **`public/_headers` erreichte die Wurzel nicht.** Es gab eine Regel für `/index.html`, aber keine
   für `/`. Cloudflare Pages wertet den **angefragten Pfad** aus, nicht die ausgelieferte Datei – der
   Einstieg in die Anwendung blieb damit ohne ausdrückliche `Cache-Control`-Vorgabe. Block für `/`
   ergänzt.
3. **Manifest-`short_name` war `FuBo`.** Das widersprach zwei Vorgaben zugleich: „`name` und
   `short_name` sind `MONTAGS-KICKER`" und „FuBo erscheint nicht in der Oberfläche" – der
   `short_name` ist genau die Beschriftung unter dem Symbol auf dem Startbildschirm. Neu:
   **`GUT-KICK`**, acht Zeichen und damit unterhalb der Kürzungsgrenze. `e2e/pwa.spec.ts` prüft den
   Wert und die Länge jetzt mit, damit er nicht unbemerkt zurückfällt.
4. **Stil-Importe hießen teils `stile`.** `AGENT_CLIENT.md` schreibt `style` vor
   (`import style from './Platzhalter.module.scss'`). In `AppLayout.tsx` und `Platzhalter.tsx`
   umbenannt; `AktualisierungsHinweis.tsx` war bereits richtig.
5. **Sichtbarer Text ohne Umlaut.** Die Zurück-Schaltfläche beschriftete sich mit „Zurueck". Die
   Umlautfreiheit gilt für Bezeichner, nicht für Oberflächentext – jetzt „Zurück".
6. **Zahlenangaben in der Dokumentation stimmten nicht mehr.** `playwright.config.ts` führt **sieben**
   Projekte (drei Chromium, vier WebKit), nicht acht; die Unit-Tests sind neun, nicht zwei. Die Zahlen
   in diesem Dokument, in `AGENT_CLIENT.md`, in `playwright.config.ts` und im CI-Kommentar wurden
   nachgezogen. Ausserdem nannte `AGENT_CLIENT.md` für die Offline-Seite `no_connection_icon.svg`,
   während `vite.config.ts` die rote Fassung vorhält; die Doku folgt jetzt dem Code.

**Verifiziert am 26.09.2026** in einer sauberen Linux-Umgebung gegen einen frischen `npm ci`:
Typprüfung über vier Teilprojekte, ESLint, **neun Unit-Tests**, vollständiger Bau (sechs
Precache-Einträge, Manifest mit `short_name: GUT-KICK` und vier Ikonen) und **27 E2E-Tests über die
drei Chromium-Projekte**, darunter die tatsächliche Registrierung des Service Workers und die Prüfung
des Inhaltstyps von `sw.js`. Die geprüfte `package-lock.json` ist byteweise identisch mit der im
Arbeitsbaum.

**Nicht erneut geprüft:** die vier WebKit-Projekte (der WebKit-Download ist in der Prüfumgebung durch
die Netzrichtlinie gesperrt) sowie die Handprüfungen auf einem echten Gerät. Beides ist bei der
Abnahme am 25./26.09.2026 auf dem Entwicklungsrechner gelaufen.

### 6.2 C1 – Vertrag, Datenzugriff und Mocks (26.09.2026)

Umgesetzt nach `harness/tmp/C1_UMSETZUNG.md`. Nach C1 gibt es **einen** Weg zum Server und **einen**
Weg, ohne ihn zu entwickeln.

- **Vertragstypen:** `src/api/common/types/schema.d.ts` (4638 Zeilen) aus `harness/assets/fubo-api.json` erzeugt
  und **eingecheckt**; aufgefrischt mit `npm run api:typen`. Der Kontrakt wurde vorher gegen
  `server/fubo-api.json` verglichen: byteweise identisch, 44 Operationen, 59 Schemata, 34
  Fehlercodes. Das Generat steht in `eslint.config.js` auf der Ignorierliste – der Kontrakt trägt in
  seinen Beschreibungstexten geschützte Leerzeichen, die `no-irregular-whitespace` melden würde, und
  eine Korrektur von Hand wäre beim nächsten Erzeugen wieder weg.
- **`src/api/common/fehler.ts`:** `ApiFehler` mit `status`, `code`, Anzeigetext und – nur bei `429` – der
  Restwartezeit aus dem Rumpf. Dazu `istNetzfehler`, damit keine Ansicht auf `TypeError` prüfen muss,
  um „es kam gar keine Antwort" von „der Server hat abgelehnt" zu unterscheiden.
- **`src/api/common/httpService.ts`:** `aufrufen(methode, pfad, optionen)` – `credentials: 'include'`,
  `Content-Type` nur bei vorhandenem Rumpf, `X-FuBo-Kein-Refresh` über `keinRefresh: true`,
  `204` → `undefined` (23 der 44 Operationen), jede Fehlerantwort als `ApiFehler`. **Einziges
  `fetch(` im Quellbaum.**
- **`src/app/queryClient.ts`:** `QueryCache`/`MutationCache` mit gemeinsamer `401`-Behandlung –
  Cache leeren, dann der über `sitzungsendeBehandeln` hinterlegte Rückruf. Die Wiederholungsregel
  unterscheidet jetzt: unter `500` kein zweiter Versuch (bei `429` verschärfte er die Sperre), sonst
  einer.
- **`src/app/SitzungsWaechter.tsx`:** verbindet die `401`-Behandlung mit dem Router (`navigate` mit
  `replace`), hängt im `AppLayout` und rendert nichts. Kein `window.location` – ein harter
  Seitenwechsel würfe die Anwendung weg und zeigte ein weißes Bild.
- **`src/api/common/schluessel.ts`:** alle Query-Schlüssel an einem Ort; `SITZUNG_SCHLUESSEL` aus
  `useSitzung` ist durch `schluessel.sitzung` ersetzt.
- **`src/api/sitzung/sitzung.ts` abgelöst:** nutzt `aufrufen`, Typen kommen aus dem Generat, `401` wird
  **lokal** zu `null` – sonst liefe der Startaufruf jedes nicht angemeldeten Besuchers in die globale
  Umleitung nach `/anmelden`, wo derselbe Aufruf wieder stattfindet. Die Signatur bleibt
  aufwärtskompatibel (`keinRefresh` mit Vorgabewert), die Guards aus C0 sind unberührt.
  **Achtung für C3:** In `useSitzung` ist die Abfrage als `() => sitzungLesen()` gekapselt. Direkt
  übergeben bekäme die Funktion den Kontext von TanStack Query als ersten Parameter – der wäre
  truthy, jeder Aufruf trüge den Kopf `X-FuBo-Kein-Refresh`, und das gleitende Fenster wanderte nie.
- **Mock-Schicht:** `src/test/mocks/handlers.ts` (Sitzung, `204`, `ProblemDetail`) und
  `src/test/mocks/server.ts`; `src/test/setup.ts` startet sie mit `onUnhandledRequest: 'error'` und
  setzt die Handler nach jedem Test zurück. Der Browser-Modus ist zurückgestellt (Abschnitt 3).
- **Offline-Hinweis:** `src/api/common/verbindungsStatus.ts` (Zustand aus den tatsächlichen Aufrufen, ohne
  React), `src/hooks/useVerbindung.ts` (`useSyncExternalStore` über Browser-Ereignisse **und** diesen
  Zustand) und `src/components/OfflineHinweis/` – ein klebender Streifen unter dem Kopf. Das Symbol
  kommt als CSS-Hintergrund und nicht über ein `img`: Ohne aktiven Service Worker liegt es noch nicht
  im Precache und erschiene sonst ausgerechnet im Fehlerfall als kaputtes Bild.
- **Tests:** 35 Unit- und Komponententests in acht Dateien (vorher neun in drei). Neu:
  `httpService.test.ts` (11), `sitzung.test.ts` (5), `queryClient.test.ts` (5),
  `OfflineHinweis.test.tsx` (4), `SitzungsWaechter.test.tsx` (1).

**Verifiziert am 26.09.2026** in einer sauberen Linux-Umgebung gegen einen frischen `npm ci`:
Typprüfung über vier Teilprojekte, ESLint, 35 Unit-Tests, vollständiger Bau (**sechs**
Precache-Einträge, darunter `icons/no_connection_icon_red.svg`, **kein** `mockServiceWorker.js`) und
**27 E2E-Tests über die drei Chromium-Projekte**. Dazu eine Sichtprüfung des Offline-Hinweises bei
360 px Breite im Praxisfall „Netz vorhanden, Server nicht erreichbar".

**Nicht geprüft:** die vier WebKit-Projekte (der Browser-Download ist in der Prüfumgebung durch die
Netzrichtlinie gesperrt) sowie die Prüfpunkte 9 und 11 der Abnahmeliste gegen eine **laufende
Serverinstanz** – Sitzungscookie im Netzwerkfenster und serverseitig beendete Sitzung. Der
Umleitungspfad bei `401` ist stattdessen über `SitzungsWaechter.test.tsx` abgedeckt.

### 6.3 Bewusst offen gelassen

- **`navigate(-1)` in `AppLayout`.** Wird die Anwendung direkt auf einer Unterseite geöffnet – Deeplink
  oder Start der installierten PWA –, hat der Verlauf keinen Vorgänger, und die Schaltfläche tut
  nichts. Der Fall ist in C2 zu lösen, wenn die Schaltfläche eine optionale Zielangabe bekommt.
- **Die Anmeldeseite löst von sich aus keinen Aufruf aus.** Solange `/anmelden` nur einen Platzhalter
  zeigt, bleibt der Offline-Hinweis dort aus, wenn der Browser ein Netz sieht – es gibt keinen
  fehlschlagenden Aufruf, der das Gegenteil belegen könnte. Mit der PIN-Prüfung in C3 erledigt sich
  das; der harte Fall (`navigator.onLine === false`) wird schon heute überall angezeigt.
- **Der Personenkreis der Query-Schlüssel ist vorläufig.** `src/api/common/schluessel.ts` führt die absehbaren
  Einträge; jedes fachliche Paket ergänzt seine eigenen dort und nirgends sonst.
- **`npm audit` meldet drei moderate Befunde** in `@vitest/mocker` (Pfad-Traversal, nur
  Entwicklungsabhängigkeit). Die Behebung verlangt Vitest 5 und damit einen Fassungssprung; das ist
  eine eigene Entscheidung und gehört nicht in C1. Der Befund bestand bereits vor diesem Paket.

### 6.4 Umbau der Ordnerstruktur (27.09.2026)

Der Quellbaum ist vom Entwickler auf ein Muster mit englischen Ordnernamen und Domänenordnern im
Datenzugriff umgestellt worden. Das verbindliche Muster steht in `AGENT_CLIENT.md`, Abschnitt
„Ordnerstruktur und Domänenkonsistenz"; es hebt die C0-Festlegung auf deutsche Ordnernamen auf.
Bezeichner, Kommentare und Oberflächentext bleiben deutsch.

| Vorher | Nachher |
|---|---|
| `src/api/*.ts` (flach) | `src/api/common/` (Querschnitt) und `src/api/<domaene>/` – zuerst `src/api/sitzung/` |
| `src/api/schema.d.ts` | `src/api/common/types/schema.d.ts` |
| `src/komponenten/<Name>/` | `src/components/<Name>/` |
| `src/seiten/Platzhalter/` | `src/components/Platzhalter/` |
| – | `src/context/` (leer, für React-Kontexte ab C3) |

**Bei der Prüfung des Umbaus gefunden und behoben** – beides sind Verweise außerhalb des Quellbaums,
die der Umzug nicht mitnimmt:

1. **`eslint.config.js` ignorierte das Generat am alten Pfad.** `npm run lint` scheiterte an
   `src/api/common/types/schema.d.ts:664` mit `no-irregular-whitespace` – dem geschützten Leerzeichen
   aus einem Beschreibungstext des Kontrakts. Der Befund sah wie ein Codefehler aus, war aber eine
   veraltete Ignorierliste. Pfad nachgezogen.
2. **`package.json` schrieb `api:typen` an den alten Ort.** Der Lauf hätte beim nächsten
   Vertragsstand eine **zweite** Schemadatei unter `src/api/schema.d.ts` angelegt, während die
   Importe weiter auf die alte Fassung unter `common/types/` zeigen – eine Vertragsänderung wäre
   erzeugt, aber nicht wirksam geworden. Ausgabepfad nachgezogen.

Sonst war der Umbau vollständig: Typprüfung über vier Teilprojekte, 35 Unit-Tests und der Bau
(sechs Precache-Einträge) liefen unverändert durch, und die Suche nach verwaisten Pfaden im Quellbaum
blieb ohne Treffer.

**Offene Notiz aus dem Umbau:** In `src/hooks/useVerbindung.ts` steht ein `TODO`, der Hook liefere
`true`, obwohl keine Verbindung zum Server besteht. Das ist der in Abschnitt 6.3 festgehaltene
Zustand und kein Fehler im Hook: Ohne einen fehlgeschlagenen Aufruf gibt es keinen Beweis für das
Gegenteil, und `/anmelden` löst bis C3 keinen Aufruf aus. Der Kommentar ist entsprechend präzisiert;
aufgelöst wird der Fall mit der PIN-Prüfung in C3 (oder früher durch einen eigenen Erreichbarkeitsruf,
der dafür aber einen Endpunkt und eine Entscheidung gegen „Offline-Fähigkeit ist kein Ziel" bräuchte).

## 7. Nächste Schritte

1. **Handprüfung zu C1 gegen eine laufende Serverinstanz** (Prüfpunkte 9 und 11 aus
   `harness/tmp/C1_UMSETZUNG.md`): `npm run dev` gegen den Server, im Netzwerkfenster prüfen, dass
   jeder Aufruf das Sitzungscookie trägt; anschliessend die Sitzung serverseitig beenden und eine
   Aktion auslösen – erwartet wird die Umleitung auf `/anmelden` ohne Neuladen der Seite.
2. **C2 umsetzen** nach `harness/tmp/C2_UMSETZUNG.md`: Tokens, Raster, Button, Dropdown, Balken,
   Info-Icon, Dialog sowie Lade-, Leer- und Fehlerzustand. Letzterer setzt unmittelbar auf `ApiFehler`
   aus C1 auf. Die Farbwerte in `_globalVars.scss` sind bis dahin Platzhalter; die Kontrastprüfung
   nach WCAG 2.1 AA gehört dorthin. Ebenfalls in C2: die Zielangabe für die Zurück-Schaltfläche
   (Abschnitt 6.3) und die endgültige Gestaltung des Offline-Hinweises.
3. **Vor jedem Commit** prüfen, dass weder `.env`-Inhalte noch reale Personennamen mitgehen. Nichts
   nach `main`.
4. **`npm ci` in einem frischen Baum** nach jeder Änderung an den Abhängigkeiten – nicht nur
   `npm install` (Begründung in Abschnitt 6.1, Punkt 1).
5. **Betriebsaufgabe ohne Code:** Custom Domain `app.<domain>` in Cloudflare Pages einrichten,
   Rocket Loader und Auto-Minify für diese Domain abschalten. Die Adresse erst an die Spieler
   verteilen, wenn sie die endgültige ist.

## 8. Weitere Anweisungen
- **Repository-Konventionen:** Repo-Wurzel ist `client/`. Branch-Namen mit `dev_xxx` (initial `dev_client`).
- **Getrennte Repositories:** Änderungen an Client und Server können nicht in einem gemeinsamen Commit
  erfolgen. Bei Vertragsänderungen zuerst `server/fubo-api.json` prüfen, dann die Kopie unter
  `client/harness/assets/` auffrischen, dann die generierten Typen und die Mock-Schicht nachziehen.
  Beim Auffrischen den Unterschied ansehen, nicht blind überschreiben.
- Ohne ausdrückliche Anweisung des Entwicklers nichts in `main` mergen/pushen; Feature-Branch erlaubt.
- `.env`-Dateien nie einchecken. Dokumentation in deutscher Sprache. **Keine realen Personennamen** in
  Code, Testdaten oder Dokumentation.
- Zu jeder Komponente eine eigene Style-Datei (`<Komponentenname>.module.scss`); der Import heißt
  `style`. Globale Variablen in `_globalVars.scss`. In Sass `@use`/`@forward` statt `@import`. Jedes
  bedienbare Element trägt ein `data-testid`.
- Nach Abschluss eines Arbeitspakets kurze visuelle Verifikation durchführen und diesen Handoff
  aktualisieren (veraltete Fassung zuvor unter `client/harness/archive/` ablegen).
  Zudem ist `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) nachzuziehen.
  *Hinweis:* `/PRJ_FuBo/harness/` liegt **außerhalb** dieses Repositories und wird nicht mitcommittet.
- Falls diese Datei die Länge von **500 Zeilen** überschreitet, ist diese auf die wesentlichen Punkte
  zusammenzufassen.
