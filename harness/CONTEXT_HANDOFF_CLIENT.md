# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand).
> Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.
>
> Repository: **eigenständig mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`), Branch
> `dev_client`. **Kein Monorepo**; das Backend liegt in `FuBo-Server` (`server/`). `PRJ_FuBo/`,
> `PRJ_FuBo/harness/` und `client/harness/tmp/` sind nicht versioniert.
> **Stand: 17.10.2026** (C0, C1, C3 abgeschlossen; C2, C4 und **C5 umgesetzt** – C6 ist in C5 aufgegangen:
> Termine mit Tab-Rahmen, Teams, Ergebnisse mit Bilanz, Verlauf. Unit-Tests, Lint, Typen, Bau und E2E in Chromium
> grün; offen: Handprüfung gegen den echten Server, iPhone und WebKit im CI, siehe 6.2 und 7).
> Nächster Meilenstein: **C7** (Admin-Verwaltung und Admin-Dashboard).
> Gestraffte Fassung. Vorfassungen mit allen Herleitungen in `archive/`, zuletzt
> `archive/CONTEXT_HANDOFF_CLIENT_2026-10-17b.md` (Stand vor C5), `archive/CONTEXT_HANDOFF_CLIENT_2026-10-17.md` (vor C4) und
> `archive/CONTEXT_HANDOFF_CLIENT_2026-10-04c.md` (Stand vor dem Abschluss von C3).

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
  Aktivität ist (Start, Neuladen, Navigation, Stufenwechsel – **nicht** die Rückkehr in den Tab, siehe unten). Der Frist-Abruf **wirft bei `401`** (anders als `sitzungLesen`):
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

**Korrektur aus der Handprüfung: Rückkehr verlängert nicht (04.10.2026, abends)**
- **Fehlerbild:** Leerlauf 3 Minuten, angemeldeter Spieler, kein Ablauf-Dialog. Gegen den echten Server
  nachgestellt: `gueltigBis` sprang bei jedem Wechsel `hidden` → `visible` um drei Minuten nach hinten.
- **Ursache:** `useSitzung` erbte `refetchOnWindowFocus: true` (Vorgabe in `queryClient.ts`) und liest
  bewusst **ohne** `X-FuBo-Kein-Refresh`. Jede Rückkehr in den Tab war damit eine Verlängerung. Chrome
  unter macOS meldet schon ein verdecktes Fenster als `hidden`; wer zwischendurch nachsah, verlängerte
  jedes Mal, und der Dialog kam nie. Auf dem Telefon hätte das Entsperren die Sitzung verlängert – genau
  das „misst den offenen Tab statt den Nutzer", das der Server mit dem Kopf vermeiden will.
- **Festlegung:** `useSitzung` liest bei Fokus und Wiederverbindung **nicht** neu
  (`refetchOnWindowFocus`/`refetchOnReconnect` über `ohneStand`). Ausnahme: Es liegt noch kein Stand vor
  (Start ohne Verbindung); sonst bliebe eine angemeldete Person nach der Wiederverbindung auf der PIN.
  Den aktuellen Stand bei Rückkehr liest der Frist-Abruf (mit Kopf, `refetchOnWindowFocus` bleibt dort).
  Ersetzt die frühere Festlegung „Rückkehr ist Aktivität".
- **Warum die Tests grün waren:** Die Nachbildung in `sitzung-ablauf.spec.ts` antwortete unabhängig vom
  Kopf mit derselben Restzeit; eine Verlängerung durch einen Abruf kam nicht vor. Sie zählt jetzt
  verlängernde Abrufe (`verlaengernd`), ein neuer E2E-Fall prüft die Rückkehr.

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

**Admin-Zugang (C4, Entscheidungen E1–E5 vom 04.10.2026, umgesetzt 17.10.2026)**
- **E5 / Befund:** Die drei Admin-Login-Endpunkte (`/auth/admin/anmelden`, `/auth/passwort/zuruecksetzen`,
  `/auth/passwort/bestaetigen`) verlangen laut Vertrag `PIN_VERIFIED`; `/admin/passwort/aendern` die Rolle
  `ADMIN`. Der Einstieg „Als Admin anmelden" (`namensauswahl-admin-link`) steht deshalb **nur in der
  Namensauswahl**, die PIN-Seite hat keinen Link mehr. `/admin/anmelden`, `/admin/passwort/vergessen` und
  `/admin/passwort/neu` liegen hinter `LoginSchrittRoute schritt="name"`; `/admin/anmelden` ist nicht mehr
  ohne Sitzung erreichbar (ohne Sitzung → PIN → Namensauswahl). „Zurück" führt zur Namensauswahl bzw. je
  einen Schritt zurück. Pfade in `ADMIN_PFADE` (`zielpfad.ts`).
- **E1:** Nach der Admin-Anmeldung `/admin` (Platzhalter bis C7, ohne „Zurück", mit Link
  `admin-passwort-aendern-link`); `zielFuerStufe` kennt `istAdmin`.
- **E2/E3:** Reset in zwei Ansichten (`PasswortVergessen`, `PasswortNeu`), ein Formular für PIN und neues
  Passwort, **keine Wiederholung** des Passworts; das Auge (Umschalter „Passwort anzeigen") am `PasswortFeld` ist Pflicht und die einzige
  Kontrolle gegen Tippfehler. Neues Passwort 10–72 Zeichen, keine Zeichenklassen (`PasswortRegeln`).
- **E4:** Neutraler Hinweis (`Hinweis`, `role="status"`) über dem Formular der Zielseite: nach dem Reset auf
  der Admin-Anmeldung („Passwort gesetzt …", die Sitzung bleibt `PIN_VERIFIED`), nach dem Passwortwechsel auf
  der PIN-Eingabe. Transport über `location.state.hinweis` (`useNavigationsHinweis`); beim Wechsel räumt der
  Client sofort auf (`sitzungsendeAusloesen(hinweis)`), statt auf den nächsten `401` zu warten.
- **Fehlerverhalten** (Tabellen in der Umsetzungsanleitung): `ADMIN_PASSWORT_FALSCH` bei der Anmeldung im
  Kasten (Passwort leer, Name bleibt, Fokus ins Passwort), beim Wechsel am Feld „Bisheriges Passwort", **kein
  Sitzungsende**; `RESET_PIN_FALSCH` am PIN-Feld (PIN leer, Passwort bleibt); `409 RESET_UNGUELTIG` mit
  „Neue PIN anfordern"; `400` mit `felder` am jeweiligen Feld (`ApiFehler.felder`); `429` über `useSperre`.
  Geleert wird nur nach dem jeweiligen Code, nicht nach jedem `ApiFehler`.
- **`PinFeld` und `useSperre`** aus `PinEingabe` herausgelöst; `PinEingabe` unverändert im Verhalten.
- **Abweichungen:** Statt `Fortschrittsbalken` ein eigener `Restzeitbalken` (aria-hidden, Aussage im festen
  Satz „Gültig bis 20:58 Uhr."), weil `Fortschrittsbalken` Zusagen zählt (`role="progressbar"`, „x von y
  Zusagen"); `Namensauswahl` mit kürzeren Abständen (Gap l→m, kleinerer Fuß, Link überlappt den Fuß der
  Leiste), damit sie mit Link bei 780 px nicht scrollt; „Schritt x von 2" und Titel als Kopf mit kleinem
  Abstand. Abweichungen von DESIGN.md/Prototyp: siehe 1.3 der Umsetzungsanleitung; **DESIGN.md (Screen 1,
  E5) ist dem Entwickler zur Übernahme vorzulegen** – sie liegt nicht im Client-Repository.

**User-Dashboard, Teams, Ergebnisse, Verlauf (C5, 17.10.2026; die Pakete C5 und C6 sind zusammengelegt)**
Vollständig in `harness/tmp/C5_UMSETZUNG.md` (Entscheidungen E1–E14); clientrelevant:
- **Vier Hubs, ein Rahmen:** `DashboardLayout` mit `TabLeiste` (`<nav aria-label="Bereiche">`, vier Links, **keine
  ARIA-Tab-Rollen**; `aria-current="page"`) für `/`, `/teams`, `/ergebnisse`, `/verlauf` (E11, E12, `OHNE_ZURUECK`).
  Detailrouten `termine/:terminId`, `teams/:terminId`, `ergebnisse/:terminId` stehen **ausserhalb** des Layouts, ohne
  Leiste, mit „Zurück". Ungültige Adresse (`abc`, `0`, `-1`) → „nicht gefunden" **ohne** Abruf (`useTerminParameter`).
- **Der Admin sieht das User-Dashboard nicht (E7):** `zielFuerStufe` leitet ihn nach `/admin` (Umleitung); der Kommentar
  zu A9 in `zielpfad.ts` ist angepasst.
- **Lesen und Schreiben:** Termine pollen alle 20 s (`TERMINE_INTERVALL_MS`) mit `X-FuBo-Kein-Refresh: true`; jede
  Mutation (Rückmeldung, Teams, Ergebnis) **ohne** Kopf, nie wiederholt. Schlüssel nur in `schluessel.ts`
  (`termine`, `termin(id)`, `termineVerlauf`, `bilanz`). `invalidateQueries` lädt nur **beobachtete** Abfragen neu.
- **Zustände statt Werte:** `eigeneRueckmeldung` ist dreiwertig (`true`/`false`/`null`; `null` ist nicht „abgesagt");
  `teams` und `ergebnis` sind im Normalzustand `null` (eigener Leerzustand); die Teilnehmerliste wird **nie**
  umsortiert; `mindestzahlErreicht` kommt vom Server und wird nicht nachgerechnet.
- **Teams:** `POST /teams/generieren` ohne Kopf; ein Ersetzen einer **aktuellen** Einteilung fragt nach (`Dialog`).
  Das Kontingent ist **nur** über `409 KONTINGENT_ERSCHOEPFT` erkennbar: Die Seite merkt sich die `teilnehmerVersion`
  und sperrt die Aktion (`aria-disabled`, Grund als Text), bis sie sich ändert (E15). `veraltet` versteckt nichts.
  Nach `TEAMS_FIXIERT`/`TERMIN_GESCHLOSSEN` und `404` liest der Hook den Termin neu (Erweiterung gegenüber der Vorgabe).
- **Ergebnis:** Der **erste Eintrag gilt**, ein Ergebnis ist nicht löschbar (Korrektur nur Admin, `ergebnisKorrigieren`
  im Datenzugriff, noch ohne Ansicht → C7). Formular mit Radiogruppe „Wer hat gewonnen?" und Haken „Deutlicher Sieg";
  bei `U` ist der Haken gesperrt und zurückgesetzt, `ergebnisErfassen` sendet dann ohnehin `deutlich = false`.
  **Bestätigungsdialog** mit demselben Satz wie die Anzeige (`ergebnisSatz`). **`409 ERGEBNIS_VORHANDEN` ist ein
  Hinweis, kein Fehler:** Die Seite zeigt das fremde Ergebnis und „Das Ergebnis war bereits erfasst; es gilt der
  erste Eintrag." (E17). Nach dem Abschluss springt der Fokus auf die Überschrift der Anzeige. Zustandsmatrix der
  Seite: Anzeige / Formular / „Keine Einteilung" / „erst nach Abschluss" / „abgesagt". Die **Bilanz** (`useBilanz`)
  gibt es **nicht für Gäste** (kein Abruf, keine Karte); dreimal `0` zeigt „Noch keine Spiele gewertet.".
- **Verlauf:** 60 Tage (`VERLAUF_TAGE`, E14; Abruf mit `ab`, im Client auf vergangene Termine gefiltert, neueste zuerst,
  eigener Schlüssel, **kein** Polling, kein „Mehr laden"). Zeile eines abgeschlossenen Termins ist ein Link
  `ergebnisse/:terminId` (≥ 44 px), abgesagte Termine ohne Link. Der Satz unter der Liste nennt die Zahl aus der Konstante.
- **Seiten mit Aktionsleiste:** Die `Aktionsleiste` ist das **letzte Kind** der Seite (sonst haftet sie nicht über dem
  ganzen Inhalt); ein geschlossener `<dialog>` gehört in den Behälter der Leiste. Bei `aria-disabled` bleibt der Fokus,
  der Grund steht als Text (`aria-describedby`).
- **Schreibende Hooks, deren Aufrufer sich austauscht:** Der Hook liest vor dem Ende der Mutation den Termin neu, die
  Seite tauscht dabei das Formular gegen die Anzeige. Rückrufe von `mutate(…, { onSuccess })` kommen dann nicht mehr
  an (Komponente ist ausgehängt) → **`mutateAsync`** mit `try/catch`; der Fokus folgt der Anzeige über einen Effekt auf
  `[Anfrage, hatErgebnis]` statt über eine einmalige Anfrage.
- **Uhr nie im Render** (`react-hooks` v7): `new Date()` in `select`/`queryFn` (`useVerlauf`) oder in einem Hook mit
  Takt (`useBegonnen`).

## 4. Schnittstelle zum Server
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kontrakt-Kopie
`client/harness/assets/fubo-api.json` (**45 Operationen**, am 17.10.2026 byteweise gegen
`server/fubo-api.json` verglichen und übernommen); Generat `src/api/common/types/schema.d.ts`
(`npm run api:typen`, neu erzeugt). Neu gegenüber 44: `POST /admin/name/bestaetigen`; `POST /admin/name/aendern`
antwortet jetzt `202` (Namensänderung mit E-Mail-PIN, **Client-Seite folgt in C7**). Ein `202` ohne Rumpf
liefert `aufrufen` wie `204` als `undefined` (`ANTWORT_OHNE_RUMPF`, mit Gegenprobe). `servers` im Vertrag
nennt jetzt `https://tunnel-fubo-app.{domain}` (Vorgabe `denis-kim.dev`); `AGENT_CLIENT.md` und die Hosting-
Notizen sprechen noch von `api.<domain>` – bei C9 (Deployment) klären; der Client nutzt `VITE_API_BASE_URL`.

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
| C2 | Design-System, Basis-Komponenten, Lade-/Leer-/Fehlerzustand | 12 | **umgesetzt** (03.10.): alle Komponenten, Zurück-Ziel, Offline-Hinweis; offen nur Abnahme 5 (WebKit im CI), 10 (Zoom 200 %) und 11 (Telefon im Sonnenlicht, Safari). Der Dialog-E2E-Test kam mit dem Ablauf-Dialog (C3) |
| C3 | Sitzung & Spieler-Login | 14 | **abgeschlossen** (04.10.): PIN-Eingabe, Namensauswahl mit Polling, Gast, Routing nach Stufe, Ablauf-Dialog mit Verlängern/Abmelden, „Abmelden" in der Kopfzeile, Korrektur „Rückkehr verlängert nicht"; Handprüfung und E2E-Tests vom Entwickler bestätigt. **Entfallen:** dauerhaft sichtbare Restlaufzeit-Anzeige (Chip im Kopf) |
| C4 | Admin-Zugang, Passwort-Reset und -wechsel | 8 | **umgesetzt** (17.10.2026): drei Ansichten plus Bausteine; offen Handprüfung gegen den echten Server und WebKit im CI (6.2) |
| C5 | Termin & Teilnahme, User-Dashboard, Teams, Ergebnisse, Verlauf (**C6 aufgegangen**) | 31,5 | **umgesetzt** (17.10.2026): vier Stufen (Termine mit Tab-Rahmen, Teams, Ergebnisse mit Bilanz, Verlauf); offen Handprüfung gegen den echten Server, iPhone, WebKit im CI (6.2) |
| C6 | (in C5 aufgegangen) | – | entfällt als eigenes Paket |
| C7 | Admin-Verwaltung und Admin-Dashboard | 20 | offen |
| C8 | PWA-Onboarding & Push (A25) | 14 | offen |
| C9 | Abnahme, WCAG 2.1 AA, Deployment | 12 | offen; **blockiert**, bis `app.<domain>` in Cloudflare Pages steht |

