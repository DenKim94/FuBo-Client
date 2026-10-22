# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand).
> Systemprompt und verbindliche Regeln: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.
>
> Repository: **eigenständig mit Wurzel in `client/`** (GitHub, öffentlich, `FuBo-Client`), Branch `dev_client`. **Kein Monorepo**; das Backend
> liegt in `FuBo-Server`. `PRJ_FuBo/`, `PRJ_FuBo/harness/` und `client/harness/tmp/` sind nicht versioniert.
> **Stand: 18.10.2026.** C0, C1, C3 abgeschlossen; C2, C4, C5 und **C7** umgesetzt (C6 ist in C5 aufgegangen). **C5 ist committet (`e9a85e6`), C7 ebenfalls (`3a7c8c6`, Stand `git log` vom 18.10.2026); die
> Design-Überarbeitung der Admin-Ansichten ist umgesetzt und nicht committet** (Commit auf Aufforderung). Unit-Tests, Lint, Typen, Bau und E2E in Chromium grün; offen: Handprüfung gegen den echten Server
> (C5, C7), iPhone; **WebKit-Projekte seit 18.10.2026 abgeschaltet** (siehe 5.4); Verifikation 5.2, nächste Schritte 6.
> Nächster Meilenstein: **C8** (Admin-Verwaltung, Teil 2: Konfiguration, Gastplätze, Gast-Stufe, Halle, Ergebniskorrektur, manuelle Teams, **21,5 h**); die Anleitung
> `harness/tmp/C8_UMSETZUNG.md` liegt vor. PWA/Push heisst **C9**, Abnahme/Deployment **C10**. Die Entscheidungen E1–E22 von C7 wurden als bestätigt behandelt (2.).
> **Komprimierte Fassung vom 18.10.2026, ergänzt am selben Tag um die Design-Überarbeitung der Admin-Ansichten (Profile, Termine; 2. und 5.).** Die Vorfassung (Stand vor dieser Überarbeitung) liegt in `archive/CONTEXT_HANDOFF_CLIENT_2026-10-18d.md`,
> die von vor C7 in `archive/CONTEXT_HANDOFF_CLIENT_2026-10-18c.md`, ältere
> Fassungen ebenfalls in `archive/` (zuletzt `…-10-17c.md` vor C5, `…-10-17.md` vor C4, `…-10-04c.md` vor Abschluss C3).

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
- **E1:** Nach der Admin-Anmeldung `/admin` (in C4 ein Platzhalter mit Link `admin-passwort-aendern-link`, seit C7 das Dashboard, Link `admin-link-passwort`); `zielFuerStufe` kennt `istAdmin`.
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

**Admin-Verwaltung, Teil 1 (C7, 18.10.2026; E1–E22 als bestätigt behandelt)** – Anleitung `harness/tmp/C7_UMSETZUNG.md`; drei Stufen, je grün:
- **Ein Hub, keine Tab-Leiste (E1/E2):** `/admin` ist das Dashboard (Teilnehmerübersicht des nächsten Termins **lesend** über `TerminAnsicht nurLesen`: kein Zusagestatus, keine Leiste, keine Verweise
  auf Teams/Ergebnisse) plus `Verwaltungsliste`. „Zurück" führt immer auf einen festen Pfad (`handle.zurueck`: `/admin`, `/admin/profile`, `/admin/termine`); Pfade nur in `ADMIN_PFADE`.
  Bis C8 führen „Gastplätze", „Konfiguration" und „Teams ohne Termin" auf Platzhalter.
- **Ordnung (E3):** Admin-Hooks in `src/hooks/admin/`, API-Dateien nach Thema (`adminProfile.ts`, `adminTermine.ts`, `skills.ts`, `terminEingabe.ts`; `admin.ts` für Zugangsdaten), Seiten flach `src/pages/Admin…`.
- **Lesen (E4):** Admin-Abfragen ohne Polling, ohne `X-FuBo-Kein-Refresh`, `refetchOnWindowFocus: false`. Ausnahmen: Dashboard und Terminliste mit `useTermine`/`useVerlauf`; die Verwaltungsansicht
  `useTermin(terminId, 0)` (Kopf, **kein** Polling; `TerminAnsicht` hat dafür `ohneAktualisierung`). Schreibende Admin-Aufrufe tragen keinen Kopf.
- **`DATEN_VERALTET` (E5):** Das Formular setzt auf den frisch gelesenen Stand zurück (`key={termin.version}`), der Text sagt es, **nie** mit neuer `version` und alten Eingaben senden. Die Mutation liegt im
  Elternbaustein (`TerminVerwaltung`), damit Meldung, „Gespeichert." und Fokus den Neuaufbau überleben.
- **Zentrale PIN (E19):** vier Stellen, Dialog **vor** dem Senden (alle Angemeldeten werden abgemeldet), nach `204` räumt der Client auf (`sitzungsendeAusloesen` mit Hinweis).
  **Anmeldename (E20):** zwei Ansichten (`/admin/name/aendern`, `/admin/name/bestaetigen`), 5-stellige PIN, Link „Ich habe bereits eine PIN", fester Satz statt Restzeit; `NAME_PIN_FALSCH` beendet die Sitzung **nicht**,
  nach Erfolg bleibt sie, Hinweis „gilt ab der nächsten Anmeldung". Ein `400 felder.neuePin` schliesst den PIN-Dialog und zeigt den Text am Feld.
- **Profile (E6–E8):** Skillfelder aus `GET /admin/skills/lesen` (nichts fest verdrahtet; Anlegen mit gerundeter Mitte **sichtbar** vorbelegt, alle Kategorien im Körper; Bearbeiten nur Geändertes); unvollständige
  Karte in der Liste gekennzeichnet; **Skillwerte nur in `AdminProfilDetail` und `AdminProfilFormular`**, nie in Liste oder Spieleransichten. Sperren ohne Dialog, ausser das Profil ist `belegt`; Entfernen immer mit Dialog,
  `PROFIL_IN_VERWENDUNG` ⇒ „Stattdessen sperren"; Adminprofil ohne Formular und Aktionen. Das Profilformular nutzt „Zustand beim Rendern anpassen" statt `key`.
