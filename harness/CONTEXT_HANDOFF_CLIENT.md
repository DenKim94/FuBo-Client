# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) um den
> frontendseitigen Anteil. Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.

> Projektordner: `<Projektordner>/PRJ_FuBo`, Frontend unter `client/`
> Git-Repository: **eigenständiges Repository mit Wurzel in `client/`** (GitHub, privat, `FuBo-Client`).
> **Kein Monorepo.** Das Backend liegt in einem getrennten Repository (`FuBo-Server`, Ordner `server/`).
> Der übergeordnete Ordner `PRJ_FuBo/` sowie `PRJ_FuBo/harness/` sind bewusst **nicht** versioniert.
> Anlage erfolgt in Meilenstein C0.
> Stand: 01.08.2026, Aufteilung in Client-/Server-Verantwortung

---

## 1. Kontext
Frontend der FuBo-Anwendung: Login (PIN, Namensauswahl, Gast), Terminteilnahme, Teamübersicht,
Ergebniserfassung sowie ein Admin-Dashboard. Mobile-First, durchgängig deutschsprachig, Tablet/Desktop
nachrangig. Zugang über zentrale PIN, danach Namensidentität. Rollen ADMIN, USER, GAST.

## 2. Techstack & Rahmen (Client)
- React (ab Version 19), Vite, TypeScript, SCSS mit CSS Modules, TanStack Query.
- Tests: Vitest + React Testing Library, Playwright (E2E).
- Hosting: Cloudflare Pages (Domain als gegeben angenommen), Origin `app.<domain>`; API unter `api.<domain>`.
- UI-Vorgaben (Mobile-First, hoher Kontrast, große Tap-Ziele, Logo) in `/PRJ_FuBo/harness/assets/Design/DESIGN.md`; erste
  Prototypen unter `/PRJ_FuBo/harness/assets/Design/FuBo_Design_Prototypen.html`.

## 3. Wichtige Entscheidungen (clientrelevant)
Vollständige Liste in `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`, Abschnitt 3. Frontendseitig besonders relevant:
- Authentifizierung über serverseitiges HttpOnly-Cookie; **kein Token im `localStorage`**, Aufrufe mit
  `credentials: 'include'`. Das Frontend kennt den Token nicht.
- Zweistufiger Login (PIN → Namensauswahl) gemäß Server-`stage`; `401` ⇒ automatischer Logout,
  Erneuerungs-Hinweis vor Ablauf des gleitenden 15-Minuten-Fensters.
- **Keine Skillwerte für USER/GAST**: Skills erscheinen ausschließlich in Admin-Ansichten.
- Namensbelegung wird per TanStack-Query-Polling aktuell gehalten (belegte Namen ausgrauen).
- Teilnehmerübersicht mit Balken: rot unter der Mindestanzahl (Default 6), sonst grün; Warteschlange bei
  Überschreiten der Maximalzahl (Default 22).
- Bei Teilnehmeränderung wird eine bestehende Team-Einteilung als veraltet gekennzeichnet.

## 4. Schnittstelle zum Server (Vertrag)
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kernpunkte: REST/JSON gegen `api.<domain>`,
Aufrufe mit `credentials: 'include'`, zweistufiger Auth-Fluss, `401`/`403`-Behandlung, Teamdaten ohne
Skillwerte, Belegtstatus-Polling, einheitliches Fehler-JSON in deutschsprachige Meldungen übersetzen. Der
konkrete Endpunktkontrakt liegt als `FuBo-Server: fubo-api.json` vor (OpenAPI 3.1, Repo-Wurzel) und ist
bei Abweichungen massgeblich; für alles, was er noch nicht beschreibt, gegen die
dokumentierten Verträge und eine Mock-Schicht entwickeln.

## 5. Meilensteine & Aufwandsschätzung (Client)
Mid-Level-Entwickler, KI-gestützt, ca. 6,5 h/Woche.