Summe 135,5 h (C5 und C6 = 26 h geplant, 31,5 h veranschlagt). C1 bis C8 sind nicht blockiert (Server S0–S8 vollständig).

## 6. Code-Zustand

### 6.1 Überblick
- **Datenzugriff:** `src/api/common/` (`httpService`, `fehler`, `schluessel`, `verbindungsStatus`,
  Generat) und `src/api/auth/auth.ts` (`sitzungLesen`, `pinPruefen`, `namenslisteLesen`,
  `nameWaehlen`, `alsGastAnmelden`, `sitzungFristLesen`, `sitzungErneuern`, `sitzungBeenden`,
  ab C4 `adminAnmelden`, `passwortZuruecksetzen`, `passwortBestaetigen`), `src/api/admin/admin.ts`
  (`passwortAendern`) und `src/api/auth/passwortRegeln.ts` (Grenzen 10/72, `RESET_GUELTIG_MS`).
- **Query-Client** (`src/app/queryClient.ts`): Wiederholung nur bei `≥ 500`, Mutationen nie;
  `istSitzungsende` leert den Cache und ruft den `SitzungsWaechter`.
- **Routing** (`src/app/`): `routen.tsx`; Guards `LoginSchrittRoute`, `GeschuetzteRoute`, `AdminRoute`;
  `zielpfad.ts` (Stufe → Pfad); `routenAngaben.ts` (`handle.ohneZurueck`).