- **Termine (E9–E12):** Liste mit zwei unabhängigen Abschnitten („Kommende" `useTermine`, „Vergangene" `useVerlauf`), die kommende Liste gegen den Verlauf entdoppelt (Uhr einmal beim Einhängen gelesen).
  Anlegen in einem Formular mit Umschalter Einzeltermin/Serie (seit der Design-Überarbeitung `Segmente`, technisch weiter eine Radiogruppe); Serie: Dialog „nicht mehr änderbar", Wochentag ohne Vorauswahl, `SerieErgebnis` mit angelegter Zahl und Übersprungenen (der Absatz zu den
  Übersprungenen steht immer da); `TERMIN_BELEGT` mit festem UI-Text am Uhrzeitfeld. Ändern diffbasiert (`aenderungKoerper`; `""` leert den Ort), Speichern erst bei einer Änderung. Absagen (`/admin/termin/absagen`, ohne
  `version`) und Abschliessen (`aendern` mit `status`) mit Dialog und Folgen; Entfernen nur für `GEPLANT`/`ABGESAGT`, `TERMIN_IN_VERWENDUNG` ⇒ Hinweis und „Stattdessen absagen" (nur bei `GEPLANT`). Nach einem Statuswechsel
  liegt der Fokus auf der Überschrift der Karte. Eine Serie lässt sich nach dem Anlegen nicht mehr ändern, ihre Termine einzeln schon.
- **Verschoben nach C8:** Skill-Stufe eines Gastes, Konfiguration, Gastverwaltung, Hallenabsage, Ergebniskorrektur, manuelle Teamgenerierung (E13–E18). **Push-Probeversand** → C9 (E21). **Meilensteinplan** (E22): C7 27,5 h, C8 21,5 h.
- **Abweichungen von der Anleitung (zur Kenntnis):** Alias `admin-passwort-aendern-link` durch `admin-link-passwort` ersetzt; Tippfehler „Ruckmeldung" → „Rückmeldung" und Anpassung von 6 Unit- und 4 E2E-Erwartungen
  an die Textänderungen des Entwicklers; „Gespeichert." und die Fokusrückgabe liegen im Elternbaustein; Status „Geplant" mit `info_circle_icon`; `refetchOnWindowFocus` für `useTermin` ist **nicht** abgeschaltet
  (ein neuer Stand beim Zurückkehren baut das Formular neu auf, E5); der Konflikt in den E2E-Tests entsteht über den Helfer `fremdeAenderung` statt über eine zweite Seite (der Zustand liegt im Testprozess, das Ergebnis
  ist gleich); Aktionen ohne Wirkung sind `aria-disabled` mit Grund statt `disabled`. **DESIGN.md (Abweichungen aus 1.3 der Anleitung) ist dem Entwickler zur Übernahme vorzulegen** (nicht im Repository).

**Design-Überarbeitung der Admin-Ansichten (18.10.2026, Auftrag des Entwicklers, Vorlage `FuBo_Design_Prototypen.html`; Bildschirme 09b/09c, 10, 10b/10c)** – bestehende Logik und Anforderungen blieben (Skala aus `GET /admin/skills/lesen`, nur Geändertes senden, Dialoge, Test-IDs der Logik):
1. **Terminverwaltung:** „Termin abschliessen/absagen/entfernen“ sind gleich breit (`Knopfgruppe untereinander`).
2. **Profile in drei Ansichten:** Liste → **Profilansicht** `/admin/profile/:id` (neu, `AdminProfilDetail`: Name, Spielzahl, Kennzeichen, **Netzdiagramm**, Werte als Balken mit Zahl, „Skills bearbeiten“) → **Formular** `/admin/profile/:id/bearbeiten` (Name,
   Skills als **Segmente** 0 bis N, Schalter „Aktiv in der Auswahlliste“, „Profil entfernen“). Listenzeilen führen zur Ansicht. Speichern führt zur Ansicht mit „Gespeichert.“, „Abbrechen“ ohne Senden dorthin; „Zurück“ im Formular führt
   zur Ansicht desselben Profils (`handle.zurueck` kann jetzt eine **Funktion der Routenparameter** sein). `ProfilLader` hält Laden/Fehler/„nicht gefunden“/Adminprofil für Ansicht und Formular an einer Stelle. Neu: `ADMIN_PFADE.profilDetail`,
   `profilBearbeiten` hängt `/bearbeiten` an.
3. **Termine:** Terminliste als **Karten** (Datum und Uhrzeit, Marke „Serie“/„Einzeltermin“, Ort, Status mit Zusagen, „Bearbeiten“ (bei Abgesagt/Abgeschlossen „Öffnen“) und „Entfernen“ nebeneinander gleich breit; „Entfernen“ nur bei `GEPLANT`/`ABGESAGT`,
   mit `Bestaetigung` in der Liste, Hinweise `admin-termine-entfernt/-verschwunden/-in-verwendung`, Fokus danach auf der Überschrift). „Termin anlegen“ unten. **„Neuer Termin“:** Umschalter Einzeltermin/Serie als `Segmente`, Serie mit Wochentag-
   Chips Mo–So, Start- und Enddatum nebeneinander, Uhrzeit und Ort (optional) nebeneinander (`Feldzeile`), unten „Abbrechen“ und „Termin anlegen“/„Serie anlegen“; beim Einzeltermin Datum und Uhrzeit nebeneinander.
- **Entscheidungen und Begründungen:**
  - **Primärfarbe bleibt das Grün der App**, nicht das Blau des Prototyps (die App-Tokens gelten; keine neuen Farben, nur Variablen).
  - **Der Schalter wirkt sofort** (eigener Endpunkt `blockieren`) und gehört nicht zum Speichern; ein Satz unter dem Schalter sagt es. Ein angemeldetes Profil verlangt beim Sperren weiter die Bestätigung.
  - **Segmente statt Zahlenfeld** für die Skills: Ungültige Werte lassen sich nicht mehr eingeben; „Noch nicht bewertet“ (Lücke in der Karte) bleibt ohne gewählte Stufe und wird nur mit Wert gesendet. Die Skala ist ein Datenwert (jede Kategorie hat ihre Grenzen,
    Torwart 0–3 hat vier Stufen); (bis 19.10.2026) der Kopf der Ansicht nennt die Skala samt jeder Kategorie mit eigenem Bereich: „Skalierung 0–6 (Torwart 0–3)“ (`skalaText`: häufigster Bereich als Skala, bei Gleichstand der erste; Entscheidung des Entwicklers vom 18.10.2026). **Alle Balken und Stufenreihen sind gleich breit**; die Füllung ist der Anteil am eigenen Bereich (E2E prüft Breite und Lage).
  - **Gleich breite Schaltflächen über ein Raster** (`grid-auto-columns: minmax(0, 1fr)`): Der Browsertest zeigte bei `flex: 1` 3,75 px Unterschied (Rand und Innenabstand verschieden).
  - **Wiederverwendung statt Nachbau:** `ProfilKennzeichen` (Liste und Ansicht, gleiche Test-IDs), `ProfilLader`, `Segmente` (Art, Wochentag, Skills), `Feldzeile`; `CustomButton` neu `art="gefahrUmriss"`.
