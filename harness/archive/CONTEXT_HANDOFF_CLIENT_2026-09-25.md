# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) um den
> frontendseitigen Anteil. Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.

> Projektordner: `<Projektordner>/PRJ_FuBo`, Frontend unter `client/`
> Git-Repository: **eigenständiges Repository mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`),
> Arbeitsbranch `dev_client`. **Kein Monorepo.** Das Backend liegt in einem getrennten Repository
> (`FuBo-Server`, Ordner `server/`). Der übergeordnete Ordner `PRJ_FuBo/` sowie `PRJ_FuBo/harness/`
> sind bewusst **nicht** versioniert; `client/harness/tmp/` ebenfalls nicht (Entscheidung 25.09.2026).
> Stand: 25.09.2026. Vorfassung: `archive/CONTEXT_HANDOFF_CLIENT_2026-09-16.md`.

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
- Teilnehmerliste ist **eine** bereits sortierte Liste mit `wartet`, nicht zwei; im Frontend nicht
  umsortieren. Balken rot unter der Mindestanzahl, sonst grün.
- Bei Teilnehmeränderung wird eine bestehende Team-Einteilung als veraltet gekennzeichnet.
- **Entscheidungen aus C0 (25.09.2026):** React Router statt TanStack Router; PWA über
  `injectManifest`; deutsche Ordnernamen im Quellbaum; Anwendungsname `MONTAGS-KICKER` in Titel und
  Manifest; `client/harness/tmp/` unversioniert.

## 4. Schnittstelle zum Server (Vertrag)
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kernpunkte: REST/JSON gegen `api.<domain>`,
Aufrufe mit `credentials: 'include'`, zweistufiger Auth-Fluss, `401`/`403`-Behandlung, Teamdaten ohne
Skillwerte, Belegtstatus-Polling, einheitliches Fehler-JSON (`ProblemDetail` mit deutschsprachigem
`detail` und einem von 34 `Fehlercode`-Werten).

**Kontrakt-Kopie:** `client/harness/assets/fubo-api.json`, **44 Operationen**, am 25.09.2026 vom
Server-Stand aufgefrischt. Sie trug zuvor nur 38 Operationen und kannte die sechs Push-Endpunkte aus
A25 nicht – daraus war der falsche Schluss entstanden, das serverseitige Paket S8 sei offen.
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
| C0 | Projektfundament: Vorlagenreste, tsconfig/`strict`, Ordnerstruktur, SCSS inkl. `_globalVars.scss` und Safe-Area, Routing mit Zurück-Navigation, TanStack Query, PWA-Basis (`injectManifest`), `_headers`/`_redirects`, Dev-Proxy, Testwerkzeuge, CI | 14 | **umgesetzt 25.09.2026**, Abnahme auf dem Entwicklungsrechner erfoglreich |
| C1 | Vertrag, Datenzugriff, Mocks: `openapi-typescript`, fetch-Schicht, Fehlerübersetzung, globales `401`, MSW, Offline-Hinweis | 10 | offen |
| C2 | Design-System & Basis-Layout: Tokens, Raster, Basis-Komponenten (Button, Dropdown, Balken, Info-Icon, Dialog, Lade-/Leer-/Fehlerzustand) | 12 | offen |
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

**C0 ist umgesetzt** (25.09.2026, noch nicht committet). Der Stand im Einzelnen:

- Vite-Vorlagenreste entfernt (`App.tsx`, `App.module.scss`, `main.scss`, `react.svg`, README).
- `tsconfig.app.json` mit `strict`, `DOM.Iterable`, `noUncheckedSideEffectImports`, Pfad-Alias `@/*`;
  eigener `tsconfig.worker.json` für den Service Worker (`lib: WebWorker`); die wirkungslose
  `types`-Angabe im Solution-File entfernt.
- Ordnerstruktur `src/{api,app,hooks,layouts,komponenten,seiten,styles,test}`, Routenbaum mit
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
- Vitest + RTL (zwei Komponententests). Playwright mit **acht Geräteprojekten** (360 px bis Desktop,
  nach Breite sortiert) und zwei Testdateien: `layout.spec.ts` läuft überall (Rahmen,
  Zurück-Navigation, Tap-Ziel 44×44 px, kein waagerechtes Scrollen, Verbrauch der Safe-Area-Tokens),
  `pwa.spec.ts` nur in Chromium-Projekten (Service Worker, Manifest, Inhaltstyp von `sw.js`), weil
  Playwright Service Worker nur dort unterstützt. `npm run e2e:browser` installiert Chromium und
  WebKit. CI-Workflow für Lint, Typprüfung, Bau und Unit-Tests.
- Vier `tsconfig`-Teilprojekte: `app`, `node`, `worker` (Service Worker, `lib: WebWorker`) und `e2e`
  (DOM-Typen für die Rückrufe von `page.evaluate`). Ohne Letzteres lagen die E2E-Tests ausserhalb
  jeder Typprüfung.
- `.gitignore` um `dev-dist`, Testartefakte, `harness/tmp/` und `!.env.example` ergänzt.

**Verifiziert** in einer sauberen Umgebung gegen einen frischen `npm install`: Typprüfung (vier
Teilprojekte), ESLint, zwei Unit-Tests, vollständiger Bau (sechs Precache-Einträge) und **21 E2E-Tests
über die drei Chromium-Projekte**, darunter die tatsächliche Registrierung des Service Workers und die
Prüfung des Inhaltstyps von `sw.js`. **Die fünf WebKit-Projekte sind noch ungeprüft** – der
WebKit-Download war in der Prüfumgebung durch die Netzrichtlinie gesperrt. Sie laufen erstmals nach
`npm run e2e:browser` auf dem Entwicklungsrechner.

Die vier Abweichungen, die sich dabei ergaben, stehen in `harness/tmp/C0_UMSETZUNG.md`, Abschnitt 16.

## 7. Nächste Schritte

1. **`npm install` auf dem Entwicklungsrechner**, danach **`npm run e2e:browser`**. Ersteres löst die
   plattformabhängigen Rolldown-Bindungen für macOS auf, Letzteres installiert Chromium und WebKit –
   ohne WebKit scheitern die fünf iPhone- und iPad-Projekte beim Start des Browsers.
2. **Abnahme von C0** nach der Prüfliste in `harness/tmp/C0_UMSETZUNG.md`, Abschnitt 13 – insbesondere
   die Punkte, die einen Browser brauchen: Service-Worker-Registrierung, Manifest ohne Ikonen-Warnung,
   Lighthouse „Installable", Safe-Area in der iPhone-Geräteansicht.
3. **Commit auf `dev_client`.** Vorher prüfen, dass weder `.env`-Inhalte noch reale Personennamen
   mitgehen. Nichts nach `main`.
4. **C1 beginnen:** Typgenerierung aus `harness/assets/fubo-api.json` (Generat einchecken),
   fetch-Schicht mit `credentials: 'include'` und Übersetzung des `ProblemDetail`, globale
   `401`-Behandlung, MSW-Mocks, Offline-Hinweis.
   *Dabei ablösen:* `src/api/sitzung.ts` enthält derzeit einen eigenen `fetch` und handgeschriebene
   Typen — bewusst vorläufig, damit der Routen-Schutz schon steht. Die Signatur von `sitzungLesen`
   bleibt erhalten, sodass die Guards unberührt bleiben.
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
- Zu jeder Komponente eine eigene Style-Datei (`<Komponentenname>.module.scss`); globale Variablen in
  `_globalVars.scss`. In Sass `@use`/`@forward` statt `@import`. Jedes bedienbare Element trägt ein
  `data-testid`.
- Nach Abschluss eines Arbeitspakets kurze visuelle Verifikation durchführen und diesen Handoff
  aktualisieren (veraltete Fassung zuvor unter `client/harness/archive/` ablegen).
  Zudem ist `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) nachzuziehen.
  *Hinweis:* `/PRJ_FuBo/harness/` liegt **außerhalb** dieses Repositories und wird nicht mitcommittet.
- Falls diese Datei die Länge von **500 Zeilen** überschreitet, ist diese auf die wesentlichen Punkte
  zusammenzufassen.