- **Hooks:** `useSitzung`, `useVerbindung`, `useSitzungswechsel` (gemeinsamer Stufenwechsel),
  `usePinPruefen`, `useNamensliste` (Polling 5 s mit `X-FuBo-Kein-Refresh`), `useNameWaehlen` (liest
  bei `NAME_BELEGT` die Liste sofort neu), `useGastAnmelden`, `useRestlaufzeit` (Frist-Abruf plus
  Sekundentakt: `restMs`, `verlaengerbar`, `warnen`), `useSitzungErneuern`, `useAbmelden`; ab C4 `useSperre`, `useNavigationsHinweis`,
  `useAdminAnmelden`, `usePasswortAnfordern`, `usePasswortBestaetigen`, `usePasswortAendern`.
- **Seiten:** `PinEingabe` (vier Kästchen über nativem Zahlenfeld, Sperre bei `429`), `Namensauswahl`
  (Auswahlliste mit belegten Namen, Hinweis bei zwischenzeitlicher Belegung, Gastbereich mit Name,
  Stufe, Info-Icon und „(Gast)"; Fehler am Feld bzw. im Kasten).
- **Komponenten:** `Aktionsleiste`, `AktualisierungsHinweis`, `Auswahlliste`, `CustomButton`,
  `Dialog`, `Erklaerung`, `SitzungAblaufDialog` (in `GeschuetzteRoute`), `Fehlermeldung`, `Fehlerzustand`, `Feld`, `Fortschrittsbalken`, `Icon`,
  `Ladespinner`, `Leerzustand`, `OfflineHinweis` (Symbol über `Icon`), `Platzhalter`.
- **Fehlertexte:** `fehlertextBilden`, `istWiederholbar`, `TEXT_NICHT_ERREICHBAR` in
  `src/api/common/fehler.ts`.
- **Seiten zusätzlich:** `NichtGefunden` (Route `*`); ab C4 `AdminAnmeldung`, `PasswortVergessen`,
  `PasswortNeu`, `PasswortAendern`. **Komponenten ab C4:** `PinFeld`, `PasswortFeld`, `PasswortRegeln`,
  `Hinweis`, `Textlink`, `Restzeitbalken`; `Feld` mit `aktion`, `beschriebenDurch`, `ref`; `Platzhalter` mit
  `children`.
- **Layout:** `AppLayout` mit Safe-Area, Zurück-Navigation (Ziel aus `handle.zurueck`, sonst ein
  Schritt, beim Direkteinstieg zur Startseite; abbestellbar) und Inhalt als Flex-Spalte.
- **Test-Stub:** `src/test/setup.ts` ergänzt jsdom um `showModal`/`show`/`close` von `<dialog>`.
- **PWA:** Manifest, eigener Worker, `_headers`/`_redirects` nach den Cloudflare-Auflagen.
- **Tests:** 638 Unit-Tests in 83 Dateien (Stand 17.10.2026, nach C5; vorher 356 nach C4); E2E zusätzlich `admin.spec.ts`
  (16 Fälle: Anmeldung, Reset, Passwort ändern, Passwortfeld, kein Scrollen bei 780 px), `layout.spec.ts`
  umgebaut (Admin-Anmeldung nur nach der PIN, Zurück-Ziele, Fokusring in der Namensauswahl), Sitzungs-
  nachbildung nach `e2e/hilfen/sitzung.ts` (mit `stage` und `rolle`). Zuvor: E2E in `sitzung-ablauf.spec.ts` (15 Fälle, darunter „Rückkehr verlängert nicht“, davon 4 zu „Abmelden in der Kopfzeile": Bottom Sheet, Fokusfalle, Escape, Fokus-Rückgabe, Abmelden, Ablauf, Obergrenze), `layout.spec.ts` (inkl. Zurück-Ziel, „nicht
  gefunden", Fokusring), `namensauswahl.spec.ts`
  (API per `page.route`) und `pwa.spec.ts` (nur Chromium). CI: Job `pruefen` (Lint, Typen, Bau,
  Unit-Tests) und Job `e2e` (alle sieben Projekte, Chromium und WebKit).

- **C5 (17.10.2026), Datenzugriff:** `src/api/termine/` (`termine.ts`: `termineLesen`, `terminLesen`, `rueckmeldungSenden`;
  `terminZeit.ts`: `beginnVon`, `datumKurz`, `datumLang`, `uhrzeitKurz`, `zeitpunktKurz`, `naechsterTermin`, `heuteIso`,
  `verlaufAb`, `vergangeneTermine`, `letzterAbgeschlossener`, `VERLAUF_TAGE`), `src/api/teams/teams.ts`
  (`teamsGenerieren`), `src/api/ergebnis/` (`ergebnisErfassen`, `ergebnisText.ts` mit `ergebnisSatz`),
  `src/api/bilanz/bilanz.ts`, `src/api/admin/admin.ts` (`ergebnisKorrigieren`, ohne Ansicht).
- **C5, Hooks:** `useTermine` (Polling), `useTermin`, `useRueckmeldung`, `useBegonnen`, `useTerminParameter`,
  `useTeamsGenerieren`, `useErgebnisErfassen`, `useBilanz`, `useVerlauf`.
- **C5, Komponenten:** `TabLeiste`, `TerminKarte`, `Zusagestatus`, `Teilnehmerliste`, `RueckmeldungLeiste`,
  `TerminAnsicht`, `WeitereTermine`, `TeamsAnzeige`, `TeamsLeiste`, `BilanzKarte`, `ErgebnisAnzeige`,
  `ErgebnisFormular`, `VerlaufListe`; `CustomButton` mit `ref` und `aria-disabled`-Stil. **Seiten/Layouts:**
  `DashboardLayout`, `Dashboard`, `TerminDetail`, `TeamsSeite`, `ErgebnisSeite`, `VerlaufSeite` (die drei
  Tab-Seiten sind Routenkomponenten mit Hub und Termin). Alle vier Tab-Routen sind ausgebaut, der Platzhalter dient nur noch
  `/einstellungen` und `/admin`.
- **C5, Mocks und E2E:** `src/test/mocks/termine.ts` (zustandsbehafteter Server mit `terminHandlers()`, `terminModell`,
  `teamsAus`, `beispielErgebnis`, `beispielBilanz`), `problem.ts`; E2E-Nachbildungen `e2e/hilfen/{sitzung,termine,teams,ergebnisse}.ts`
  (Sitzung kennt jetzt `GAST`), Specs `termine`, `tabs`, `teams`, `ergebnisse`, `verlauf`.

### 6.2 Verifikation
Frühere Läufe (C2 bis C4) mit allen Gegenproben stehen in den Archivfassungen; hier der Stand je Abschnitt.
- **C2 (03.10.2026):** 135 Unit-Tests, 72 E2E in Chromium. **C3 (04.10.2026):** 197 Unit-Tests, 126 E2E in Chromium;
  Handprüfung gegen den echten Server bestanden (Ablauf-Dialog, Rückkehr verlängert nicht).
- **C4 (17.10.2026):** 353 Unit-Tests, 177 E2E in Chromium (3 übersprungen), acht Precache-Einträge. Offen: WebKit im CI,
  Handprüfung gegen den echten Server und das iPhone (Abnahme 3 der C4-Anleitung); danach das Passwort im Passwortmanager
  nachziehen (`ADMIN_PASSWORD` in `server/.env` liest der Server nur beim ersten Start).
- **C5 (17.10.2026):** `lint` (inkl. `e2e/`), `typecheck`, **638 Unit-Tests in 83 Dateien**, Bau (acht Precache-Einträge),
  genau ein `fetch(` (`httpService.ts`), kein Hexwert ausserhalb der Tokendatei, Suche nach verwaisten Pfaden ohne
  Befund (`platzhalter-c5` kommt nirgends mehr vor), **318 E2E-Läufe grün in den drei Chromium-Projekten, 3 übersprungen**
  (Kopie in der Cloud-Umgebung mit vorinstalliertem Chromium über eine Konfiguration, die nicht Teil des Repos ist).
  Gegenproben (Test rot ohne Absicherung): Stufe 1 und 2 (u. a. Beginn-Sperre, Reihenfolge der Teilnehmerliste,
  `eigeneRueckmeldung` dreiwertig, Kontingent-Sperre, Ersetzen-Rückfrage), Stufe 3 (`mutate` statt `mutateAsync` → 3 rote
  Läufe, **je Projekt einer**; Haken bei `U` nicht zurückgesetzt; Senden ohne Bestätigung; Bilanzkarte für Gast), Stufe 4
  (abgesagter Termin als Link; Verlauf mit Polling; Verlauf ohne `X-FuBo-Kein-Refresh`). **Äquivalente Mutation:** `deutlich`
  bei `U` ungefiltert senden – Formular und `ergebnisErfassen` sichern doppelt, die Wirkung ist gleich (Unit-Test des
  Datenzugriffs deckt den zweiten Riegel). Sichtprüfung bei 360 × 780 über die Layout-Fälle der E2E-Specs (kein
  waagerechtes Scrollen, Tap-Ziele ≥ 44 px, Aktion 64 px, Aktionsleiste und Dialog im Sichtfeld), **nicht** per Auge.
  **Nicht geprüft:** WebKit-Projekte (im CI), Handprüfung gegen den echten Server, iPhone, Bilanz für GAST am echten Server
  (Vertrag offen, 1.4 der C5-Anleitung), Reihenfolge der Teilnehmerliste nach Absage und erneuter Zusage am echten Server.

### 6.3 Fallen, die aufgetreten sind
- **Ein `202` ohne Rumpf** hätte `aufrufen` (`json()` auf leerem Rumpf) zum Absturz gebracht; `202` und `204`
  werden zentral als „kein Rumpf" behandelt (C4, Vertragsupdate).
- **Das Passwortfeld nicht bei jedem `ApiFehler` leeren** (Test „500: neuer Versuch über denselben Knopf"
  fiel auf): Nur nach dem Code leeren, der das Feld als falsch benennt.
- **Relative Importe in `e2e/` brauchen die Endung `.js`** (NodeNext; `tsc` meldet sonst TS2835).
- **Playwright-Version und vorinstalliertes Chromium passen in der Cloud-Umgebung nicht zusammen** (1.63 will
  Build 1243, vorhanden ist 1194): eigene Konfiguration mit `launchOptions.executablePath` ausserhalb des Repos.
- **Jede zusätzliche Zeile in der Namensauswahl kostet Platz:** der Admin-Link (48 px) ließ den Fall „Gast
  gewählt plus Meldung" bei 780 px um 27 px überlaufen; gelöst über Abstände, nicht über die Grenze 740 px.
- **`PinFeld`: `readOnly` statt `disabled`** während des Aufrufs, sonst verliert das Feld den Fokus.
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
- **Eine Nachbildung, die den Kopf `X-FuBo-Kein-Refresh` ignoriert, kann Verlängerungen nicht zeigen**
  (04.10.2026): Alle E2E-Tests grün, im Betrieb kam der Ablauf-Dialog nie. Mocks für Sitzungsabrufe
  zählen seither die Aufrufe ohne Kopf.
- **Vorgaben des Query-Clients gelten auch für verlängernde Abrufe:** `refetchOnWindowFocus` und
  `refetchOnReconnect` sind Abrufe ohne Bedienung. Wer einen Abruf ohne `X-FuBo-Kein-Refresh` anlegt,
  schaltet beides ab (Muster: `useSitzung`).
- **WebKit rundet die Breite des Fokusrings auf ganze Gerätepixel ab:** Bei Pixeldichte 2,5 (`iPad (gen 11)`)
  meldet `getComputedStyle` 2.8px statt 3px, Chromium 3px (CI, 04.10.2026). Die E2E-Prüfung erwartet daher
  einen Wert zwischen abgerundeter Breite und 3 px (`pruefeFokusringBreite` in `layout.spec.ts`).

- **C5 – Rückrufe von `mutate` gehen verloren, wenn der Aufrufer sich austauscht** (Formular → Anzeige beim Neulesen im
  Hook). Zufällig grün in einem Projekt, rot in zwei anderen (Last): immer `mutateAsync` mit `try/catch`, wo der Hook den
  Aufrufer per Neulesen verdrängt; E2E über **alle drei** Projekte laufen lassen.
- **C5 – Eine Gegenprobe ist nur gültig, wenn die Mutation gebaut wurde:** `npm run build` bricht bei einem Typfehler
  (`noUnusedLocals`) ab und lässt das alte `dist/` stehen; das Auswertungsskript muss den Rückgabewert prüfen und
  „failed" aus der Playwright-Ausgabe lesen (die letzte Zeile ist „N passed", auch bei Fehlschlägen). Beim Schreiben der
  Datei zuerst den neuen Inhalt berechnen, dann öffnen (`open(p, 'w')` leert die Datei vor dem Lesen).
- **C5 – Beobachtete Abfragen:** `invalidateQueries` lädt nur Abfragen mit Beobachter neu; Hook-Tests brauchen den
  `useTermin` daneben. Eine Mutation endet erst, wenn die im Hook zurückgegebene Invalidierung fertig ist.
- **C5 – MSW:** der erste passende Handler gewinnt, `mockServer.use()` stellt voran (der spätere Aufruf gewinnt);
  `onUnhandledRequest: 'error'` macht fehlende Handler sichtbar (Beispiel: 409 in `httpService.test.ts`).
- **C5 – Uhr im Render** ist unter `react-hooks` v7 ein Lintfehler; Uhrzeit in `select`/`queryFn`/Takt-Hook. Tests mit
  Datum relativ zu heute bauen (Verlauf liest nur 60 Tage, feste Daten fielen heraus).
- **C5 – Aktionsleiste und Dialog:** Die Leiste muss das letzte Kind der Seite sein; ein geschlossener `<dialog>` gehört in
  ihren Behälter. `aria-disabled` hält den Fokus; Playwright braucht dafür `click({ force: true })`.
- **C5 – E2E-Nachbildung ohne Termin-Route** leitet `GET /termine/:id/lesen` an den Vorschau-Server (liefert HTML):
  Tests auf `teams/:id` oder `ergebnisse/:id` brauchen `termineNachbilden` (so brach `layout.spec.ts` nach C5).

### 6.4 Bewusst offen
- Zielangabe mit Parameter (`teams/:terminId`, `ergebnisse/:terminId` → Termin) kennt `RoutenAngaben` noch nicht; „Zurück“ geht dort einen Schritt im Verlauf, beim Direkteinstieg zur Startseite (C5).
- „nicht gefunden" liest beim Direkteinstieg keine Sitzung; der Offline-Hinweis erscheint dort erst mit
  dem ersten Aufruf oder dem Ereignis `offline`.
- **C4:** `PasswortFeld` begrenzt auf 72 Zeichen (`maxLength`); ein längeres Passwort wird beim Einfügen
  still gekürzt, die Regel „höchstens 72" ist deshalb nie sichtbar. Folgt dem Vertrag (BCrypt kürzt sonst
  ebenfalls still), ist aber ein Randfall für Passwortmanager.