- **Abweichungen vom Prototyp (zur Kenntnis):** kein Link „Netzdiagramm ›“ in der Bearbeiten-Ansicht (die Ansicht ist eine Route davor); der **Serien-Titel bleibt** (Pflichtfeld des Servers, der Prototyp zeigt keinen); die Serienmarke zeigt **kein „bis <Datum>“**
  (die Termine tragen nur `serieId`, das Enddatum fehlt in den Daten); die Spielzahl im Kopf der Ansicht ist aus vorhandenen Daten berechnet (kein neuer Abruf); das Netzdiagramm hat **fünf bis n Achsen aus den Kategorien**, nicht fest fünf.
  **Bekannt:** Bei 320 px sind sieben Segmente schmaler als 44 px (bei 360 px mindestens 44 px, vom E2E in allen Läufen geprüft); eine Fehlermeldung in einer halben Spalte stapelt die Zeile (`gestapelt`), statt in kurze Zeilen umzubrechen.
- **DESIGN.md:** Die Abweichungen sind dem Entwickler zur Übernahme vorzulegen (Dokument nicht im Repository).

**Nachträge vom 18.10.2026 (Abend, Auftrag des Entwicklers):**
1. **Skillstufen mit seitlichem Abstand:** Die Stufenreihen halten in der Karte 8 px Abstand zum Rand (`--segmente-einzug` gilt jetzt für die ganze Gruppe, auch die Reihe). Damit sieben Stufen bei 360 px trotzdem 44 px breit bleiben, **gehört die Lücke zum Tap-Ziel**: Jedes Segment trägt 1 px Innenabstand je Seite, die Reihe gleicht das mit −1 px aus (Rechnung in `Segmente.module.scss`: 44,6 px Tap-Ziel, 42,6 px sichtbar). E2E prüft Abstand und Breite.
2. **Durchschnitt „Ø“ im Skills-Kopf entfernt** (auf Wunsch); `durchschnittText` samt Tests entfallen.
3. **Alle nebeneinander oder untereinander liegenden Schaltflächen sind gleich breit.** Grundlage ist `Knopfgruppe` (Raster mit `minmax(0, 1fr)`, `untereinander` für Spalten; angelegt in einer parallelen Sitzung, übernommen). Die Aufrufer-Klassen an der Gruppe tragen nur noch Abstand (kein `display`, das mit dem Raster der Gruppe konkurrierte); die Verhältnisse 1 : 1,4 aus dem Prototyp (`.knoepfe`) sind entfallen. **`Aktionsleiste` ist selbst ein solches Raster**: Zwei Schaltflächen direkt darin (Zusagen/Absagen) sind gleich breit. **Ausnahme:** „Zurück“ und „Abmelden“ in der Kopfzeile sind keine Gruppe (sie stehen an den gegenüberliegenden Enden) und bleiben inhaltsbreit.
4. **Service Worker unter `npm run dev` nur auf Wunsch:** `npm run dev:pwa` (setzt `PWA_DEV=1`). Gemessen verlängerte der Worker jedes Neuladen im Dev-Modus um 60–90 % (sein `fetch`-Listener liegt vor jeder der ~240 Modulanfragen). E2E läuft gegen `vite preview` und ist nicht betroffen. Ein schon registrierter Worker bleibt im Browser, bis er unter „Application → Service Workers“ entfernt wird.
5. **Admin-Bereich als Lazy Routes:** Alle Admin-Seiten (einschliesslich Admin-Anmeldung und Passwortschritte) stehen in `src/app/adminSeiten.ts` und werden über `adminSeite((s) => <s.Seite />)` in `routen.tsx` **als ein gemeinsames Paket** nachgeladen (ein Abruf beim Betreten, danach jeder Wechsel im Bereich ohne Nachladen). Beim Direktaufruf zeigt die Wurzel `StartLader` (gleicher Kreis wie `index.html`, `hydrateFallbackElement`). Hauptpaket **534 → 425 kB** (gzip 168 → 135 kB), Admin-Paket 110 kB (gzip 34 kB); die Vite-Warnung zur Paketgröße entfällt. **Kein Schutz:** Der Code wird vor `AdminRoute` geladen, enthält aber keine Daten. Der Service Worker legt das Admin-Paket weiter in den Precache (im Hintergrund, nicht beim Seitenaufbau). `routen.test.tsx` prüft, dass `routen.tsx` keine Admin-Seite fest importiert; `e2e/nachladen.spec.ts` prüft, dass ein Spieler das Paket nie anfordert und der Admin es genau einmal lädt.