| MS | Inhalt | Aufwand (h) |
|---|---|---|
| C0 | Frontend-Setup: Vite/TS, SCSS-Struktur inkl. `_globalVars.scss`, Routing, TanStack Query, `.gitignore`, Cloudflare-Pages- und CI-Konfiguration | 8 |
| C1 | Design-System & Basis-Layout: Mobile-First-Raster, globale Styles/Variablen, Logo, Kontrast/Tap-Ziele, Basis-Komponenten (Button, Dropdown, Balken, Info-Icon, Dialog) | 12 |
| C2 | Login-Fluss: PIN-Eingabe, Namensauswahl mit Ausgrauen + Polling, Gast-Formular + Info-Icon + „(Gast)"-Suffix, zweistufiger Fluss, Session-Erneuerung/Auto-Logout, Admin-Login + Passwort-Reset-UI | 16 |
| C3 | User-Dashboard: nächster Termin, Zu-/Absage, Teilnehmer-Balken (rot/grün), Teamübersicht, Auswechselspieler-Anzeige | 16 |
| C4 | Teamgenerierung-UI + Ergebniserfassung: Generieren-Button, Kontingentanzeige, Veraltet-Hinweis, Ergebnis-Eingabe (Sieger/deutlich) | 10 |
| C5 | Admin-Dashboard: Profile + Skills, Gäste + Stufen, Termine (Einzel/Serie), zentrale PIN, Konfiguration, Hallen-Absage (48-Stunden-Zustand) | 18 |
| C6 | Tests (Vitest/RTL, Playwright E2E), Barrierefreiheit, Härtung, Deployment auf Cloudflare Pages, Doku | 12 |

**Summe Client ≈ 92 h → ca. 14–15 Kalenderwochen** bei 6,5 h/Woche (Spanne ±15 %). Kritischer Pfad: C2
und C5. Abhängigkeit: C3–C5 benötigen den abgestimmten Endpunktkontrakt bzw. eine Mock-Schicht.

## 6. Aktueller Code-Zustand
Projektstruktu (Frontend-Setup: Vite/TS) ist bereits initialisiert und mit Beispielinhalt befüllt.

## 7. Nächste Schritte
1. **C0** starten: Bisherige Struktur prüfen und die initialen Beispieldaten entfernen. 
SCSS-Konventionen und `_globalVars.scss` festlegen.
2. Endpunktkontrakt und Mock-Schicht. **Der Kontrakt liegt seit dem 22.08.2026 vor** und deckt die
   Auth- und Sitzungsendpunkte aus S2 vollständig ab. Er ist **Quelle der Wahrheit im
   Server-Repository** und liegt dort auf der Wurzel: **`FuBo-Server: fubo-api.json`** (OpenAPI 3.1
   in JSON; Ablageort und Format sind eine Festlegung des Haupt-Entwicklers und ersetzen den früher
   geplanten Pfad `src/main/resources/openapi/fubo-api.yaml`). Der Client generiert daraus seine
   TypeScript-Typen (z. B. `openapi-typescript`) und checkt das Generat ein, damit nachvollziehbar
   bleibt, gegen welche Vertragsversion gebaut wurde.
3. Danach C1 (Design-System) und C2 (Login-Fluss).

## 8. Weitere Anweisungen
- **Repository-Konventionen:** Repo-Wurzel ist `client/`. Branch-Namen mit Meilenstein-Präfix
  (`feature/c0-frontend-setup`, `fix/...`, `chore/...`, `docs/...`). Commit-Nachrichten nach Conventional
  Commits **ohne** Scope `(client)` – die Zuordnung ergibt sich aus dem Repository.
- **Getrennte Repositories:** Änderungen an Client und Server können nicht in einem gemeinsamen Commit
  erfolgen. Bei Vertragsänderungen zuerst `fubo-api.json` im Server-Repo prüfen, dann die generierten
  Typen und die Mock-Schicht im Client nachziehen.
- Ohne ausdrückliche Anweisung des Entwicklers nichts in `main` mergen/pushen; Feature-Branch erlaubt.
- `.env`-Dateien nie einchecken. Dokumentation in deutscher Sprache. **Keine realen Personennamen** in
  Code, Testdaten oder Dokumentation.
- Zu jeder Komponente eine eigene Style-Datei (`<Komponentenname>.module.scss`); globale Variablen in
  `_globalVars.scss`. In Sass `@use`/`@forward` statt `@import`.
- Nach Abschluss eines Arbeitspakets kurze visuelle Verifikation durchführen und diesen Handoff
  aktualisieren (veraltete Fassung zuvor unter `client/harness/archive/` ablegen).
  Zudem soll auch das zentrale Handoff in `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) entsprechend aktualisiert werden.
  *Hinweis:* `/PRJ_FuBo/harness/` liegt **außerhalb** dieses Repositories und wird nicht mitcommittet.
