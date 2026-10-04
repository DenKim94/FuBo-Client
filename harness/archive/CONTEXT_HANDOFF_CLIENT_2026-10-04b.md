# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand).
> Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.
>
> Repository: **eigenständig mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`), Branch
> `dev_client`. **Kein Monorepo**; das Backend liegt in `FuBo-Server` (`server/`). `PRJ_FuBo/`,
> `PRJ_FuBo/harness/` und `client/harness/tmp/` sind nicht versioniert.
> **Stand: 04.10.2026** (C0, C1 abgeschlossen; **C2 umgesetzt**, Abnahme bis auf Hand- und
> WebKit-Prüfungen erledigt; C3 in Arbeit: PIN-Eingabe, Namensauswahl und **Ablauf-Dialog** stehen).
> Gestraffte Fassung. Vorfassungen mit allen Herleitungen in `archive/`, zuletzt
> `archive/CONTEXT_HANDOFF_CLIENT_2026-10-04.md` (Stand vor dem Ablauf-Dialog).

---

## 1. Kontext
Frontend der Anwendung **MONTAGS-KICKER**: Login (PIN, Namensauswahl, Gast), Terminteilnahme,
Teamübersicht, Ergebniserfassung, Admin-Dashboard. Mobile-First, deutsch, installierbare PWA
(`standalone`). Rollen ADMIN, USER, GAST. „FuBo" erscheint nicht in der Oberfläche.

## 2. Techstack
React 19, Vite 8, TypeScript 6, SCSS/CSS Modules, TanStack Query, React Router 7; PWA über
`vite-plugin-pwa` 1.3.0 (`injectManifest`, `src/sw.ts`, `registerType: 'prompt'`); Vitest + RTL + MSW
(Node-Modus), Playwright; Hosting Cloudflare Pages (`app.<domain>`, API unter `api.<domain>`).

## 3. Entscheidungen (clientrelevant)
Vollständige Begründungen in den Archivfassungen; verbindliche Regeln in `AGENT_CLIENT.md`.

**Grundlagen (C0, 25./26.09.2026)**
- HttpOnly-Cookie, kein Token im Frontend; zweistufiger Login nach Server-`stage`.
- React Router statt TanStack Router; PWA mit `injectManifest`; `short_name` `GUT-KICK`.
- Keine Skillwerte für USER/GAST; Teilnehmerliste als **eine** sortierte Liste, nicht umsortieren.

**Datenzugriff (C1, 26.09.2026)**
- Genau ein Zugang zum Server (`aufrufen`), Typen aus dem Generat, keine Übersetzungstabelle für
  Fehlercodes, Query-Schlüssel an einem Ort, Offline-Zustand aus zwei Quellen, MSW nur im Node-Modus.

**Struktur und Design-System (27.09.2026)**
- Englische Ordnernamen, Domänenordner in `src/api/`; Tokens in `_globalVars.scss`, kein Hexwert
  ausserhalb, zwei Randrollen, eigenes Fokus-Token.

**Anmeldung (03.10.2026)**
- **Sitzungsende nur bei `401 SESSION_UNGUELTIG`**; `PIN_FALSCH` u. a. sind Eingabefehler.
- **Domäne `auth`** für alle `/auth/*`-Aufrufe (`src/api/sitzung/` aufgegangen).
- **Routing nach Login-Stufe** (`zielpfad.ts`, `LoginSchrittRoute`); Start ohne Sitzung auf `/pin/pruefen`.
- **PIN-Eingabe auf vier Zeichen begrenzt** (Entscheidung des Entwicklers) → `FUBO_INITIAL_PIN` muss
  vierstellig sein, obwohl der Vertrag beim Prüfen kein Format verlangt.
- **Startaufruf `GET /auth/session/lesen` bleibt auch ohne Sitzung**; der `401` ist korrekt, der
  Konsoleneintrag kosmetisch. Eine Vertragsänderung (`200` ohne Sitzung) wurde verworfen.
- **Gestaltete `Auswahlliste` statt nativem `<select>`** – dessen aufgeklappte Liste zeichnet das
  Betriebssystem und passte farblich nicht. Ersetzt C2 7.3.
- **PIN-Kästchen im festen CSS-Raster** – mit `fit-content` und Flex-Umbruch standen sie in Safari
  untereinander.
- **WebKit in CI:** E2E-Job mit allen sieben Geräteprojekten (Chromium und WebKit).

**Abschluss C2 (03.10.2026, abends)**
- **Dialog auf Basis von `<dialog>`/`showModal()`**, gesteuert über `offen`, Titel über `useId`.
  `festhalten` weist Escape ab **und** öffnet den Dialog wieder, falls der Browser ihn trotzdem
  schliesst: Seit Chrome 122 (Close Watcher) darf `cancel` ohne vorherige Nutzeraktivierung
  übersprungen werden – auch bei der Zurück-Geste unter Android.
- **Abdunkelung als eigene Regel `::backdrop { --farbe-abdunkelung }`** in `_globalVars.scss`:
  `::backdrop` erbt erst ab Chrome 122/Firefox 120/Safari 17.4 vom Dialog; auf iOS 16.4–17.3 wäre
  ein `var(--farbe-text)` dort leer.
- **Fehlertext an einem Ort:** `fehlertextBilden` und `istWiederholbar` in `src/api/common/fehler.ts`
  (neben `istNetzfehler`). Zwei Komponenten: `Fehlermeldung` (Kasten neben einer bedienbaren Ansicht)
  und `Fehlerzustand` (ersetzt den Inhalt; „Erneut versuchen" nur bei Netzfehler und `≥ 500`).
  Die Kopien `fehlertextBilden` in `PinEingabe` und `Namensauswahl` sind entfernt.
- **Zurück-Ziel:** `handle.zurueck` (innerste Route gilt) → sonst `navigate(-1)` → beim
  Direkteinstieg (`history.state.idx` ≤ 0) zur Startseite. `location.key === 'default'` verworfen,
  weil eine Umleitung mit `replace` einen neuen Schlüssel vergibt, `idx` aber 0 bleibt. Die
  Schaltfläche ist jetzt `CustomButton art="sekundaer"` (Test-ID unverändert).
- **Seite „nicht gefunden"** (`NichtGefunden`, erster Verbraucher von `Leerzustand`) ersetzt den
  C2-Platzhalter der Route `*`; ohne Zurück-Schaltfläche, die Ansicht führt selbst zur Startseite.
- **Fortschrittsbalken** als `div` mit `role="progressbar"` (kein `<progress>`), Zustand vom Server.

**Ablauf-Dialog der Sitzung (04.10.2026, C3)**
- **Zeitquelle ist der Server, die Uhr nur Darstellung.** Eigener Abruf `sitzungFristLesen`
  (`GET /auth/session/lesen` mit `X-FuBo-Kein-Refresh`) unter dem **eigenen Schlüssel**
  `schluessel.sitzungFrist` (`['sitzung','frist']`), getrennt von `useSitzung`, dessen Abruf bewusst eine
  Aktivität ist (Neuladen, Rückkehr). Der Frist-Abruf **wirft bei `401`** (anders als `sitzungLesen`):
  So bemerkt er den Ablauf einer untätigen Person, und die globale Behandlung führt zur PIN.
  Abstand 30 s, in den letzten drei Minuten 5 s (`useRestlaufzeit`).
- **Zwei Fälle** (DESIGN.md): *verlängerbar* (Dialog „Sitzung läuft ab", `festhalten`, Optionen
  „Sitzung verlängern"/„Abmelden", Text „Deine Sitzung läuft gleich ab. Verlängere sie, um weiterzuarbeiten.") und *nicht mehr verlängerbar* (Dialog „Sitzung endet bald", ruhiger Text,
  „Weiterarbeiten"/„Abmelden", Escape = Weiterarbeiten, kommt nicht wieder). Erkennung: `gueltigBis <
  absolutGueltigBis` – der Server klemmt `gueltigBis` per `LEAST` auf die Obergrenze, beide sind dann
  **exakt** gleich. Verglichen werden zwei Serverzeitpunkte, nicht die Geräteuhr.
- **Keine Restzeit als Zahl im Dialog** (Entscheidung vom 04.10.2026): Der Text sagt „gleich", der
  Balken (Rest der Warnzeit, `aria-hidden`, `sitzung-ablauf-balken`) ist die einzige Zeitanzeige. Folge für
  Screenreader: Es gibt keine vorgelesene Minutenzahl, nur die Dringlichkeit im Text. `useRestlaufzeit`
  liefert `restMs` weiter (für den Balken). Eine dauerhafte Restlaufzeit-Anzeige als Chip im Kopf
  entfällt (Entscheidung des Entwicklers vom 04.10.2026).
- **Warnzeit 2 Minuten** (Prototyp 16, `WARNZEIT_MS`). Der Dialog bleibt im Baum (Teil von
  `GeschuetzteRoute`) und wird über `offen` gesteuert, damit der Browser den Fokus ins Eingabefeld
  zurückgibt. Beim Öffnen steht der Fokus auf „Sitzung verlängern" (Aktion ohne Verlust).
- **„Abmelden" in der Kopfzeile** (`AppLayout`, 04.10.2026): rechts (`margin-inline-start: auto`), gegenüber von
  „Zurück", nur bei `stage = PROFILE_AUTHENTICATED` (`useSitzung().angemeldet`; für Gast ebenfalls). Die
  Kopfzeile erscheint damit auch auf der Startseite (rund 60 px mehr Höhe dort), nicht mehr nur mit „Zurück".
  Keine Rückfrage: Abmelden verliert nichts, der Weg zurück ist PIN und Name. Fehler (`layout-abmelden-fehler`)
  unter der Kopfzeile, die Person bleibt angemeldet. Der Fehler bleibt stehen, bis der nächste Versuch
  startet (kein Zurücksetzen beim Seitenwechsel). Test-ID `layout-abmelden`.
- **Erst der Server, dann der Client:** `useAbmelden` räumt nach `204` über `sitzungsendeAusloesen()`
  (neu in `queryClient.ts`, dieselbe Funktion wie beim `401`: Cache leeren, zur PIN). Bei Fehler bleibt die
  Person angemeldet und sieht den Fehler. `useSitzungErneuern` bricht einen laufenden Frist-Abruf ab,
  invalidiert und meldet Erfolg erst mit dem neuen Stand.
- **`Dialog` erweitert** um `symbol` (schmückend) und `beschreibungId` (`aria-describedby`).
- **Abweichungen vom Prototyp:** kein Griff am Sheet (verspräche Wegwischen), kein Satz „Eingaben werden
  zwischengespeichert" (stimmt nicht), Balken zeigt den Rest der **Warnzeit**, nicht des Fensters (dessen
  Länge kennt der Client nicht).

**Meldungen ohne Verbindung (04.10.2026, Rückmeldung des Entwicklers)**
- Vorher standen offline zwei Meldungen da (Streifen und Fehlerzustand), der Fehlerzustand ersetzte
  die schon geladene Namensliste beim gescheiterten Polling, und die Namensauswahl scrollte
  (944 statt 780 px bei 360 × 780).
- Jetzt **immer nur eine Meldung:** Die `Fehlermeldung` der Ansicht hat Vorrang und blendet den
  `OfflineHinweis` aus (Zähler `useNetzfehlerMeldung.ts`, `useLayoutEffect` gegen ein Aufblitzen).
  Der Streifen bleibt Rückfall, liegt `fixed` über der Kopfzeile und lässt sich wegklicken.
- `Fehlermeldung` im Stil des Streifens; bei Netzfehler mit `no_connection_icon_red` (liegt im
  Precache). `Fehlerzustand` kompakt und nur ohne Daten; danach meldet die Namensauswahl
  `failureReason` **an Stelle** des Listenhinweises.
- Platz gewonnen: Kopfzeile nur noch mit Zurück-Schaltfläche, seit C3 auch mit „Abmelden" bei Anmeldung (vorher leeres Band, ca. 60 px), die
  überholte Reserve unten in `.inhalt` (32 px plus Safe Area) entfernt. Ergebnis: 780/780 in allen
  geprüften Offline-Fällen. Mit mehr Inhalt oder kleineren Geräten bleibt Scrollen möglich.
- **Nachtrag (Fehlerbilder 1/2):** Fiel der Server der Anwendung aus, fehlte das Symbol (Datei nicht
  abrufbar), und der Text wich von dem bei ausgefallenem Backend ab („… prüfe deine Verbindung" gegen
  „Der Server ist nicht erreichbar."). Jetzt ein Text für beide Fälle (`TEXT_NICHT_ERREICHBAR`, auch in
  `httpService.ts`), immer `error_circle_icon`, eingebettet über `Icon/eingebettet.ts`. Schriftgrösse
  der Meldung wie im Streifen (`--schrift-klein`), damit der längere Text bei 360 px zweizeilig bleibt.
  Andere Symbole fehlen im Entwicklungsserver ohne Verbindung weiterhin.
- `TEXT_NICHT_ERREICHBAR` trägt einen festen Umbruch (`\n`) vor „Bitte …“; sichtbar über
  `white-space: pre-line` am Text der `Fehlermeldung`. Bei 360 px zwei Zeilen, bei 320 px vier
  (Namensauswahl mit Gastbereich scrollt dort um 25 px) – bewusst offen.
- **Korrektur `playwright.config.ts`:** Das Muster `NUR_CHROMIUM` (`/\.pwa\.spec\.ts$/`) erfasste
  `e2e/pwa.spec.ts` nicht; die PWA-Tests wären im CI auch in WebKit gelaufen. Neues Muster
  `/(^|[/\\.])pwa\.spec\.ts$/`, nachgeprüft mit `playwright test --list` (WebKit-Projekte: 0).

## 4. Schnittstelle zum Server
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kontrakt-Kopie
`client/harness/assets/fubo-api.json` (44 Operationen, zuletzt am 26.09.2026 byteweise gegen
`server/fubo-api.json` verglichen); Generat `src/api/common/types/schema.d.ts`.

**Offene Vertragslücke (Server-Track):** In der Stufe `PIN_VERIFIED` nennt kein Endpunkt die freien
Gastplätze. DESIGN.md verlangt, „Gast" vorab zu sperren, wenn alle Plätze belegt sind; heute zeigt die
Oberfläche das erst nach `409 KEIN_GAST_SLOT_FREI`. Vorschlag: Feld `gastPlatzFrei` an
`GET /auth/users/lesen` oder ein eigener Endpunkt.

## 5. Meilensteine (Client)
Mid-Level-Entwickler, KI-gestützt, ca. 6,5 h/Woche. Schnitt vom 25.09.2026, Begründung im Archiv.

| MS | Inhalt | h | Stand |
|---|---|---|---|
| C0 | Projektfundament, PWA-Basis, Testwerkzeuge, CI | 14 | **abgeschlossen** (`e6f8bad`, nachgeprüft 26.09.) |
| C1 | Vertrag, Datenzugriff, Mocks, Offline-Hinweis | 10 | **abgeschlossen** (26.09.) |
| C2 | Design-System, Basis-Komponenten, Lade-/Leer-/Fehlerzustand | 12 | **umgesetzt** (03.10.): alle Komponenten, Zurück-Ziel, Offline-Hinweis; offen nur Abnahme 5 (WebKit im CI), 10 (Zoom 200 %) und 11 (Telefon im Sonnenlicht, Safari) sowie der Dialog-E2E-Test mit dem ersten echten Dialog (C3) |
| C3 | Sitzung & Spieler-Login | 14 | **in Arbeit:** PIN-Eingabe, Namensauswahl mit Polling, Gast, Routing nach Stufe, **Ablauf-Dialog mit Verlängern/Abmelden** (04.10.); **„Abmelden" in der Kopfzeile** (04.10.); **entfällt**: dauerhaft sichtbare Restlaufzeit-Anzeige (Chip im Kopf), Handprüfung |
| C4 | Admin-Zugang, Passwort-Reset und -wechsel | 8 | offen |
| C5 | Termin & Teilnahme, User-Dashboard | 14 | offen |
| C6 | Teams & Ergebnis | 12 | offen |
| C7 | Admin-Verwaltung | 20 | offen |
| C8 | PWA-Onboarding & Push (A25) | 14 | offen |
| C9 | Abnahme, WCAG 2.1 AA, Deployment | 12 | offen; **blockiert**, bis `app.<domain>` in Cloudflare Pages steht |

Summe 130 h. C1 bis C8 sind nicht blockiert (Server S0–S8 vollständig).

## 6. Code-Zustand

### 6.1 Überblick
- **Datenzugriff:** `src/api/common/` (`httpService`, `fehler`, `schluessel`, `verbindungsStatus`,
  Generat) und `src/api/auth/auth.ts` (`sitzungLesen`, `pinPruefen`, `namenslisteLesen`,
  `nameWaehlen`, `alsGastAnmelden`, `sitzungFristLesen`, `sitzungErneuern`, `sitzungBeenden`).
- **Query-Client** (`src/app/queryClient.ts`): Wiederholung nur bei `≥ 500`, Mutationen nie;
  `istSitzungsende` leert den Cache und ruft den `SitzungsWaechter`.
- **Routing** (`src/app/`): `routen.tsx`; Guards `LoginSchrittRoute`, `GeschuetzteRoute`, `AdminRoute`;
  `zielpfad.ts` (Stufe → Pfad); `routenAngaben.ts` (`handle.ohneZurueck`).
- **Hooks:** `useSitzung`, `useVerbindung`, `useSitzungswechsel` (gemeinsamer Stufenwechsel),
  `usePinPruefen`, `useNamensliste` (Polling 5 s mit `X-FuBo-Kein-Refresh`), `useNameWaehlen` (liest
  bei `NAME_BELEGT` die Liste sofort neu), `useGastAnmelden`, `useRestlaufzeit` (Frist-Abruf plus
  Sekundentakt: `restMs`, `verlaengerbar`, `warnen`), `useSitzungErneuern`, `useAbmelden`.
- **Seiten:** `PinEingabe` (vier Kästchen über nativem Zahlenfeld, Sperre bei `429`), `Namensauswahl`
  (Auswahlliste mit belegten Namen, Hinweis bei zwischenzeitlicher Belegung, Gastbereich mit Name,
  Stufe, Info-Icon und „(Gast)"; Fehler am Feld bzw. im Kasten).
- **Komponenten:** `Aktionsleiste`, `AktualisierungsHinweis`, `Auswahlliste`, `CustomButton`,
  `Dialog`, `Erklaerung`, `SitzungAblaufDialog` (in `GeschuetzteRoute`), `Fehlermeldung`, `Fehlerzustand`, `Feld`, `Fortschrittsbalken`, `Icon`,
  `Ladespinner`, `Leerzustand`, `OfflineHinweis` (Symbol über `Icon`), `Platzhalter`.
- **Fehlertexte:** `fehlertextBilden`, `istWiederholbar`, `TEXT_NICHT_ERREICHBAR` in
  `src/api/common/fehler.ts`.
- **Seiten zusätzlich:** `NichtGefunden` (Route `*`).
- **Layout:** `AppLayout` mit Safe-Area, Zurück-Navigation (Ziel aus `handle.zurueck`, sonst ein
  Schritt, beim Direkteinstieg zur Startseite; abbestellbar) und Inhalt als Flex-Spalte.
- **Test-Stub:** `src/test/setup.ts` ergänzt jsdom um `showModal`/`show`/`close` von `<dialog>`.
- **PWA:** Manifest, eigener Worker, `_headers`/`_redirects` nach den Cloudflare-Auflagen.
- **Tests:** 193 Unit-Tests in 32 Dateien (Stand 04.10.2026, nach Ablauf-Dialog und Abmelden in der Kopfzeile); E2E in `sitzung-ablauf.spec.ts` (14 Fälle, davon 4 zu „Abmelden in der Kopfzeile": Bottom Sheet, Fokusfalle, Escape, Fokus-Rückgabe, Abmelden, Ablauf, Obergrenze), `layout.spec.ts` (inkl. Zurück-Ziel, „nicht
  gefunden", Fokusring), `namensauswahl.spec.ts`
  (API per `page.route`) und `pwa.spec.ts` (nur Chromium). CI: Job `pruefen` (Lint, Typen, Bau,
  Unit-Tests) und Job `e2e` (alle sieben Projekte, Chromium und WebKit).

### 6.2 Verifikation (Stand 03.10.2026, Abschluss C2)
`npm run typecheck`, `npm run lint`, **135 Unit-Tests**, Bau (sechs Precache-Einträge), kein Hexwert
ausserhalb der Tokendatei, kein `darken(`/`lighten(`/`@import`, `npm ci` in frischem Baum, **72
E2E-Tests in den drei Chromium-Projekten**. Gegenproben (Test rot ohne Absicherung): Wiederöffnen
im Modus `festhalten`, Direkteinstieg (Unit und E2E – ohne Absicherung landete „Zurück" auf
`about:blank`), kein „Erneut versuchen" bei `409`. Sichtprüfung bei 360 px über eine nur in der
Prüfumgebung angelegte Demo-Route: Fortschrittsbalken, Leerzustand, Dialog als Bottom Sheet
(Fokusfalle hält, Escape schliesst, Fokus kehrt zurück), „nicht gefunden", Ladefehler der
Namensauswahl, Offline-Hinweis mit Netzfehler an der PIN. **Nicht geprüft:** die vier
WebKit-Projekte (Browser-Download gesperrt) – sie laufen im CI-Job `e2e`.

**Ablauf-Dialog (04.10.2026):** `typecheck`, `lint`, **187 Unit-Tests**, kein Hexwert ausserhalb der
Tokendatei, ein `fetch(`. E2E `sitzung-ablauf.spec.ts` **30 Läufe grün in den drei Chromium-Projekten**
(in einer Kopie in der Cloud-Umgebung mit vorinstalliertem Chromium und Bau mit sechs Precache-Einträgen,
weil der Browser-Download auf dem Entwicklerrechner gesperrt ist; WebKit läuft im CI). Gegenproben (Test
rot ohne Absicherung): `festhalten`, Wiederöffnen bei Escape (Chromium 1194 überspringt `cancel`
tatsächlich), `show()` statt `showModal()` (Fokusfalle), Erkennung „nicht verlängerbar", Merker
„Weiterarbeiten", `cancelQueries`, dichter Abstand, `dataUpdatedAt`, Kopf `X-FuBo-Kein-Refresh`,
Einbindung in `GeschuetzteRoute`. Sichtprüfung bei 360 px: beide Fälle und Fehlerzustand. **Nicht
geprüft:** WebKit/iOS, echtes Telefon.

### 6.3 Fallen, die aufgetreten sind
- **`npm install` repariert die Sperrdatei stillschweigend**, nur `npm ci` prüft sie (26.09.).
- **`invalidateQueries` lädt nur beobachtete Abfragen neu** – Hook-Tests brauchen `useSitzung` daneben.
- **Ein laufender Abruf ohne Daten wird beim Invalidieren nicht ersetzt**, sondern übernommen; daher
  `cancelQueries` vor dem Neulesen der Sitzung.
- **Safari und `fit-content` an umbrechender Flex-Zeile:** Breite = ein Element; festes Raster nutzen.
- **Playwright klickt nicht auf `aria-disabled`-Elemente** (wartet); im Test `force: true`.
- **Umbenennen per Suchen und Ersetzen** traf Kommentare, Doku und Archive („Iconn"); korrigiert, Archive
  aus Git wiederhergestellt, Ordner `AppIcon` → `Icon`.
- **jsdom kennt `showModal` nicht** – Stub in `setup.ts`; Tests prüfen `dialog.open`.
- **`::backdrop` erbte früher nichts** – eigenes Token direkt auf `::backdrop`.
- **`cancel` am Dialog ist nicht garantiert** (Close Watcher, Chrome 122) – Wiederöffnen in `onClose`.
- **Zwei `Date.now()` für „gleiche" Zeitpunkte** wichen um eine Millisekunde ab und machten „nicht mehr
  verlängerbar" zufällig zu „verlängerbar" (nur auf einem E2E-Projekt aufgefallen). Mocks mit **einer**
  Uhrablesung bauen (`sitzungMitRest`).
- **Eine Beispielsitzung mit festem Datum in der Vergangenheit** öffnet seit dem Ablauf-Dialog in jedem
  Test den Dialog; `beispielSitzung` liegt jetzt im Jahr 2099.
- **`visibilitychange` ohne `bubbles: true`** erreicht das `window` nicht, TanStack Query hört dort.
- **Fokus bei Tab im modalen Dialog** geht kurz auf das Dokument (Browserrahmen); eine Fokusfalle prüft man
  mit einem fokussierbaren Element **hinter** dem Dialog, nicht mit „bleibt im Dialog".
- **`git status` hinterliess wieder eine leere `.git/index.lock`** (entfernt mit Löschfreigabe); im
  verbundenen Ordner `git --no-optional-locks` benutzen.
- **Im verbundenen Ordner ist Löschen standardmässig gesperrt:** `vite build` scheitert beim Leeren
  von `dist/`, und ein Git-Aufruf hinterliess eine leere `.git/index.lock` (entfernt). Gilt nur für
  die Agentenumgebung, nicht für das lokale Terminal.
- **WebKit rundet die Breite des Fokusrings auf ganze Gerätepixel ab:** Bei Pixeldichte 2,5 (`iPad (gen 11)`)
  meldet `getComputedStyle` 2.8px statt 3px, Chromium 3px (CI, 04.10.2026). Die E2E-Prüfung erwartet daher
  einen Wert zwischen abgerundeter Breite und 3 px (`pruefeFokusringBreite` in `layout.spec.ts`).

### 6.4 Bewusst offen
- Zielangabe mit Parameter (`teams/:terminId` → Termin) kennt `RoutenAngaben` noch nicht (C6).
- `/admin/anmelden` und „nicht gefunden" lesen beim Direkteinstieg keine Sitzung; der
  Offline-Hinweis erscheint dort erst mit dem ersten Aufruf oder dem Ereignis `offline`.
- Dialog-E2E (Fokusfalle, Escape) ist mit dem Ablauf-Dialog da (nur Chromium geprüft; WebKit im CI,
  Tab-Teil dort ohne Systemeinstellung übersprungen).
- **Leerlauf-Fenster ≤ 2 Minuten (Admin-Konfiguration erlaubt ab 1):** Der Dialog erschiene nach jedem
  Verlängern sofort wieder. Vorschlag: Mindestwert im Server anheben (z. B. 5 Minuten) oder die Warnzeit
  als Anteil des Fensters führen.
- **Die Geräteuhr bestimmt, wann der Dialog erscheint** (der Server gibt nur Zeitpunkte, keine „jetzt"-Angabe).
  Abgemeldet wird nur auf Anweisung des Servers. Verbesserung möglich über den `Date`-Header der Antwort.
- Beim Zurückkehren in die Anwendung liest `useSitzung` (verlängernd) und der Frist-Abruf gleichzeitig; im
  Grenzfall zeigt der Dialog bis zu 5 s einen Stand, der schon überholt ist.
- Tab auf Links/Schaltflächen ist in WebKit ohne Systemeinstellung nicht möglich; der E2E-Test dazu
  läuft nur in Chromium, WebKit bleibt Handprüfung.
- Titel „MONTAGS-KICKER" bricht unter 360 px Breite um (320 px: zwei Zeilen).
- `alt` des Logos auf der PIN-Seite: das Bild ist schmückend (Titel folgt), `alt=""` wäre korrekt.
- `npm audit`: drei moderate Befunde in `@vitest/mocker` (nur Entwicklung, Behebung verlangt Vitest 5).
- Die Trennlinie der Aktionsleiste ist entfernt (Entscheidung des Entwicklers vom 03.10.2026).
- **Gastbereich plus Verbindungsmeldung scrollt auf kleinen Telefonen** (CI, `ios-schmal` 375 × 667 und `ios-telefon`
  402 × 681, 04.10.2026): Die Ansicht ist mit gewähltem Gast und Meldung 736 px hoch (in Chromium bei 375 × 667
  nachgestellt: 695 px vor dem Ausfall, 736 px mit Meldung). Die Meldung hängt also rund 41 px an, statt den
  Hinweis zu ersetzen; auf einem 780-px-Telefon fällt das nicht auf. **Entscheidung
  vom 04.10.2026: Layout bleibt, kleinere Telefone scrollen.** Der E2E-Test
  (`namensauswahl.spec.ts`, „meldet einen Verbindungsverlust …") prüft „kein Scrollen" deshalb nur noch ab
  Fensterhöhe 740 px (`ios-schmal` und `ios-telefon` fallen heraus, die Android-Profile bleiben). Wer die
  Ansicht später für 667 px verdichten will, hebt diese Grenze wieder auf.
- **Vite-Warnung beim Start** („Assets in public directory cannot be imported from JavaScript"): kommt von
  `Icon/eingebettet.ts`, das zwei SVGs per `?raw` aus `public/icons/` einbettet. Dev und Bau funktionieren
  (nachgeprüft: Antwort `200`, SVG im Bündel); der Weg ist aber von Vite nicht vorgesehen und kann mit einem
  Vite-Update brechen. **Vorerst hingenommen (Entscheidung vom 04.10.2026).** Saubere Lösung, wenn sie fällig
  wird: die beiden SVGs nach `src/` verlegen (dann entfallen `includeAssets` in `vite.config.ts` und die
  Precache-Zahl sinkt von 6 auf 5; `Icon.test.tsx` und `pwa.spec.ts` anpassen).

## 7. Nächste Schritte
1. **Push auf `dev_client`** und den ersten CI-Lauf mit WebKit prüfen.
2. **Handprüfung gegen eine laufende Serverinstanz:** Cookie im Netzwerkfenster, PIN richtig/falsch/
   gesperrt, Namenswahl, Gast, `NAME_BELEGT` mit zwei Geräten, Sitzungsende → Umleitung zur PIN.
3. **C3 abschliessen:** Handprüfung des Ablauf-Dialogs gegen
   den echten Server (Leerlauf auf 2 Minuten stellen, Verlängern, harte Obergrenze, zwei Tabs).
4. **C2-Restabnahme:** Zoom 200 % bei 360 px, echtes Telefon im Sonnenlicht (auch Safari/iOS),
   CI-Lauf mit WebKit.
5. **Server-Track:** Vertragslücke freie Gastplätze (Abschnitt 4).
6. **Betrieb:** Custom Domain `app.<domain>`, Rocket Loader und Auto-Minify aus,
   `FUBO_INITIAL_PIN` vierstellig.

## 8. Weitere Anweisungen
- Repo-Wurzel `client/`, Branches `dev_xxx`; nichts nach `main` ohne ausdrückliche Anweisung.
- Getrennte Repositories: Vertragsänderungen zuerst in `server/fubo-api.json`, dann Kopie gegen den
  Unterschied auffrischen, Typen und Mocks nachziehen.
- `.env` nie einchecken; keine realen Personennamen in Code, Tests oder Doku.
- Nach jedem Paket: visuelle Prüfung, dieser Handoff (Vorfassung ins Archiv), `AGENT_CLIENT.md` und
  `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` nachziehen. Über 500 Zeilen: kürzen.