**Designanpassungen vom 19.10.2026 (vom Entwickler selbst vorgenommen, Tests und Rahmen nachgezogen):**
1. **Profilansicht ohne Skala im Kopf** (nur noch die Spielzahl); `skalaText` samt Tests entfallen. **Skillstufen ohne Zahl in der Legende** (nur der Name; der Wert ist das gefüllte Segment und für Screenreader die gewählte Option). In der Profilliste stehen Name und Kennzeichen in einer Zeile (`name-mit-status-<id>`).
2. **Texte:** Hinweis „in Verwendung“, Entfernen-Dialog, Erklärung zum Schalter und der Satz zur Verschiebung („setzt die Einteilung der Teams zurück“) neu formuliert; der Satz über dem Entfernen-Knopf ist entfallen. Wortstellung im Hinweis korrigiert („lässt sich daher nicht entfernen“).
3. **Farbige Schaltflächen:** „Bearbeiten“/„Öffnen“ in der Terminkarte und „Termin abschließen“ (Knopf **und** Bestätigung im Dialog) sind blau: neue Art **`akzent`** im `CustomButton` (`--farbe-link`, weisse Schrift 6,76:1, Hover/Active wie `gefahr` abgedunkelt). „Entfernen“ in der Terminkarte ist `gefahr` (gefüllt rot). Die zunächst gesetzten Inline-Styles sind dadurch entfallen; sie hätten Hover-, Lade- und Sperrzustand überdeckt. `Bestaetigung` kennt `art="akzent"` und **`fokusAufAbbrechen`** (Vorgabe: nur bei `gefahr`): „Termin abschließen“ ist blau, aber endgültig, der Fokus beginnt deshalb auf „Abbrechen“. `gefahrUmriss` nutzt nur noch „Profil entfernen“.
4. **Aktionsleiste:** seitlicher Innenabstand `--abstand-s` statt `--abstand-m`.
5. **Umrandungen klarer:** Alle ganzen Rahmen von Karten, Listen und Hinweisen nutzen `--farbe-rand-bedienbar` (4,33:1) statt `--farbe-rand` (1,38:1). **Bewusst unverändert:** Kennzeichen/Marken (`ProfilKennzeichen`, Marke „Serie“/„Einzeltermin“; ein dunkler Rand liesse sie wie Schaltflächen wirken), Trennlinien innerhalb von Karten und Listen, die Kopfzeile, die Tab-Leiste, der Rand gesperrter Schaltflächen und das Gitter des Netzdiagramms. `src/styles/rahmen.test.ts` schlägt fehl, wenn ein ganzer Rahmen wieder `--farbe-rand` nutzt.
6. **Texte PIN (19.10.2026, Entwickler):** `AdminPin`: Einleitung „Die PIN wird zentral geändert. Dies wird alle laufenden Sitzungen beenden.“, Feldhinweis „Bitte gib vier Ziffern ein.“; der sichtbare Grund über dem Knopf entfiel. Damit `aria-describedby` des gesperrten Knopfs nicht ins Leere zeigt, steht derselbe Satz dort **nur für den Screenreader** (`admin-pin-grund`, `nurFuerScreenreader`). `PinEingabe`: Hinweis „Die PIN erhältst du vom Admin.“. Tests angepasst. Angeglichen: Dialog „Zentrale PIN ändern?“ ohne „über deinen Weg“ („Teile die neue PIN vorher oder direkt danach mit.“), Entfernen-Dialog der Terminliste wie in der Terminverwaltung nur „Das lässt sich nicht rückgängig machen.“.
7. **Pfeil in der Teilnehmerliste:** rechts in der Zusammenfassung „Teilnehmer (n)“ ein Winkel aus zwei Rahmenkanten (zu: nach unten, offen: nach oben, 150 ms Drehung, ohne Bewegung bei `prefers-reduced-motion`), **nur wenn es Zusagen gibt**; schmückend (`aria-hidden`), den Zustand meldet `<details>`. Das eingebaute Dreieck ist ausgeblendet (`list-style: none`, `::-webkit-details-marker`). Ohne Zusagen lässt sich die Liste weiterhin aufklappen (zeigt den Leerzustand), nur ohne Pfeil. Test-ID `teilnehmerliste-pfeil`; E2E prüft Lage und Drehung.
8. **Vorbelegung beim Anlegen (22.10.2026):** Torwart startet bei **0**, alle anderen Kategorien bei der Mitte der Skala. Die Abweichung steht als Tabelle in `src/api/admin/skillVorgaben.ts` (`SKILL_VORGABEN`, die eine Stelle, an der der Client einen Schlüssel kennt); `vorgabe(kategorie, abweichungen)` in `skills.ts` nimmt sie entgegen und fällt auf die Mitte zurück, wenn der Wert nicht im Bereich des Servers liegt. Liefert der Server eines Tages Vorgabewerte, entfällt die Tabelle.
9. **Team-Generator nur für Teilnehmer (22.10.2026, Vorgabe des Entwicklers; Vertrag vom 22.10.2026 übernommen):** Die Aktion „Teams generieren“ ist gesperrt (`aria-disabled`, Grund „Nur Teilnehmer des Termins dürfen den Team-Generator nutzen.“), wenn die eigene Sitzung nicht zugesagt hat, abgesagt hat **oder auf der Warteschlange steht**; dieser Grund geht Mindestzahl und Kontingent vor. **Der Admin darf immer** (wie der Server). Grundlage `istAdmin || spieltMit(termin, name, gast)` (`src/api/termine/teilnahme.ts`: `eigeneRueckmeldung` und `wartet` des eigenen Eintrags, gefunden über Name **und** Gast-Kennzeichen); Prop `berechtigt` der `TeamsLeiste`. **Bewusste Abweichung vom Server:** Er lässt die Warteschlange zu, der Client nicht (Entscheidung des Entwicklers vom 22.10.2026). Der Satz „Du kannst die Teams neu generieren“ erscheint nur für Berechtigte.
10. **Vertrag vom 22.10.2026 (`server/fubo-api.json` → `harness/assets/fubo-api.json`, Typen neu erzeugt):** `POST /teams/generieren` antwortet ohne Zusage (und nicht Admin) mit **`403 KEINE_ZUSAGE`**, geprüft **vor** dem Status; neuer `Fehlercode` `KEINE_ZUSAGE`. `useTeamsGenerieren` liest nach `403 KEINE_ZUSAGE` neu (die zurückgenommene Zusage sperrt dann die Aktion), die Meldung des Servers steht über der Leiste. **Kontingent hängt nicht mehr an der `teilnehmerVersion`**, sondern an einem unsichtbaren Kontingentstand, der nur bei neuen Zusagen, Skillwert- und Gast-Stufen-Änderungen steigt: Eine Absage öffnet es nicht. Grund-Text jetzt „… Eine neue Zusage setzt es zurück.“; der Merker der Seite bleibt an der `teilnehmerVersion` (nach einer Absage gibt sie frei, der nächste Tipp meldet erneut `KONTINGENT_ERSCHOEPFT`, ohne zu verbrauchen). Mocks (`src/test/mocks/termine.ts`, `e2e/hilfen/teams.ts`) bilden `403` (`adminSitzung`) und `kontingentVersion` nach. Übrige Änderungen (Beschreibungen zu `gast-stufe` und `teilnehmerVersion`) ohne Folgen für den Client.

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
| C7 | Admin-Verwaltung und Admin-Dashboard, Teil 1 (Rahmen, Zugang, Profile, Termine) | **27,5** (Plan bisher 20, ursprünglich 49 für C7 gesamt) | **umgesetzt und committet** (`3a7c8c6`, 18.10., drei Stufen grün); danach Design-Überarbeitung (2.), **nicht committet**; offen Handprüfung 12.3–12.12 der Anleitung, Sichtprüfung 360 px mit Tastatur |
| C8 | Admin-Verwaltung, Teil 2 (Konfiguration, Gastplätze, Gast-Stufe, Halle, Ergebniskorrektur, manuelle Teams); am 18.10.2026 aus C7 ausgelagert | **21,5** | Anleitung `harness/tmp/C8_UMSETZUNG.md` liegt vor; C7 ist die Voraussetzung und steht; Umsetzung offen |
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
  der Platzhalter dient nur noch `/einstellungen` und den C8-Einträgen `/admin/gaeste`, `/admin/konfiguration`, `/admin/teams`.
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
- **C7 – Datenzugriff:** `src/api/admin/` (`admin.ts` Zugang; `adminProfile.ts`: lesen, anlegen, bearbeiten, blockieren, entfernen; `skills.ts`: `mitte`, `skillZahl`, `skillsVollstaendig`, `skillsAenderung`,
  `profilAenderung`; `adminTermine.ts`: `terminAnlegen`, `serieAnlegen`, `terminAendern`, `terminAbsagen`, `terminEntfernen`; `terminEingabe.ts`: Grenzen, `anlegenKoerper`, `aenderungKoerper`, `serieKoerper`, `serieFehler`,
  `liegtInVergangenheit`, `alsSerie`); `terminZeit.ts` neu `datumListe`; Schlüssel `adminProfile`, `adminSkills`. **Hooks** in `src/hooks/admin/`: `usePinAendern`, `useNameAnfordern`, `useNameBestaetigen`, `useProfile`,
  `useSkillKategorien`, `useProfilAnlegen/-Bearbeiten/-Blockieren/-Entfernen`, `useTerminAnlegen/-Aendern/-Absagen/-Entfernen`, `useSerieAnlegen`, `termineNeuLesen` (Gruppe `termine`, `terminAlle`, `termineVerlauf`, als
  Versprechen zurückgegeben); dazu `useSpielerParameter`. **Seiten:** `AdminDashboard`, `AdminPin`, `AdminNameAendern`, `AdminNameBestaetigen`, `AdminProfile`, `AdminProfilDetail` (neu), `AdminProfilFormular` (mit `ProfilStatus`),
  `AdminTermine`, `AdminTerminNeu` (mit `SerieFelder`), `AdminTerminDetail` (mit `TerminVerwaltung`, `TerminAendernFormular`, `WeitereAktionen`). **Bausteine:** `Bestaetigung`, `Verwaltungsliste`, `SkillFelder`, `ProfilListe`/`ProfilZeile`,
  `TerminFormular`, `AdminTerminZeile`, `SerieErgebnis`; **neu mit der Design-Überarbeitung:** `Segmente`, `Schalter`, `Feldzeile`, `Netzdiagramm` (mit `netzdiagrammGeometrie.ts`: Geometrie), `ProfilKennzeichen`, `ProfilLader`, `Knopfgruppe`, `StartLader`, `app/adminSeiten.ts`, `CustomButton` mit `gefahrUmriss`; `TerminAnsicht` neu `nurLesen`, `ohneAktualisierung`, `ueberschriftRef`; `TerminKarte` neu `ueberschriftRef`.
