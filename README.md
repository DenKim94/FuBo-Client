# MONTAGS-KICKER – Client

Frontend der Anwendung: Anmeldung über die zentrale PIN und den hinterlegten
Namen, Terminteilnahme, Teamübersicht, Ergebniserfassung und ein getrenntes
Admin-Dashboard. Mobile-First, durchgaengig deutschsprachig, als installierbare
Progressive Web App.

Das Backend liegt in einem eigenen Repository (`FuBo-Server`) und wird über eine
REST-Schnittstelle angesprochen.

## Voraussetzungen

- Node ab 20 (entwickelt wird mit 22, siehe `.nvmrc`)
- Ein laufender Server unter `http://localhost:8080` für die Entwicklung gegen
  echte Daten. Tests laufen ohne Server gegen die Mock-Schicht (MSW im
  Node-Modus, `src/test/mocks/`).

## Einrichtung

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

## Befehle

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver auf Port 5173, Proxy für `/api` auf Port 8080 |
| `npm run build` | Typprüfung und Produktionsbau nach `dist/` |
| `npm run preview` | Gebaute Fassung auf Port 4173 ausliefern |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript über alle vier Teilprojekte (`app`, `node`, `worker`, `e2e`) |
| `npm test` | Unit- und Komponententests (Vitest) |
| `npm run test:e2e` | End-to-End-Tests (Playwright, baut vorher) |
| `npm run e2e:browser` | Browser für Playwright nachladen (Chromium und WebKit), vor dem ersten Lauf |

## Technik

React 19, Vite 8, TypeScript, SCSS mit CSS Modules, TanStack Query für den
Server-State, React Router, `vite-plugin-pwa` mit eigenem Service Worker
(`src/sw.ts`). Tests mit Vitest, React Testing Library und Playwright.

## Ordnerstruktur

```
src/api/common/          Querschnitt des Datenzugriffs (httpService, fehler, schluessel)
src/api/common/types/    schema.d.ts – Generat aus harness/assets/fubo-api.json
src/api/<domaene>/       fachlicher Datenzugriff je Domäne, z. B. sitzung/
src/app/                 Routen, Guards (schutz/), Query-Client
src/components/<Name>/   Komponente, Stil und Test in einem Ordner
src/context/             React-Kontexte (noch leer)
src/hooks/               use<Sache>.ts, flach
src/layouts/<Name>Layout/
src/pages/<Name>/        Routen-Ansichten (ab C3)
src/styles/              _globalVars.scss, _reset.scss, global.scss
src/test/                Testrahmen und Mock-Schicht
```

Ordnernamen sind englisch, Bezeichner und Oberflächentext deutsch. Eine Domäne
trägt über alle Ebenen denselben Namen (`api/admin/` ↔ `AdminLayout` ↔
`AdminDashboard`). Die verbindliche Fassung steht in `harness/AGENT_CLIENT.md`,
Abschnitt „Ordnerstruktur und Domänenkonsistenz".

## Konventionen

- Funktions- und Variablennamen in camelCase, Konstanten gross geschrieben.
- Jede Funktion und Komponente ist im JSDoc-Format auf Deutsch dokumentiert.
- Zu jeder Komponente gehoert eine eigene `<Name>.module.scss`; globale
  Variablen stehen in `src/styles/_globalVars.scss`. In Sass `@use`/`@forward`
  statt des abgekündigten `@import`.
- Jedes bedienbare Element traegt ein `data-testid`.
- Keine `.env`-Dateien einchecken, keine realen Personennamen in Code, Testdaten
  oder Dokumentation.

## Weiterführende Dokumente

- `harness/AGENT_CLIENT.md` – Vorgaben für die Frontend-Entwicklung
- `harness/CONTEXT_HANDOFF_CLIENT.md` – Stand und Arbeitspakete
- `harness/assets/fubo-api.json` – Endpunktkontrakt (OpenAPI 3.1)
