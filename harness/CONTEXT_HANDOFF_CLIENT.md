# Context Handoff – FuBo Frontend (Client)

> Übergabedokument für den Client-Agenten. Ergänzt `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) um den
> frontendseitigen Anteil. Systemprompt: `AGENT_CLIENT.md`. Gesamtspezifikation: `/PRJ_FuBo/harness/AGENT.md`.
> UI-Vorgaben: `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.

> Projektordner: `<Projektordner>/PRJ_FuBo`, Frontend unter `client/`
> Git-Repository: noch nicht angelegt (siehe Meilenstein C0)
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
- Teilnehmerübersicht mit Balken: rot unter der Mindestanzahl (Default 8), sonst grün; Warteschlange bei
  Überschreiten der Maximalzahl (Default 22).
- Bei Teilnehmeränderung wird eine bestehende Team-Einteilung als veraltet gekennzeichnet.

## 4. Schnittstelle zum Server (Vertrag)
Siehe `AGENT_CLIENT.md`, Abschnitt „Schnittstelle zum Server". Kernpunkte: REST/JSON gegen `api.<domain>`,
Aufrufe mit `credentials: 'include'`, zweistufiger Auth-Fluss, `401`/`403`-Behandlung, Teamdaten ohne
Skillwerte, Belegtstatus-Polling, einheitliches Fehler-JSON in deutschsprachige Meldungen übersetzen. Der
konkrete Endpunktkontrakt (OpenAPI empfohlen) ist mit dem Server-Agenten abzustimmen; bis dahin gegen die
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
Kein Code vorhanden (reine Konzeptionsphase). UI-Prototypen liegen als Design-Referenz vor. Nächster
Schritt ist C0.

## 7. Nächste Schritte
1. **C0** starten: Frontend-Struktur `client/` im Monorepo anlegen, SCSS-Konventionen und
   `_globalVars.scss` festlegen, Branch-Strategie und `.gitignore` (inklusive `.env`).
2. Endpunktkontrakt mit dem Server-Agenten abstimmen (OpenAPI) und Mock-Schicht aufsetzen.
3. Danach C1 (Design-System) und C2 (Login-Fluss).

## 8. Weitere Anweisungen
- Ohne ausdrückliche Anweisung des Entwicklers nichts in `main` mergen/pushen; Feature-Branch erlaubt.
- `.env`-Dateien nie einchecken. Dokumentation in deutscher Sprache. **Keine realen Personennamen** in
  Code, Testdaten oder Dokumentation.
- Zu jeder Komponente eine eigene Style-Datei (`<Komponentenname>.module.scss`); globale Variablen in
  `_globalVars.scss`. In Sass `@use`/`@forward` statt `@import`.
- Nach Abschluss eines Arbeitspakets kurze visuelle Verifikation durchführen und diesen Handoff
  aktualisieren (veraltete Fassung zuvor unter `client/harness/archive/` ablegen).
  Zudem soll auch das zentrale Handoff in `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) entsprechend aktualisiert werden.