- **Test-Stub und Mocks:** `src/test/setup.ts` (jsdom-`<dialog>`); `src/test/mocks/termine.ts` (zustandsbehafteter Server `terminHandlers()`, `terminModell`, `teamsAus`,
  `beispielErgebnis`, `beispielBilanz`; `TerminModell` mit `version`, `serieId`), `problem.ts`, **`admin.ts`** (zustandsbehaftet: `adminWelt()`, `adminHandler()`, `protokoll`, `fremdeAenderung()`, `terminInVerwendung`);
  E2E-Nachbildungen `e2e/hilfen/{sitzung,termine,teams,ergebnisse,admin}.ts` (`adminNachbilden`, `terminverwaltungNachbilden`, `beispielProfile`).
- **PWA:** Manifest, eigener Worker, `_headers`/`_redirects` nach den Cloudflare-Auflagen.
- **Tests (Stand 19.10.2026, nach den Designanpassungen):** **1115 Unit-Tests in 122 Dateien** (Skala- und Durchschnittstests entfallen, neu `rahmen.test.ts`, der Pfeil der Teilnehmerliste und `akzent`); E2E **483 Läufe in 3 Chromium-Projekten** (Vollauf 480 bestanden, 3 übersprungen). Stand 18.10.2026 (Abend): 1096 Unit-Tests, neu `nachladen.spec.ts`. Davor (Design-Überarbeitung): 1093 Unit-Tests, 477 E2E-Läufe. Stand nach C7 (davor): 975 Unit-Tests in 111 Dateien, 453 E2E-Läufe (450 bestanden, 3 übersprungen), neu `admin-dashboard`, `admin-zugang`, `admin-profile`, `admin-termine`, `admin-layout`. Früherer Stand (C5): 638 Unit-Tests in 83 Dateien; E2E u. a. `admin.spec.ts` (16 Fälle), `layout.spec.ts`, `sitzung-ablauf.spec.ts` (15 Fälle), `namensauswahl.spec.ts`,
  `pwa.spec.ts` (nur Chromium), `termine`, `tabs`, `teams`, `ergebnisse`, `verlauf`. CI: Job `pruefen` (Lint, Typen, Bau, Unit) und Job `e2e` (**nur Chromium, 3 Projekte, 483 Läufe**; die vier WebKit-Projekte sind seit 18.10.2026 abgeschaltet, 5.4).

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
- **C7 (18.10.2026), je Stufe grün:** `lint` (inkl. `e2e/`), `typecheck --force`, **975 Unit-Tests** (Seiten 285, Hooks/API/App 395, Bausteine/Layouts 295), Bau, ein `fetch(` (`httpService.ts`), kein Hexwert ausserhalb der
  Tokendatei, keine verwaisten `/admin`-Pfade im Code, Skillwerte nur in Profilformular, `adminProfile.ts`, `skills.ts`, Profilliste (nur „unvollständig"-Kennzeichen) und Mocks, **keine** in Spieleransichten;
  **E2E-Vollauf 447 bestanden, 3 übersprungen** (Cloud-Kopie, 3 Chromium-Projekte; gutartige ECONNREFUSED-Proxyzeilen von nicht nachgebildeten Aufrufen), danach die Layout-Schleife `admin-layout.spec.ts` (alle Admin-Pfade bei 360 × 780, 3 Läufe) einzeln grün. **Gegenproben** (Skript `test-results/gegenproben.py`, wertet „failed" aus):
  M2 (alle Kategorien statt Geändertem; 15 Unit- und 3 E2E-Läufe rot), M3 (`key={version}` fehlt; 3 rot), M4 (Polling an beiden Stellen; je ≥ 1 rot), M5 (Sperrdialog entfällt; 2 rot), M8 (`NAME_PIN_FALSCH` beendet die Sitzung; 5 rot),
  M9 (`mutate` + `onSuccess` statt `mutateAsync` bei Anlegen, Termin entfernen, Profil entfernen; je ≥ 1 rot), M10 (Absatz zu den Übersprungenen entfällt; 2 rot), M14 (`terminAlle` nicht neu gelesen; 6 rot) – alle Mutanten erkannt, keiner äquivalent.
  **Nicht geprüft:** Handprüfung 12.3–12.12 der Anleitung gegen den echten Server (zentrale PIN, Anmeldename mit E-Mail, Profile, Serie mit Kollision, Konflikt mit zwei Browsern, Abschliessen und Ergebnisse, Entfernen), Sichtprüfung bei 360 px
  mit geöffneter Tastatur (die E2E-Fälle prüfen Überhang und Tap-Ziele bei 360 px, nicht die Tastatur), iPhone.
- **Design-Überarbeitung Admin (18.10.2026):** `lint` (inkl. `e2e/`), `typecheck --force`, **1090 Unit-Tests** (neu: `Segmente`, `Schalter`, `Feldzeile`, `Netzdiagramm`/`netzdiagrammGeometrie.ts`, `ProfilKennzeichen`, `AdminProfilDetail` mit den Zuständen von `ProfilLader`,
  `durchschnittText`/`skalaText`, Entfernen aus der Terminliste, „Abbrechen“ im Termin- und Profilformular, `WOCHENTAGE.kurz`, `gefahrUmriss`, `routen`/`AppLayout` mit Funktion als `zurueck`; angepasst: `SkillFelder`, `AdminProfilFormular`,
  `AdminTerminNeu`, `AdminTermine`, `AdminTerminZeile`, `zielpfad`), Bau, ein Browserlauf der drei Admin-Specs auf allen drei Chromium-Projekten (102 von 102), danach der Vollauf (Vollauf 474 bestanden, 3 übersprungen; Cloud-Kopie wie bei C5/C7, Konfiguration mit `launchOptions.executablePath` ausserhalb des Repos).
  **Sichtprüfung** der sechs Ansichten bei 360 × 800 per Screenshot (Profilansicht, Formular, Terminliste, „Neuer Termin“ als Einzeltermin und Serie, Terminverwaltung) und zusätzlich über die Layout-Schleife; die E2E-Fälle prüfen Überhang, Höhe **und Breite** der Segmente
  und die gleiche Breite der Schaltflächen. **Zwei Befunde des Browserlaufs, die die Unit-Tests nicht sahen:** sieben Segmente nur 42,6 px breit bei 360 px (Karte reicht seitdem bis an den Rand, Einzug über `--segmente-einzug`) und 3,75 px Breitenunterschied bei
  `flex: 1` (Raster). **Nicht geprüft:** WebKit/iPhone, Handprüfung gegen den echten Server, 320 px, Tastaturansicht bei geöffneter Bildschirmtastatur, Gegenproben (keine neuen Mutanten gelaufen).

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
- **Dateinamen, die sich nur in der Groß-/Kleinschreibung unterscheiden** (`Netzdiagramm.tsx` neben `netzdiagramm.ts`): Linux-Arbeitskopie und Cloud (Groß-/Kleinschreibung beachtet) sind grün, auf dem Mac (APFS ohne Unterscheidung) löst `./Netzdiagramm` auf die `.ts`-Datei auf ⇒ TS1192/TS1261 im Bau. Behoben durch `netzdiagrammGeometrie.ts`. **Prüfung vor jeder Übergabe:** `find src e2e -type f | tr A-Z a-z | sort | uniq -d` muss leer sein.
- **Nachladen ändert die Reihenfolge der Stylesheets:** Das CSS des Admin-Pakets steht nach `global.scss`. Eine Modulklasse neben einer globalen Klasse (`style.legende` + `nurFuerScreenreader`) gewann danach die Breite ⇒ 16 px Überhang auf „Neuer Termin“ (nur E2E sah es). Keine Modulklasse mit einer globalen Klasse mischen, die dieselben Eigenschaften setzt.
- **Lazy Routes in Vitest:** Der erste `import()` des Admin-Pakets übersetzt den ganzen Bereich und dauert länger als `findBy` wartet (1 s) ⇒ `routen.test.tsx` lädt `adminSeiten` in `beforeAll` vorab.
- **Klasse des Aufrufers an `Knopfgruppe` ohne `display`/`flex`:** Gleich spezifische Regeln aus zwei Modulen gewinnen nach Reihenfolge im Bündel; ein `display: flex` des Aufrufers hätte das Raster still ersetzt.
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
- **C7 – `mutateAsync` auch beim Anlegen absichern:** Hängt eine Seite beim Neulesen aus (Entfernen eines Termins/Profils, Termin ändert Status), gehen `mutate(…, { onSuccess })`-Rückrufe verloren. Regressionstests hängen die Seite
  absichtlich aus (Hülle mit `useTermine`/Listenabfrage, die das Formular nach dem Anlegen entfernt).
- **C7 – Eine Mutation endet erst mit dem Neulesen** (`termineNeuLesen` gibt das Versprechen zurück): Hook- und Seitentests brauchen beobachtete Abfragen daneben, sonst wird nichts neu gelesen und die Mutation endet zu früh.
- **C7 – `mockServer.use(a, b)`:** der erste Handler im Aufruf gewinnt, spätere Aufrufe stellen voran; dasselbe gilt für `page.route` (zuletzt angemeldet gewinnt). Reihenfolge der Prüfungen im Mock `aendern`:
  404, `TERMIN_GESCHLOSSEN`, `DATEN_VERALTET`, 400, `TERMIN_BELEGT`.
- **C7 – Fokus nach einem Statuswechsel:** Mit dem Wechsel verschwinden die Aktionen samt Auslöser, der Dialog gibt den Fokus an ein Element zurück, das es nicht mehr gibt. Lösung: Merker (`useRef`) plus erzwungener Render,
  Effekt fokussiert die Überschrift der Karte (`ueberschriftRef`, `tabIndex={-1}`); ohne den erzwungenen Render läuft der Effekt nicht mehr, wenn der neue Stand vor dem Aufruf eintraf.
- **C7 – `key={version}` baut das Formular neu auf:** „Gespeichert." und der Fokus auf „Speichern" müssen im Elternbaustein liegen (Zustand + Rückrufe mit `useCallback`).
- **C7 – Geschlossene `<dialog>` bleiben im DOM:** Tests prüfen `not.toBeVisible()`, nicht `not.toBeInTheDocument()`; einen Dialog, der mit dem Erfolg samt Abschnitt verschwindet, ausgenommen.
- **C7 – Die Uhr nicht im Render:** `min` der Datumsfelder und „heute" über `useState(() => heuteIso(new Date()))`, `Date.now()` nur in Absenden-Handlern; die Vergangenheitsprüfung läuft beim Absenden.
- **C7 – `Auswahlliste` im E2E:** `selectOption` geht nicht (Combobox); Auslöser klicken, dann `<test-id>-option-<wert>`.
- **C7 – `tsc -b` aus `client/` starten**, nicht aus `src/`; **grosse Heredocs** mit device-bash scheitern an `spawn E2BIG` (Dateien in Teilen schreiben); Löschen im verbundenen Ordner ist gesperrt (Sicherungsdateien der Gegenproben nach `test-results/sicherung/`, nicht in `src/`).
- **Design – Radio mit `opacity: 0` über dem Segment:** Playwright klickt es und `check()` funktioniert; `toBeChecked()` auf dem Radio, nicht auf dem Text. Bei `Segmente` heisst das Segment `<id>-<wert>` (z. B. `skill-ANGRIFF-5`, `serie-wochentag-2`, `admin-art-serie`).
- **Design – Zugänglicher Name einer Legende aus zwei `span`:** ohne Leerzeichen dazwischen „Zehnerwert5“ (jsdom und Screenreader verketten); ein `{' '}` zwischen Name und Wert in `SkillFelder`.
- **Design – Mock-Reihenfolge:** Überschreibungen (`mockServer.use`) **nach** `adminHandler(welt)` anmelden, sonst gewinnt der Grundhandler (zuletzt angemeldet gewinnt); in `rendern`-Helfern, die selbst `adminHandler` anmelden, den Test inline bauen.
- **Design – `fullPage`-Screenshots** zeigen die haftende `Aktionsleiste` mitten im Bild (kein Fehler, sie haftet am Fenster).
- **Design – Eine Tarball-Kopie für die Cloud** gehört in `PRJ_FuBo/_zu_loeschen/` (nicht in einen nicht vorhandenen `outputs`-Ordner der Geräteshell); Löschen ist gesperrt, die Datei bleibt beim Aufräumen (6.9).
- **C5 – E2E-Nachbildung ohne Termin-Route** leitet `GET /termine/:id/lesen` an den Vorschau-Server (HTML): Tests auf `teams/:id`/`ergebnisse/:id` brauchen `termineNachbilden`.

### 5.4 Bewusst offen
- **WebKit-E2E abgeschaltet (18.10.2026, auf Anweisung des Entwicklers):** Im CI-Lauf vom 17.10.2026 (Stand C5) scheiterten die WebKit-Projekte quer durch die Dateien, die drei
  Chromium-Projekte waren grün. Ein Beispiel: `admin.spec.ts`, „uebersteht ein Neuladen von Schritt 2" – nach `page.reload()` fehlte der Balken (`history.state` mit `angefordertUm` weg; in
  `ios-schmal` und `ios-tablet-quer` belegt). **Ursache ungeklärt** (Playwrights WebKit-Build oder Safari-Verhalten); die übrigen Fehlschläge lagen nicht vollständig vor. Umsetzung:
  `playwright.config.ts` (`WEBKIT_AKTIV`/`OHNE_WEBKIT`, die vier WebKit-Projekte mit `testIgnore`), CI installiert nur Chromium. Wieder einschalten: `WEBKIT_E2E=1`, im CI `webkit` zu
  `playwright install` und `WEBKIT_E2E: '1'` am Testschritt. **Folge:** iPhone- und iPad-Layout (375/402 px, Tablet), Tab-Verhalten und Safari-Eigenheiten (z. B. PIN-Kästchen vom 03.10.2026)
  sind nicht mehr automatisch abgesichert – Handprüfung auf einem iPhone, besonders Neuladen von Schritt 2 der Passwort-Rücksetzung (der Balken ist reiner Schmuck, der feste Satz stimmt auch ohne).
- `RoutenAngaben.zurueck` darf seit der Design-Überarbeitung eine Funktion der Routenparameter sein (Profilformular → Profilansicht); „Zurück" von `teams/:terminId`/`ergebnisse/:terminId` geht weiter einen Schritt im Verlauf, beim Direkteinstieg zur Startseite.
- „nicht gefunden" liest beim Direkteinstieg keine Sitzung; der Offline-Hinweis erscheint dort erst mit dem ersten Aufruf oder dem Ereignis `offline`.
- **C4:** `PasswortFeld` kürzt längere Passwörter beim Einfügen still (`maxLength` 72, folgt dem Vertrag/BCrypt); läuft die `PIN_VERIFIED`-Sitzung beim Warten auf die Reset-E-Mail ab, ist der
  `navigate`-Zustand weg, der Vorgang auf dem Server aber gültig (Weg: PIN → Name → „Als Admin anmelden" → „Passwort vergessen?" → „Ich habe bereits eine PIN"); Verhalten auf iOS (`one-time-code`,
  Passwortmanager, Kleinschreibung) nur per Handprüfung. Die Namensänderung (`/admin/name/*`) ist seit C7 angebunden.
- **C7:** Die Gültigkeitsdauer der Namens-PIN steht nicht im Vertrag (Satz im UI ohne Zahl: „nur kurz gültig, fünf Versuche"); für die Handprüfung notieren und beim Server anfragen. `useTermin` liest beim Zurückkehren in den Tab
  neu (`refetchOnWindowFocus` nicht abgeschaltet): hat sich die `version` geändert, baut sich das offene Formular neu auf (E5, Eingaben gehen verloren). Die kommende Terminliste wird einmal beim Einhängen gegen den Verlauf entdoppelt
  (die Uhr läuft danach nicht weiter). Ein Serienlauf mit mehr als 52 Terminen scheitert am Server; der Client prüft das Zählen vor dem Senden nicht, sondern zeigt die Serverzahl.
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
1. **Die Design-Überarbeitung committen (auf Aufforderung; C7 ist committet) und `dev_client` pushen** (C5 ist committet, `e9a85e6`; Löschfreigabe für die Sperrdateien in `.git`) und CI-Lauf nur mit Chromium (nach der Abschaltung der WebKit-Projekte, 5.4); **WebKit-Ursache klären** (Trace aus dem Artefakt `playwright-report`, ggf. lokal `WEBKIT_E2E=1 npx playwright test`).
2. **Handprüfung C5 gegen eine laufende Serverinstanz** (5.2 „Nicht geprüft"; C5-Anleitung 12): Zusage/Absage und Reihenfolge, Teams generieren (Kontingent, Ersetzen, `veraltet`, Beginn), Termin 10 Minuten
   in der Zukunft anlegen und 30–35 Minuten nach Beginn Ergebnis erfassen (zwei Geräte → Hinweis), Bilanz für Spieler und Gast, Verlauf, iPhone. Danach den Hinweistext für `false → true` festlegen.
   Seit C7 Stufe 3 geht ein Teil davon ohne Wartezeit (Termin abschliessen; Teams vorher generieren, mindestens `minTeilnehmer` Zusagen).
3. **C4 abnehmen** (Handprüfung, iPhone, Passwortmanager).
4. **Design-Überarbeitung abnehmen (Sichtprüfung auf dem Telefon):** Profilansicht (Netzdiagramm lesbar, lange Namen), Skillstufen mit dem Daumen (sieben Segmente), Schalter „Aktiv in der Auswahlliste“ (sofort, angemeldetes Profil mit Dialog), Terminkarten, „Neuer Termin“ (Serie, Fehlertexte neben den halben Spalten); Skala im Kopf („Skalierung 0–6 (Torwart 0–3)“) ist entschieden und umgesetzt. Abweichungen dem Entwickler für DESIGN.md vorlegen.
5. **C7 abnehmen:** Handprüfung 12.3–12.12 der Anleitung gegen eine laufende Serverinstanz (zentrale PIN mit zweitem Gerät, Anmeldename mit E-Mail und Dauer der Namens-PIN notieren, Profile inkl. Sperren eines angemeldeten
   Spielers, Termine/Serie mit Kollision, Konflikt mit zwei Browsern, Abschliessen, Entfernen); Sichtprüfung bei 360 px mit geöffneter Tastatur (Dashboard, PIN, Name, Liste, Formulare, alle Dialoge); DESIGN.md-Abweichungen
   aus 1.3 dem Entwickler vorlegen. **Danach C8** (`harness/tmp/C8_UMSETZUNG.md`): Konfiguration/Gastplätze/Gast-Stufe 10,5 h, Halle/Ergebniskorrektur/manuelle Teams 11 h; dazu gehört die Ergebnis-Korrektur
   (`ergebnisKorrigieren` liegt in `admin.ts`, die Ansicht fehlt) und die Skill-Stufe eines Gastes.
6. **C2-Restabnahme:** Zoom 200 % bei 360 px, echtes Telefon im Sonnenlicht (auch Safari/iOS); iPhone-/iPad-Layout von Hand, solange WebKit abgeschaltet ist.
7. **Server-Track:** Vertragslücke freie Gastplätze (3); Verhalten von `GET /bilanz/lesen` für Gäste klären; Kontingent der Teamgenerierung in der Antwort anbieten; Anfragen aus C7 und C8 (1.4 der C7- und der C8-Anleitung:
   ADMIN-Lesezugriff auf `/termine/*`, Gast-Stufe lesbar, Mindestwert Leerlauf), **Gültigkeitsdauer der Namens-PIN dokumentieren** (offen aus C7).
8. **Betrieb:** Custom Domain `app.<domain>`, Rocket Loader und Auto-Minify aus, `FUBO_INITIAL_PIN` vierstellig.
9. **Aufräumen** (nur im lokalen Terminal; die Agentenumgebung darf es ohne Freigabe nicht): `PRJ_FuBo/_zu_loeschen/` (`e2e-kopie.tgz`, `client-e2e.tgz`, `src-neu.tgz`), verwaiste `.git/objects/tmp_obj_*`, übrige Sperrdateien.

## 7. Weitere Anweisungen
- Repo-Wurzel `client/`, Branches `dev_xxx`; nichts nach `main` ohne ausdrückliche Anweisung; Commits nur auf Aufforderung.
- Getrennte Repositories: Vertragsänderungen zuerst in `server/fubo-api.json`, dann Kopie gegen den Unterschied auffrischen, Typen und Mocks nachziehen.
- `.env` nie einchecken; keine realen Personennamen in Code, Tests oder Doku.
- Nach jedem Paket: visuelle Prüfung, dieser Handoff (Vorfassung ins Archiv), `AGENT_CLIENT.md` und `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` nachziehen. Über 500 Zeilen: kürzen (Vorfassung ins Archiv).
