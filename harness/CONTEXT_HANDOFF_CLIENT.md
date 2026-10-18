# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand).
> Systemprompt und verbindliche Regeln: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.
>
> Repository: **eigenständig mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`), Branch `dev_client`. **Kein Monorepo**; das Backend
> liegt in `FuBo-Server`. `PRJ_FuBo/`, `PRJ_FuBo/harness/` und `client/harness/tmp/` sind nicht versioniert.
> **Stand: 17.10.2026.** C0, C1, C3 abgeschlossen; C2, C4 und C5 umgesetzt (C6 ist in C5 aufgegangen). **C5 ist committet (`e9a85e6`), nicht
> gepusht.** Unit-Tests, Lint, Typen, Bau und E2E in Chromium grün; offen: Handprüfung gegen den echten Server, iPhone; **WebKit-Projekte seit 18.10.2026 abgeschaltet** (siehe 5.4); Verifikation 5.2, nächste Schritte 6.
> Nächster Meilenstein: **C7** (Admin-Verwaltung und Admin-Dashboard, Teil 1); die Umsetzungsanleitung `harness/tmp/C7_UMSETZUNG.md` liegt vor
> (drei Stufen, **27,5 h**). Die Stufen 4 und 5 (21,5 h) wurden am 18.10.2026 als **C8** ausgelagert (`harness/tmp/C8_UMSETZUNG.md`);
> PWA/Push heisst seither **C9**, Abnahme/Deployment **C10**. Entscheidungen E1–E22 vom Entwickler noch zu bestätigen.
> **Komprimierte Fassung vom 17.10.2026.** Die ausführliche Vorfassung liegt in `archive/CONTEXT_HANDOFF_CLIENT_2026-10-17c.md`, ältere
> Fassungen ebenfalls in `archive/` (zuletzt `…-10-17b.md` vor C5, `…-10-17.md` vor C4, `…-10-04c.md` vor Abschluss C3).

---

## 1. Kontext und Techstack
Frontend der Anwendung **MONTAGS-KICKER**: Login (PIN, Namensauswahl, Gast), Terminteilnahme, Teamübersicht, Ergebniserfassung, Admin-Dashboard.
Mobile-First, deutsch, installierbare PWA (`standalone`). Rollen ADMIN, USER, GAST. „FuBo" erscheint nicht in der Oberfläche.
React 19, Vite 8, TypeScript 6, SCSS/CSS Modules, TanStack Query, React Router 7; PWA über `vite-plugin-pwa` 1.3.0 (`injectManifest`, `src/sw.ts`,
`registerType: 'prompt'`); Vitest + RTL + MSW (Node-Modus), Playwright; Hosting Cloudflare Pages.

## 2. Entscheidungen (clientrelevant)
Begründungen in den Archivfassungen; verbindliche Regeln in `AGENT_CLIENT.md`.

**Grundlagen und Datenzugriff (C0/C1, 25./26.09.2026):** HttpOnly-Cookie, kein Token im Frontend; zweistufiger Login nach Server-`stage`; React Router
statt TanStack Router; `injectManifest`; `short_name` `GUT-KICK`; keine Skillwerte für USER/GAST; Teilnehmerliste als **eine** sortierte Liste, nie
umsortieren. Genau ein Zugang zum Server (`aufrufen`), Typen aus dem Generat, keine Fehlercode-Übersetzungstabelle, Query-Schlüssel an einem Ort,
Offline-Zustand aus zwei Quellen, MSW nur im Node-Modus. Englische Ordnernamen, Domänenordner in `src/api/`; Tokens in `_globalVars.scss`.

**Anmeldung (03.10.2026):** Sitzungsende nur bei `401 SESSION_UNGUELTIG`; Domäne `auth` für alle `/auth/*`; Routing nach Login-Stufe (`zielpfad.ts`,
`LoginSchrittRoute`); Start ohne Sitzung auf `/pin/pruefen`; **PIN-Eingabe auf vier Zeichen begrenzt** (Entscheidung des Entwicklers, `FUBO_INITIAL_PIN`
muss vierstellig sein); Startaufruf `GET /auth/session/lesen` bleibt auch ohne Sitzung (der `401` ist korrekt, der Konsoleneintrag kosmetisch; eine
Vertragsänderung `200` ohne Sitzung wurde verworfen); gestaltete `Auswahlliste` statt `<select>` (Betriebssystem zeichnete die Liste); PIN-Kästchen im festen
CSS-Raster (Safari); WebKit im CI (alle sieben Projekte) – **seit dem 18.10.2026 abgeschaltet, siehe 5.4**.

**Abschluss C2 (03.10.2026):** `Dialog` auf `<dialog>`/`showModal()`; `festhalten` öffnet den Dialog wieder, wenn der Browser `cancel` überspringt
(Close Watcher, Chrome 122); eigene Regel `::backdrop { --farbe-abdunkelung }` (ältere Browser vererben nichts an `::backdrop`); `fehlertextBilden` und
`istWiederholbar` zentral in `fehler.ts`, Komponenten `Fehlermeldung` und `Fehlerzustand`; Zurück-Ziel `handle.zurueck` → `navigate(-1)` → Startseite
(`location.key === 'default'` verworfen, weil `replace` einen neuen Schlüssel vergibt, `idx` aber 0 bleibt); Seite `NichtGefunden` (Route `*`);
`Fortschrittsbalken` als `div role="progressbar"`.

**Ablauf-Dialog der Sitzung (04.10.2026, C3):**
- **Zeitquelle ist der Server, die Uhr nur Darstellung.** Eigener Abruf `sitzungFristLesen` (mit `X-FuBo-Kein-Refresh`) unter `schluessel.sitzungFrist`,
  **wirft bei `401`** (so bemerkt er den Ablauf einer untätigen Person); Abstand 30 s, in den letzten drei Minuten 5 s (`useRestlaufzeit`: `restMs`,
  `verlaengerbar`, `warnen`).
- **Zwei Fälle** (DESIGN.md): *verlängerbar* (Dialog „Sitzung läuft ab", `festhalten`, „Sitzung verlängern"/„Abmelden") und *nicht mehr verlängerbar*
  („Sitzung endet bald", ruhiger Text, „Weiterarbeiten"/„Abmelden", Escape = Weiterarbeiten, kommt nicht wieder). Erkennung `gueltigBis < absolutGueltigBis`
  (der Server klemmt per `LEAST`, beide sind dann **exakt** gleich). Warnzeit 2 Minuten (`WARNZEIT_MS`); Fokus beim Öffnen auf „Sitzung verlängern".
- **Keine Restzeit als Zahl im Dialog:** Text sagt „gleich", der Balken (Rest der Warnzeit, `aria-hidden`) ist die einzige Zeitanzeige. Eine dauerhafte
  Restlaufzeit-Anzeige im Kopf entfällt (Entscheidung 04.10.2026).
- **„Abmelden" in der Kopfzeile** (`AppLayout`) rechts, nur bei `PROFILE_AUTHENTICATED` (auch Gast), keine Rückfrage. Erst der Server, dann der Client:
  `useAbmelden` räumt nach `204` über `sitzungsendeAusloesen()`, bei Fehler bleibt die Person angemeldet (Fehler `layout-abmelden-fehler`, bleibt bis zum
  nächsten Versuch). `useSitzungErneuern` bricht einen laufenden Frist-Abruf ab, invalidiert, meldet Erfolg erst mit dem neuen Stand.
- **Abweichungen vom Prototyp:** kein Griff am Sheet, kein Satz „Eingaben werden zwischengespeichert" (stimmt nicht), Balken zeigt den Rest der Warnzeit.

**Korrektur „Rückkehr verlängert nicht" (04.10.2026):** `useSitzung` erbte `refetchOnWindowFocus: true` und las ohne `X-FuBo-Kein-Refresh`; jede Rückkehr in den
Tab verlängerte die Sitzung, der Dialog kam nie. Jetzt liest `useSitzung` bei Fokus und Wiederverbindung nicht neu (außer `ohneStand`); den Stand bei
Rückkehr liest der Frist-Abruf. Warum die Tests grün waren: Die E2E-Nachbildung antwortete unabhängig vom Kopf; sie zählt jetzt verlängernde Abrufe
(`verlaengernd`), ein E2E-Fall prüft die Rückkehr.

**Meldungen ohne Verbindung (04.10.2026):** Immer nur **eine** Meldung: `Fehlermeldung` hat Vorrang, der `OfflineHinweis` (Streifen, `fixed`, wegklickbar) blendet
sich aus. `Fehlermeldung` im Stil des Streifens, `TEXT_NICHT_ERREICHBAR` mit festem Umbruch vor „Bitte …" (`white-space: pre-line`), immer `error_circle_icon`
(eingebettet). `Fehlerzustand` kompakt und nur ohne Daten. Platz gewonnen (Kopfzeile nur mit Zurück/Abmelden, Reserve unten entfernt): 780/780 in allen
Offline-Fällen. Bei 320 px scrollt die Namensauswahl mit Gastbereich um 25 px – bewusst offen. **Korrektur `playwright.config.ts`:** `NUR_CHROMIUM` erfasste
`e2e/pwa.spec.ts` nicht; neues Muster `/(^|[/\\.])pwa\.spec\.ts$/`, mit `playwright test --list` geprüft (WebKit: 0).

**Admin-Zugang (C4, E1–E5 vom 04.10.2026, umgesetzt 17.10.2026):**
- **Befund (E5):** Die drei Admin-Login-Endpunkte (`/auth/admin/anmelden`, `/auth/passwort/zuruecksetzen`, `/auth/passwort/bestaetigen`) verlangen `PIN_VERIFIED`,
  `/admin/passwort/aendern` die Rolle `ADMIN`. Der Einstieg „Als Admin anmelden" (`namensauswahl-admin-link`) steht **nur in der Namensauswahl**; die drei
  Admin-Login-Ansichten liegen hinter `LoginSchrittRoute schritt="name"`; „Zurück" führt zur Namensauswahl bzw. je einen Schritt zurück.
- **E1:** Nach der Admin-Anmeldung `/admin` (Platzhalter bis C7, mit Link `admin-passwort-aendern-link`); `zielFuerStufe` kennt `istAdmin`.
- **E2/E3:** Reset in zwei Ansichten (`PasswortVergessen`, `PasswortNeu`), ein Formular für PIN und neues Passwort, **keine Wiederholung** (das Auge ist die
  einzige Kontrolle); 10–72 Zeichen, keine Zeichenklassen.
- **E4:** Neutraler `Hinweis` über dem Formular der Zielseite (nach Reset auf der Admin-Anmeldung, nach Passwortwechsel auf der PIN-Eingabe) über
  `location.state.hinweis`; beim Wechsel räumt der Client sofort auf (`sitzungsendeAusloesen(hinweis)`).
- **Fehlerverhalten:** `ADMIN_PASSWORT_FALSCH` bei der Anmeldung im Kasten (Passwort leer, Name bleibt, Fokus ins Passwort), beim Wechsel am Feld „Bisheriges
  Passwort", **kein Sitzungsende**; `RESET_PIN_FALSCH` am PIN-Feld; `409 RESET_UNGUELTIG` mit „Neue PIN anfordern"; `400` mit `felder` am Feld; `429` über `useSperre`.
- **Abweichungen:** eigener `Restzeitbalken` statt `Fortschrittsbalken` (der zählt Zusagen), Satz „Gültig bis 20:58 Uhr."; `Namensauswahl` mit kürzeren Abständen,
  damit sie mit Link bei 780 px nicht scrollt. **DESIGN.md (Screen 1, E5) ist dem Entwickler zur Übernahme vorzulegen** (nicht im Client-Repository).

**User-Dashboard, Teams, Ergebnisse, Verlauf (C5, 17.10.2026; C5 und C6 zusammengelegt)** – vollständig in `harness/tmp/C5_UMSETZUNG.md` (E1–E14):
- **Vier Hubs, ein Rahmen** (`DashboardLayout`, `TabLeiste`, keine ARIA-Tab-Rollen); Detailrouten außerhalb des Layouts; Admin wird nach `/admin` umgeleitet (E7);
  ungültige Adresse → „nicht gefunden" ohne Abruf.
- **Lesen/Schreiben:** Termine pollen alle 20 s mit Kopf, Mutationen ohne; Schlüssel `termine`, `termin(id)`, `termineVerlauf`, `bilanz`.
- **Zustände statt Werte:** `eigeneRueckmeldung` dreiwertig; `teams`/`ergebnis` im Normalfall `null`; Teilnehmerliste nie umsortiert; `mindestzahlErreicht` vom Server.
- **Teams:** `POST /teams/generieren` ohne Kopf; Ersetzen einer **aktuellen** Einteilung fragt nach; Kontingent nur über `409 KONTINGENT_ERSCHOEPFT` (Seite merkt sich
  `teilnehmerVersion`, sperrt per `aria-disabled` bis zur Änderung, E15); `veraltet` versteckt nichts. Nach `TEAMS_FIXIERT`/`TERMIN_GESCHLOSSEN` und `404` liest der Hook
  den Termin neu (Erweiterung gegenüber der Vorgabe).
- **Ergebnis:** Der **erste Eintrag gilt**, nicht löschbar (Korrektur nur Admin, `ergebnisKorrigieren` im Datenzugriff und Mock, Ansicht → C8). Radiogruppe „Wer hat
  gewonnen?" und Haken „Deutlicher Sieg" (bei `U` gesperrt und zurückgesetzt; `ergebnisErfassen` sendet dann `false`). Bestätigungsdialog mit `ergebnisSatz`.
  `409 ERGEBNIS_VORHANDEN` = Hinweis „Das Ergebnis war bereits erfasst; es gilt der erste Eintrag." (E17). Fokus nach Abschluss auf die Überschrift der Anzeige.
  Zustandsmatrix: Anzeige / Formular / „Keine Einteilung" / „erst nach Abschluss" / „abgesagt". Bilanz **nicht für Gäste**; dreimal `0` ⇒ „Noch keine Spiele gewertet.".
- **Verlauf:** 60 Tage (`VERLAUF_TAGE`, E14; Abruf mit `ab`, clientseitig auf vergangene Termine gefiltert, neueste zuerst, kein Polling, kein „Mehr laden"); abgeschlossene
  Termine als Link `ergebnisse/:terminId` (≥ 44 px), abgesagte ohne Link.
- Schreibende Hooks, Aktionsleiste, Uhr im Render: siehe `AGENT_CLIENT.md` (Regeln) und 6.3 (Fallen).

**Terminkopf (18.10.2026, Entscheidung des Entwicklers; Überarbeitung der Termin-Ansicht):**
- **Rahmen:** `TerminKarte`, `Zusagestatus` und `Fortschrittsbalken` stehen in einem umrandeten Kopfbereich (`termin-kopf`, `TerminAnsicht.module.scss`: `1px solid var(--farbe-rand)`,
  `--radius-m`, Innenabstand `--abstand-m`, wie Teilnehmerliste und „Weitere Termine“; Hintergrund bleibt weiß, sonst verliert die Balkenspur ihren Kontrast). Gilt in allen Zuständen
  (auch abgesagt/abgeschlossen); Hinweise („Der Termin hat begonnen“, „abgesagt“) und Teilnehmerliste stehen **außerhalb**.
- **Balkentext:** unter der Mindestzahl „3 von mindestens 6 Zusagen erreicht“, bei erreichter Mindestzahl „8 Zusagen – Mindestanzahl von 6 erreicht“ (Satzwahl nach `mindestzahlErreicht`
  vom Server); `aria-valuetext` „3 von mindestens 6 Zusagen“. **Der zweite Satz ist eine Annahme** (der Auftrag nannte nur den ersten) und bei Bedarf in `Fortschrittsbalken.tsx` zu ändern.
- **Platzsatz entfällt** („8 von 22 Plätzen belegt.“). Nur bei Warteschlange erscheint `termin-wartesatz` im Kopfbereich: „Maximale Teilnehmerzahl von 22 erreicht, 2 auf der Warteschlange.“
  (`termin-platzsatz` heißt nicht mehr so; Tests und E2E nachgezogen).
- **Ladeanzeige beim Neuladen (18.10.2026):** Eine **statische Ladeanzeige in `index.html`** (`#root > .startLader`, Stil in `global.scss`, Kreis wie `Ladespinner` `gross`) steht im ersten Bild, bevor das
  Skript läuft; `createRoot` ersetzt sie. `Ladespinner` mit **`zentriert` erscheint jetzt sofort** (Vorgabe `verzoegert = !zentriert`; sonst blieb nach dem Neuladen 150 ms eine leere Fläche); Spinner im
  Fließtext und in Teilbereichen bleiben verzögert. Eine Prop `vollbild` wurde ausprobiert und verworfen: Die Guards sitzen im `main` des `AppLayout` (Innenabstand 16 px), `zentriert` füllt dort schon die
  Resthöhe mittig (Kreismitte 390 px bei 780 px Fenster, wie die statische Anzeige). **Auslegung:** „Ladebalken“ wurde als der vorhandene zentrale Ladespinner verstanden, nicht als Balken.
- **Häkchen im Kreis grün (18.10.2026):** `Icon` kennt `EIGENFARBEN`; `check_circle_icon` ist überall `var(--farbe-erfolg)` (TerminKarte „Abgeschlossen“, VerlaufListe, Zusagestatus, PasswortRegeln), unabhängig von der Umgebungsfarbe. Test in `Icon.test.tsx`.
- **Kreuz im Kreis rot (18.10.2026):** `cancel_circle_icon_red` ist ebenso in `EIGENFARBEN` (`var(--farbe-fehler)`). Bis dahin nutzte der Code die graue Fassung `cancel_circle_icon_dark` (Zusagestatus „Du hast abgesagt“ schwarz, PasswortRegeln „Noch offen“ grau); beide Stellen verwenden jetzt `_red`. **Folge in `PasswortRegeln`:** Offene Regeln zeigen ein rotes Kreuz neben grauem Text, auch bevor etwas eingegeben wurde. `_dark` ist ungenutzt, die Datei bleibt.

## 3. Schnittstelle zum Server
Siehe `AGENT_CLIENT.md`. Kontrakt-Kopie `client/harness/assets/fubo-api.json` (**45 Operationen**, am 18.10.2026 erneut mit `server/fubo-api.json` abgeglichen, byteweise identisch);
Generat `src/api/common/types/schema.d.ts` (`npm run api:typen`). Neu gegenüber 44: `POST /admin/name/bestaetigen`; `POST /admin/name/aendern` antwortet `202`
(Namensänderung mit E-Mail-PIN, Client-Seite in C7). `202` ohne Rumpf liefert `aufrufen` wie `204` als `undefined` (mit Gegenprobe). `servers` im Vertrag nennt
`https://tunnel-fubo-app.{domain}`; `AGENT.md`/Hosting-Notizen sprechen noch von `api.<domain>` – bei C10 klären; der Client nutzt `VITE_API_BASE_URL`.

**Vertragsänderung vom 18.10.2026 (nur Beschreibungen, keine neuen Operationen oder Schemas; Generat neu erzeugt, nur Kommentare):**
- `GET /termine/lesen`: Ohne `ab` liefert der Server **alle** Termine, auch vergangene (vorher „ab heute“). Folge im Client: `useTermine` ruft jetzt mit `ab` = heute
  (`heuteIso(new Date())` in `queryFn`), sonst hätte `naechsterTermin` alle alten Absagen als `abgesagtDavor` gezeigt. `useVerlauf` war nicht betroffen (immer mit `ab`).
  Mock (`terminHandlers`) und Tests nachgezogen (Stichtag heute; neuer Test „zeigt keine vergangenen Termine"); `e2e/hilfen/termine.ts` bildete den neuen Vertrag schon ab.
  Gleichzeitig vom Entwickler geändert: Grundtext in `TeamsLeiste` („Mindestens N Zusagen sind erforderlich."), Text in `TeamsSeite` („Dieser Termin existiert nicht mehr."); die dadurch
  ungenutzte Prop `zusagen` von `TeamsLeiste` wurde samt Aufrufer und Tests entfernt. Prüfstand: lint, typecheck, build, Vitest (639) grün, E2E Chromium 318 bestanden / 3 übersprungen.
- **`ABGESAGT` setzt auch der Server selbst:** Hat ein geplanter Termin 30 Minuten nach Beginn weniger Zusagen als `minTeilnehmer`, wird er `ABGESAGT` statt `ABGESCHLOSSEN`
  (A18), ohne Push, Rückmeldungen bleiben, ein Ergebnis lässt sich nicht erfassen (`POST /ergebnis/erfassen`). **Für die Handprüfung C5 heißt das:** Für Nr. 6 (Ergebnis nach
  30–35 Minuten) mindestens `minTeilnehmer` Zusagen und eine Teameinteilung, sonst kippt der Termin auf `ABGESAGT`. Die UI-Texte („Abgesagt", „Dieser Termin wurde abgesagt.")
  sind neutral; der Hinweis „Das Ergebnis lässt sich eintragen, sobald der Termin abgeschlossen ist (30 Minuten nach Beginn)" in `ErgebnisSeite` ist für zu wenige Zusagen
  ungenau (offen, kleine Textänderung). `harness/tmp/C7_UMSETZUNG.md` ist entsprechend ergänzt (1.1 Nr. 1, 1.4, Abnahme 10, Fallen).

**Offene Vertragslücke (Server-Track):** In `PIN_VERIFIED` nennt kein Endpunkt die freien Gastplätze; DESIGN.md verlangt, „Gast" vorab zu sperren, heute erst nach
`409 KEIN_GAST_SLOT_FREI`. Vorschlag: Feld `gastPlatzFrei` an `GET /auth/users/lesen` oder eigener Endpunkt.

## 4. Meilensteine (Client)
Mid-Level-Entwickler, KI-gestützt, ca. 6,5 h/Woche. Schnitt vom 25.09.2026.

| MS | Inhalt | h | Stand |
|---|---|---|---|
| C0 | Projektfundament, PWA-Basis, Testwerkzeuge, CI | 14 | **abgeschlossen** (`e6f8bad`, nachgeprüft 26.09.) |
| C1 | Vertrag, Datenzugriff, Mocks, Offline-Hinweis | 10 | **abgeschlossen** (26.09.) |
| C2 | Design-System, Basis-Komponenten, Lade-/Leer-/Fehlerzustand | 12 | **umgesetzt** (03.10.); offen Abnahme 5 (WebKit, abgeschaltet), 10 (Zoom 200 %), 11 (Telefon im Sonnenlicht, Safari) |
| C3 | Sitzung & Spieler-Login | 14 | **abgeschlossen** (04.10.); Handprüfung bestätigt. Entfallen: dauerhafte Restlaufzeit-Anzeige |
| C4 | Admin-Zugang, Passwort-Reset und -wechsel | 8 | **umgesetzt** (17.10.); offen Handprüfung gegen den echten Server; WebKit abgeschaltet |
| C5 | Termin & Teilnahme, User-Dashboard, Teams, Ergebnisse, Verlauf (C6 aufgegangen) | 31,5 | **umgesetzt und committet** (`e9a85e6`, 17.10.); offen Handprüfung, iPhone, WebKit im CI |
| C6 | (in C5 aufgegangen) | – | entfällt |
| C7 | Admin-Verwaltung und Admin-Dashboard, Teil 1 (Rahmen, Zugang, Profile, Termine) | **27,5** (Plan bisher 20, ursprünglich 49 für C7 gesamt) | Anleitung `harness/tmp/C7_UMSETZUNG.md` liegt vor; Umsetzung offen |
| C8 | Admin-Verwaltung, Teil 2 (Konfiguration, Gastplätze, Gast-Stufe, Halle, Ergebniskorrektur, manuelle Teams); am 18.10.2026 aus C7 ausgelagert | **21,5** | Anleitung `harness/tmp/C8_UMSETZUNG.md` liegt vor; setzt C7 voraus; Umsetzung offen |
| C9 | PWA-Onboarding & Push (A25) (bisher C8) | 14 | offen |
| C10 | Abnahme, WCAG 2.1 AA, Deployment (bisher C9) | 12 | offen; **blockiert**, bis `app.<domain>` in Cloudflare Pages steht |

Summe 164,5 h (C7 und C8 zusammen mit 49 statt 20 h; C5 und C6 = 26 h geplant, 31,5 h veranschlagt). C1 bis C9 sind nicht blockiert (Server S0–S8 vollständig).

## 5. Code-Zustand

### 5.1 Überblick
- **Datenzugriff:** `src/api/common/` (`httpService`, `fehler`, `schluessel`, `verbindungsStatus`, Generat); `src/api/auth/auth.ts` (`sitzungLesen`, `pinPruefen`,
  `namenslisteLesen`, `nameWaehlen`, `alsGastAnmelden`, `sitzungFristLesen`, `sitzungErneuern`, `sitzungBeenden`, `adminAnmelden`, `passwortZuruecksetzen`,
  `passwortBestaetigen`); `src/api/auth/passwortRegeln.ts` (Grenzen 10/72, `RESET_GUELTIG_MS`); `src/api/admin/admin.ts` (`passwortAendern`, `ergebnisKorrigieren`);
  `src/api/termine/` (`termine.ts`: `termineLesen`, `terminLesen`, `rueckmeldungSenden`; `terminZeit.ts`: `beginnVon`, `datumKurz`, `datumLang`, `uhrzeitKurz`,
  `zeitpunktKurz`, `naechsterTermin`, `heuteIso`, `verlaufAb`, `vergangeneTermine`, `letzterAbgeschlossener`, `VERLAUF_TAGE`); `src/api/teams/teams.ts` (`teamsGenerieren`);
  `src/api/ergebnis/` (`ergebnisErfassen`, `ergebnisText.ts`/`ergebnisSatz`); `src/api/bilanz/bilanz.ts`.
- **Query-Client** (`src/app/queryClient.ts`): Wiederholung nur bei `≥ 500`, Mutationen nie; `istSitzungsende` leert den Cache und ruft den `SitzungsWaechter`.
- **Routing** (`src/app/`): `routen.tsx`; Guards `LoginSchrittRoute`, `GeschuetzteRoute`, `AdminRoute`; `zielpfad.ts`; `routenAngaben.ts`. Alle vier Tab-Routen sind ausgebaut,
  der Platzhalter dient nur noch `/einstellungen` und `/admin`.
- **Hooks:** `useSitzung`, `useVerbindung`, `useSitzungswechsel`, `usePinPruefen`, `useNamensliste` (Polling 5 s mit Kopf), `useNameWaehlen` (liest bei `NAME_BELEGT` neu),
  `useGastAnmelden`, `useRestlaufzeit`, `useSitzungErneuern`, `useAbmelden`, `useSperre`, `useNavigationsHinweis`, `useAdminAnmelden`, `usePasswortAnfordern`,
  `usePasswortBestaetigen`, `usePasswortAendern`; C5: `useTermine` (Polling), `useTermin`, `useRueckmeldung`, `useBegonnen`, `useTerminParameter`, `useTeamsGenerieren`,
  `useErgebnisErfassen`, `useBilanz`, `useVerlauf`.
- **Seiten/Layouts:** `PinEingabe`, `Namensauswahl`, `NichtGefunden`, `AdminAnmeldung`, `PasswortVergessen`, `PasswortNeu`, `PasswortAendern`; `AppLayout` (Safe-Area, Zurück,
  „Abmelden"), `DashboardLayout`, `Dashboard`, `TerminDetail`, `TeamsSeite`, `ErgebnisSeite`, `VerlaufSeite`.
- **Komponenten:** `Aktionsleiste`, `AktualisierungsHinweis`, `Auswahlliste`, `CustomButton`, `Dialog`, `Erklaerung`, `SitzungAblaufDialog`, `Fehlermeldung`, `Fehlerzustand`, `Feld`,
  `Fortschrittsbalken`, `Icon`, `Ladespinner`, `Leerzustand`, `OfflineHinweis`, `Platzhalter`, `PinFeld`, `PasswortFeld`, `PasswortRegeln`, `Hinweis`, `Textlink`, `Restzeitbalken`;
  C5: `TabLeiste`, `TerminKarte`, `Zusagestatus`, `Teilnehmerliste`, `RueckmeldungLeiste`, `TerminAnsicht`, `WeitereTermine`, `TeamsAnzeige`, `TeamsLeiste`, `BilanzKarte`,
  `ErgebnisAnzeige`, `ErgebnisFormular`, `VerlaufListe`.
- **Test-Stub und Mocks:** `src/test/setup.ts` (jsdom-`<dialog>`); `src/test/mocks/termine.ts` (zustandsbehafteter Server `terminHandlers()`, `terminModell`, `teamsAus`,
  `beispielErgebnis`, `beispielBilanz`), `problem.ts`; E2E-Nachbildungen `e2e/hilfen/{sitzung,termine,teams,ergebnisse}.ts`.
- **PWA:** Manifest, eigener Worker, `_headers`/`_redirects` nach den Cloudflare-Auflagen.
- **Tests (Stand nach C5):** 638 Unit-Tests in 83 Dateien; E2E u. a. `admin.spec.ts` (16 Fälle), `layout.spec.ts`, `sitzung-ablauf.spec.ts` (15 Fälle), `namensauswahl.spec.ts`,
  `pwa.spec.ts` (nur Chromium), `termine`, `tabs`, `teams`, `ergebnisse`, `verlauf`. CI: Job `pruefen` (Lint, Typen, Bau, Unit) und Job `e2e` (**nur Chromium, 3 Projekte, 321 Läufe**; die vier WebKit-Projekte sind seit 18.10.2026 abgeschaltet, 5.4).

### 5.2 Verifikation
Frühere Läufe mit allen Gegenproben stehen in den Archivfassungen.
- **C2:** 135 Unit-Tests, 72 E2E in Chromium. **C3:** 197 Unit-Tests, 126 E2E; Handprüfung gegen den echten Server bestanden. **C4:** 353 Unit-Tests, 177 E2E (3 übersprungen),
  acht Precache-Einträge; offen Handprüfung und iPhone; WebKit abgeschaltet (danach `ADMIN_PASSWORD` im Passwortmanager nachziehen; der Server liest es nur beim ersten Start).
- **C5 (17.10.2026):** `lint` (inkl. `e2e/`), `typecheck`, 638 Unit-Tests, Bau (acht Precache-Einträge), ein `fetch(`, kein Hexwert außerhalb der Tokendatei, keine verwaisten Pfade,
  **318 E2E-Läufe grün in den drei Chromium-Projekten, 3 übersprungen** (Cloud-Kopie mit vorinstalliertem Chromium über eine Konfiguration außerhalb des Repos). Gegenproben je
  Stufe (u. a. Beginn-Sperre, Reihenfolge, dreiwertige Rückmeldung, Kontingent-Sperre, Ersetzen-Rückfrage, `mutate` statt `mutateAsync` → 3 rote Läufe, Haken bei `U`, Senden
  ohne Bestätigung, Bilanzkarte für Gast, abgesagter Termin als Link, Verlauf mit Polling/ohne Kopf); **äquivalente Mutation:** `deutlich` bei `U` ungefiltert senden (zwei Riegel).
  Sichtprüfung bei 360 × 780 über die Layout-Fälle der E2E-Specs, nicht per Auge.
  **Nicht geprüft:** WebKit-Projekte (abgeschaltet, 5.4), Handprüfung gegen den echten Server, iPhone, Bilanz für GAST am echten Server, Reihenfolge der Teilnehmerliste nach Absage und Zusage.

### 5.3 Fallen, die aufgetreten sind
- **Ein `202` ohne Rumpf** hätte `aufrufen` (`json()` auf leerem Rumpf) abstürzen lassen; `202`/`204` zentral als „kein Rumpf".
- **Eingabefeld nicht bei jedem `ApiFehler` leeren:** nur nach dem Code, der das Feld als falsch benennt. **`PinFeld`: `readOnly` statt `disabled`** (Fokus).
- **Relative Importe in `e2e/` brauchen `.js`** (NodeNext, TS2835).
- **Playwright und vorinstalliertes Chromium passen in der Cloud nicht zusammen** (1.63 will Build 1243, vorhanden 1194): eigene Konfiguration mit `launchOptions.executablePath` außerhalb des Repos.
- **Jede zusätzliche Zeile in der Namensauswahl kostet Platz** (Admin-Link 48 px ⇒ Überlauf um 27 px bei 780 px): über Abstände gelöst, nicht über die Grenze 740 px.
- **`npm install` repariert die Sperrdatei still**, nur `npm ci` prüft sie.
- **`invalidateQueries` lädt nur beobachtete Abfragen neu** (Hook-Tests mit Abfrage daneben). Eine Mutation endet erst, wenn die im Hook zurückgegebene Invalidierung fertig ist.
  **Ein laufender Abruf ohne Daten wird beim Invalidieren übernommen, nicht ersetzt** ⇒ `cancelQueries` vor dem Neulesen der Sitzung.
- **Safari und `fit-content` an umbrechender Flex-Zeile:** Breite = ein Element; festes Raster.
- **Playwright klickt nicht auf `aria-disabled`** (wartet): `force: true`.
- **Umbenennen per Suchen und Ersetzen** traf Kommentare, Doku, Archive („Iconn"); Archive aus Git wiederhergestellt, Ordner `AppIcon` → `Icon`.
- **jsdom kennt `showModal` nicht** (Stub). **`::backdrop` erbte früher nichts** (eigenes Token). **`cancel` am Dialog ist nicht garantiert** (Wiederöffnen in `onClose`).
- **Fokus bei Tab im modalen Dialog** geht kurz auf das Dokument; Fokusfalle mit einem Element **hinter** dem Dialog prüfen.
- **Zwei `Date.now()` für „gleiche" Zeitpunkte** wichen um 1 ms ab (nur ein E2E-Projekt fiel auf): Mocks mit **einer** Uhrablesung (`sitzungMitRest`). **Eine Beispielsitzung mit festem
  Datum in der Vergangenheit** öffnet in jedem Test den Ablauf-Dialog; `beispielSitzung` liegt im Jahr 2099.
- **`visibilitychange` ohne `bubbles: true`** erreicht das `window` nicht (TanStack Query hört dort).
- **Im verbundenen Ordner ist Löschen gesperrt** (`vite build` scheitert beim Leeren von `dist/`; `git status` hinterließ `.git/index.lock`): `git --no-optional-locks`, Löschfreigabe nur bei Bedarf.
- **Eine Nachbildung, die `X-FuBo-Kein-Refresh` ignoriert, kann Verlängerungen nicht zeigen** (alle E2E grün, im Betrieb kam der Dialog nie): Mocks für Sitzungsabrufe zählen Aufrufe ohne Kopf.
- **Vorgaben des Query-Clients gelten auch für verlängernde Abrufe** (`refetchOnWindowFocus`/`refetchOnReconnect` sind Abrufe ohne Bedienung; Muster `useSitzung`).
- **WebKit rundet die Fokusring-Breite ab** (2,8 px statt 3 px bei Pixeldichte 2,5): `pruefeFokusringBreite` in `layout.spec.ts` erwartet einen Wert zwischen abgerundeter Breite und 3 px.
- **C5 – `mutate`-Rückrufe gehen verloren, wenn der Aufrufer sich austauscht:** zufällig grün in einem Projekt, rot in zwei anderen; `mutateAsync` mit `try/catch`, E2E in **allen drei** Projekten.
- **C5 – Gegenprobe nur gültig, wenn die Mutation gebaut wurde:** `npm run build` bricht bei Typfehler (`noUnusedLocals`) ab und lässt das alte `dist/`; das Skript prüft den Rückgabewert
  und liest „failed" (die letzte Zeile ist „N passed", auch bei Fehlschlägen); beim Schreiben erst den Inhalt berechnen, dann öffnen (`open(p, 'w')` leert die Datei).
- **C5 – MSW:** der erste passende Handler gewinnt, `mockServer.use()` stellt voran; `onUnhandledRequest: 'error'` macht fehlende Handler sichtbar.
- **C5 – Uhr im Render** ist unter `react-hooks` v7 ein Lintfehler; Tests mit Datum relativ zu heute (Verlauf liest nur 60 Tage).
- **C5 – Aktionsleiste und Dialog:** Leiste = letztes Kind der Seite; geschlossener `<dialog>` in ihrem Behälter; `aria-disabled` hält den Fokus.
- **C5 – E2E-Nachbildung ohne Termin-Route** leitet `GET /termine/:id/lesen` an den Vorschau-Server (HTML): Tests auf `teams/:id`/`ergebnisse/:id` brauchen `termineNachbilden`.

### 5.4 Bewusst offen
- **WebKit-E2E abgeschaltet (18.10.2026, auf Anweisung des Entwicklers):** Im CI-Lauf vom 17.10.2026 (Stand C5) scheiterten die WebKit-Projekte quer durch die Dateien, die drei
  Chromium-Projekte waren grün. Ein Beispiel: `admin.spec.ts`, „uebersteht ein Neuladen von Schritt 2" – nach `page.reload()` fehlte der Balken (`history.state` mit `angefordertUm` weg; in
  `ios-schmal` und `ios-tablet-quer` belegt). **Ursache ungeklärt** (Playwrights WebKit-Build oder Safari-Verhalten); die übrigen Fehlschläge lagen nicht vollständig vor. Umsetzung:
  `playwright.config.ts` (`WEBKIT_AKTIV`/`OHNE_WEBKIT`, die vier WebKit-Projekte mit `testIgnore`), CI installiert nur Chromium. Wieder einschalten: `WEBKIT_E2E=1`, im CI `webkit` zu
  `playwright install` und `WEBKIT_E2E: '1'` am Testschritt. **Folge:** iPhone- und iPad-Layout (375/402 px, Tablet), Tab-Verhalten und Safari-Eigenheiten (z. B. PIN-Kästchen vom 03.10.2026)
  sind nicht mehr automatisch abgesichert – Handprüfung auf einem iPhone, besonders Neuladen von Schritt 2 der Passwort-Rücksetzung (der Balken ist reiner Schmuck, der feste Satz stimmt auch ohne).
- `RoutenAngaben` kennt keine Zielangabe mit Parameter; „Zurück" geht von `teams/:terminId`/`ergebnisse/:terminId` einen Schritt im Verlauf, beim Direkteinstieg zur Startseite.
- „nicht gefunden" liest beim Direkteinstieg keine Sitzung; der Offline-Hinweis erscheint dort erst mit dem ersten Aufruf oder dem Ereignis `offline`.
- **C4:** `PasswortFeld` kürzt längere Passwörter beim Einfügen still (`maxLength` 72, folgt dem Vertrag/BCrypt); läuft die `PIN_VERIFIED`-Sitzung beim Warten auf die Reset-E-Mail ab, ist der
  `navigate`-Zustand weg, der Vorgang auf dem Server aber gültig (Weg: PIN → Name → „Als Admin anmelden" → „Passwort vergessen?" → „Ich habe bereits eine PIN"); Verhalten auf iOS (`one-time-code`,
  Passwortmanager, Kleinschreibung) nur per Handprüfung. Die Namensänderung (`/admin/name/*`) ist noch nicht angebunden → C7.
- **Leerlauf-Fenster ≤ 2 Minuten** (Konfiguration erlaubt ab 1): Der Ablauf-Dialog erschiene nach jedem Verlängern sofort wieder. Vorschlag: Mindestwert im Server anheben (z. B. 5 Minuten) oder
  Warnzeit als Anteil des Fensters.
- **Die Geräteuhr bestimmt, wann der Dialog erscheint** (Server liefert nur Zeitpunkte); abgemeldet wird nur auf Anweisung des Servers. Verbesserung über den `Date`-Header möglich.
- Tab auf Links/Schaltflächen ist in WebKit ohne Systemeinstellung nicht möglich (Chromium-Test, WebKit Handprüfung). Titel „MONTAGS-KICKER" bricht unter 360 px um. `alt` des Logos auf der PIN-Seite
  sollte `alt=""` sein (schmückend). `npm audit`: drei moderate Befunde in `@vitest/mocker` (nur Entwicklung, Behebung verlangt Vitest 5). Die Trennlinie der Aktionsleiste ist entfernt (03.10.2026).
- **Gastbereich plus Verbindungsmeldung scrollt auf kleinen Telefonen** (`ios-schmal` 375 × 667, `ios-telefon` 402 × 681: 736 statt 695 px): **Entscheidung 04.10.2026, Layout bleibt**; der E2E-Test prüft
  „kein Scrollen" nur ab Fensterhöhe 740 px (Grenze erst aufheben, wenn die Ansicht für 667 px verdichtet wird).
- **Vite-Warnung beim Start** („Assets in public directory cannot be imported from JavaScript") von `Icon/eingebettet.ts` (zwei SVGs per `?raw`); vorerst hingenommen (04.10.2026). Saubere Lösung: die beiden
  SVGs nach `src/` verlegen (dann entfallen `includeAssets` in `vite.config.ts`, Precache 6 → 5; `Icon.test.tsx` und `pwa.spec.ts` anpassen).
- **C5:** Die Umsetzungsanleitung nennt an einer Stelle (10.4) „90 Tage", E14 und Code sagen 60 (Satz im UI nimmt die Konstante). Kontingent der Teamgenerierung nur über `409`, keine Anzeige „noch n Läufe"
  (Server-Track). Hinweistext bei Rückmeldung `false → true` (Platz in der Reihenfolge) erst nach der Handprüfung festlegen, ebenso Reihenfolge nach Absage und Zusage. **DESIGN.md (1.3 der Anleitung)
  dem Entwickler zur Übernahme vorlegen:** Tab-Leiste (vier Links, kein ARIA-Tab), Symbol `person_edit_dark` für den Auswechselspieler (vorläufig), Überschriftenfolge h1/h2/h3; Verlauf und Ergebnisse
  haben keine eigene Ansicht in DESIGN.md.

## 6. Nächste Schritte
1. **Push von `dev_client`** (C5 ist committet, `e9a85e6`) und CI-Lauf nur mit Chromium (nach der Abschaltung der WebKit-Projekte, 5.4); **WebKit-Ursache klären** (Trace aus dem Artefakt `playwright-report`, ggf. lokal `WEBKIT_E2E=1 npx playwright test`).
2. **Handprüfung C5 gegen eine laufende Serverinstanz** (5.2 „Nicht geprüft"; C5-Anleitung 12): Zusage/Absage und Reihenfolge, Teams generieren (Kontingent, Ersetzen, `veraltet`, Beginn), Termin 10 Minuten
   in der Zukunft anlegen und 30–35 Minuten nach Beginn Ergebnis erfassen (zwei Geräte → Hinweis), Bilanz für Spieler und Gast, Verlauf, iPhone. Danach den Hinweistext für `false → true` festlegen.
   Mit C7 Stufe 3 wird ein Teil davon ohne Wartezeit möglich (Termin abschließen).
3. **C4 abnehmen** (Handprüfung, iPhone, Passwortmanager).
4. **C7 beginnen** nach Bestätigung der Entscheidungen E1–E22 (`harness/tmp/C7_UMSETZUNG.md`): drei Stufen (Rahmen/Dashboard/Zugang 8 h, Profile 8,5 h, Termine 11 h), je Stufe grün und einzeln
   committet (auf Aufforderung). Dazu gehört die Namensänderung des Admins. **Danach C8** (`harness/tmp/C8_UMSETZUNG.md`): Konfiguration/Gastplätze/Gast-Stufe 10,5 h,
   Halle/Ergebniskorrektur/manuelle Teams 11 h; dazu gehört die Ergebnis-Korrektur.
5. **C2-Restabnahme:** Zoom 200 % bei 360 px, echtes Telefon im Sonnenlicht (auch Safari/iOS); iPhone-/iPad-Layout von Hand, solange WebKit abgeschaltet ist.
6. **Server-Track:** Vertragslücke freie Gastplätze (3); Verhalten von `GET /bilanz/lesen` für Gäste klären; Kontingent der Teamgenerierung in der Antwort anbieten; Anfragen aus C7 und C8 (1.4 der C7- und der C8-Anleitung:
   ADMIN-Lesezugriff auf `/termine/*`, Gast-Stufe lesbar, Mindestwert Leerlauf, Gültigkeit der Namens-PIN).
7. **Betrieb:** Custom Domain `app.<domain>`, Rocket Loader und Auto-Minify aus, `FUBO_INITIAL_PIN` vierstellig.
8. **Aufräumen** (nur im lokalen Terminal; die Agentenumgebung darf es ohne Freigabe nicht): `PRJ_FuBo/_zu_loeschen/e2e-kopie.tgz`, verwaiste `.git/objects/tmp_obj_*`, übrige Sperrdateien.

## 7. Weitere Anweisungen
- Repo-Wurzel `client/`, Branches `dev_xxx`; nichts nach `main` ohne ausdrückliche Anweisung; Commits nur auf Aufforderung.
- Getrennte Repositories: Vertragsänderungen zuerst in `server/fubo-api.json`, dann Kopie gegen den Unterschied auffrischen, Typen und Mocks nachziehen.
- `.env` nie einchecken; keine realen Personennamen in Code, Tests oder Doku.
- Nach jedem Paket: visuelle Prüfung, dieser Handoff (Vorfassung ins Archiv), `AGENT_CLIENT.md` und `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` nachziehen. Über 500 Zeilen: kürzen (Vorfassung ins Archiv).