- **C4:** Läuft die `PIN_VERIFIED`-Sitzung beim Warten auf die Reset-E-Mail ab, ist der `navigate`-Zustand
  weg, der Vorgang auf dem Server aber noch gültig: Weg PIN → Name → „Als Admin anmelden" → „Passwort
  vergessen?" → „Ich habe bereits eine PIN" (Umsetzungsanleitung 7.3).
- **C4:** Namensänderung des Admins (`/admin/name/aendern` → `202`, `/admin/name/bestaetigen`) ist im
  Datenzugriff noch nicht angebunden; gehört zu C7.
- **C4:** Verhalten auf iOS (`one-time-code`, Passwortmanager, Kleinschreibung am Namen) nur per
  Handprüfung.
- Dialog-E2E (Fokusfalle, Escape) ist mit dem Ablauf-Dialog da (WebKit im CI, Tab-Teil dort ohne
  Systemeinstellung übersprungen).
- **Leerlauf-Fenster ≤ 2 Minuten (Admin-Konfiguration erlaubt ab 1):** Der Dialog erschiene nach jedem
  Verlängern sofort wieder. Vorschlag: Mindestwert im Server anheben (z. B. 5 Minuten) oder die Warnzeit
  als Anteil des Fensters führen.
- **Die Geräteuhr bestimmt, wann der Dialog erscheint** (der Server gibt nur Zeitpunkte, keine „jetzt"-Angabe).
  Abgemeldet wird nur auf Anweisung des Servers. Verbesserung möglich über den `Date`-Header der Antwort.
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

- **C5 – 60 statt 90 Tage:** Die Umsetzungsanleitung nennt an einer Stelle (10.4) „letzten 90 Tage"; E14 und der Code
  (`VERLAUF_TAGE`) sagen 60. Der Satz im UI nimmt die Konstante. Anleitung bei Gelegenheit angleichen.
- **C5 – Kontingent der Teamgenerierung** ist nur über `409 KONTINGENT_ERSCHOEPFT` erkennbar; es gibt keine Anzeige
  „noch n Läufe" (Server-Track, 1.4 der Anleitung).
- **C5 – Hinweistext bei Rückmeldung `false → true`** (Zusage nach vorheriger Absage, Platz in der Reihenfolge) ist offen:
  erst nach der Handprüfung festlegen. Ebenso Reihenfolge der Teilnehmerliste nach Absage und Zusage.
- **C5 – DESIGN.md (1.3 der Anleitung)** ist dem Entwickler zur Übernahme vorzulegen: Tab-Leiste (vier Links, kein
  ARIA-Tab), Symbol `person_edit_dark` für den Auswechselspieler (vorläufige Wahl), Überschriftenfolge h1/h2/h3.
  Verlauf und Ergebnisse haben keine eigene Ansicht in DESIGN.md.
- **C5 – `useErgebnisErfassen` und `useTeamsGenerieren`** lesen den Termin auch nach `404` neu (kleine Erweiterung
  gegenüber der Vorgabe: Bei einem entfernten Termin verschwindet sonst der Stand nicht).
- **C5 – Ergebnis-Korrektur (Admin)** ist im Datenzugriff (`ergebnisKorrigieren`) und im Mock vorhanden, die Ansicht folgt in C7.

## 7. Nächste Schritte
1. **Review und Commit von C5 durch den Entwickler** (nichts ist committet; `git --no-optional-locks diff` zeigt den
   Umfang). Danach **Push von `dev_client`** und der erste CI-Lauf mit WebKit (Layout-Fälle der neuen Specs bei kleinen
   Fenstern beobachten).
2. **Handprüfung C5 gegen eine laufende Serverinstanz** (Abschnitt 6.2 „Nicht geprüft"; Anleitung 12): Zusage/Absage und
   Reihenfolge, Teams generieren (Kontingent, Ersetzen, `veraltet`, Beginn), Termin 10 Minuten in der Zukunft anlegen und
   30–35 Minuten nach Beginn Ergebnis erfassen (zwei Geräte gleichzeitig → Hinweis), Bilanz für Spieler und Gast notieren,
   Verlauf, iPhone. Danach den offenen Hinweistext für `false → true` festlegen.
3. **C4 abnehmen** (Handprüfung, iPhone, Passwortmanager) – Abschnitt 6.2.
4. **C7 beginnen** (Admin-Verwaltung und Admin-Dashboard); dort auch die Ergebnis-Korrektur und die Namensänderung des
   Admins (`/admin/name/aendern` → `202`, `/admin/name/bestaetigen`).
5. **C2-Restabnahme:** Zoom 200 % bei 360 px, echtes Telefon im Sonnenlicht (auch Safari/iOS), CI-Lauf mit WebKit.
6. **Server-Track:** Vertragslücke freie Gastplätze (Abschnitt 4); Verhalten von `GET /bilanz/lesen` für Gäste klären;
   Kontingent der Teamgenerierung in der Antwort anbieten.
7. **Betrieb:** Custom Domain `app.<domain>`, Rocket Loader und Auto-Minify aus, `FUBO_INITIAL_PIN` vierstellig.
8. **Aufräumen:** Die Archivdatei `PRJ_FuBo/_zu_loeschen/e2e-kopie.tgz` (Hilfsarchiv für die Cloud-E2E-Läufe) kann gelöscht
   werden; die Agentenumgebung darf es ohne Freigabe nicht.

## 8. Weitere Anweisungen
- Repo-Wurzel `client/`, Branches `dev_xxx`; nichts nach `main` ohne ausdrückliche Anweisung.
- Getrennte Repositories: Vertragsänderungen zuerst in `server/fubo-api.json`, dann Kopie gegen den
  Unterschied auffrischen, Typen und Mocks nachziehen.
- `.env` nie einchecken; keine realen Personennamen in Code, Tests oder Doku.
- Nach jedem Paket: visuelle Prüfung, dieser Handoff (Vorfassung ins Archiv), `AGENT_CLIENT.md` und
  `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` nachziehen. Über 500 Zeilen: kürzen.
