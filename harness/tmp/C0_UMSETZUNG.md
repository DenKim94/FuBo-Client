# C0 – Projektfundament (Umsetzungsanleitung)

> Schrittweise Anleitung zum Arbeitspaket **C0** in der neu geschnittenen Fassung (geschätzt 14 h).
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (Gesamtspezifikation), `client/harness/AGENT_CLIENT.md`
> (Systemprompt Client), `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (UI-Vorgaben).
> Kontrakt: `client/harness/assets/fubo-api.json` (OpenAPI 3.1, **44 Operationen** einschliesslich
> der sechs Push-Endpunkte aus A25; die Kopie wurde am 25.09.2026 vom Server-Stand aufgefrischt).
> Stand: 25.09.2026, Repository auf Branch `dev_client`, ausgehend von Commit `e5d1479`.
>
> **Umgesetzt am 25.09.2026.** Die Schritte 2 bis 12 sind ausgefuehrt. Abschnitt 13 haelt fest, was
> wo verifiziert wurde und was auf dem Entwicklungsrechner nachzuholen ist; Abschnitt 16 nennt die
> vier Abweichungen, die sich waehrend der Umsetzung ergeben haben.

---

## 0. Ziel und Abgrenzung

### 0.1 Ergebnis von C0

Nach C0 steht ein Projektgerüst, das sich bauen, prüfen, testen und ausliefern lässt und das alle
Entscheidungen enthält, die **später nicht mehr billig zu ändern** sind. Konkret:

- `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck` und `npm run test` laufen
  fehlerfrei durch, und ein CI-Lauf prüft dieselben fünf Punkte bei jedem Push auf `dev_client`.
- Die Anwendung startet als leeres, aber vollständig gerüstetes Grundgerüst: Routing mit sichtbarer
  Zurück-Navigation, Layout mit Safe-Area-Rändern, SCSS-Fundament mit `_globalVars.scss`,
  TanStack-Query-Provider.
- Die PWA ist **strukturell** richtig konfiguriert: `injectManifest` mit eigenem Service Worker,
  korrektes Manifest, `viewport-fit=cover`, `_headers` und `_redirects` für Cloudflare Pages.
  Der Service Worker enthält in C0 nur das Grundgerüst (Precache der App-Shell, Navigationsroute,
  `SKIP_WAITING`) – **keine** Push-Logik.
- Keine Reste der Vite-Vorlage mehr im Repository.

**C0 ist kein fachliches Paket.** Es entsteht keine Ansicht, die ein Spieler benutzen könnte.

### 0.2 Nicht Teil von C0

| Thema | Paket |
|---|---|
| Typgenerierung aus `fubo-api.json`, HTTP-Schicht, Fehlerübersetzung, Mock-Schicht | C1 |
| Design-Tokens im Detail, Basis-Komponenten (Button, Dropdown, Balken, Dialog) | C2 |
| PIN-Login, Namensauswahl, Gast, Sitzungs-Countdown und Auto-Logout | C3 |
| Admin-Login und Passwort-Reset | C4 |
| Termin, Zu-/Absage, Teilnehmerliste, Bilanz | C5 |
| Teamansicht, Generierung, Ergebniserfassung | C6 |
| Admin-Verwaltung | C7 |
| Push-Abonnement, Einstellungsansicht, Installations-Onboarding, Benachrichtigungstexte im SW | C8 |
| E2E-Suite, Barrierefreiheitsprüfung, Deployment auf die feste Domain | C9 |

### 0.3 Warum der Schnitt so liegt

Drei Dinge gehören unbedingt **an den Anfang**, obwohl sie fachlich ans Ende gehörten:

1. **`viewport-fit=cover` und die Safe-Area-Variablen.** Ohne `viewport-fit=cover` im Viewport-Meta
   liefert `env(safe-area-inset-*)` auf iOS durchgängig `0px`. Der Fehler fällt im Browser nicht auf,
   sondern erst im Vollbildmodus – und dann in jeder Ansicht gleichzeitig. `AGENT_CLIENT.md` verlangt
   die primären Aktionen in Daumenreichweite, also genau dort, wo der Home-Indicator sitzt.
2. **Die sichtbare Zurück-Navigation.** Im Modus `standalone` gibt es keine Browser-Zurück-Schaltfläche.
   Sie nachträglich in jede Ansicht einzubauen heisst, jedes Layout ein zweites Mal anzufassen.
3. **Die Wahl `injectManifest` statt `generateSW`.** Sie entscheidet über die Struktur von
   `vite.config.ts`, über eine zusätzliche `tsconfig` und über die Abhängigkeiten. Die Begründung steht
   in Schritt 8.1.

Umgekehrt bleibt die **Push-Logik draussen** – nicht, weil sie blockiert wäre: Die sechs Endpunkte
aus A25 stehen seit dem serverseitigen Paket S8 (verifiziert am 15.09.2026) im Kontrakt. Sie bleibt
draussen, weil sie ein eigenes fachliches Paket ist: Abonnement, Einstellungsansicht mit dreiteiligem
Zustand, die Reihenfolge im Onboarding und die Benachrichtigungstexte hängen zusammen und gehören
nicht in ein Setup-Paket.

---

## 1. Befund des Ist-Zustands (Prüfung vom 25.09.2026)

Die folgenden Punkte wurden am bestehenden Stand geprüft. Jede Zeile hat unten einen Schritt, der sie
behebt.

| Nr. | Befund | Wirkung | Schritt |
|---|---|---|---|
| B1 | `tsconfig.app.json` setzt **kein `strict`** | Kein `strictNullChecks`. Bei einer API, deren Felder ausdrücklich dreiwertig sind (`eigeneRueckmeldung`: `true`/`false`/`null`), ist das der teuerste einzelne Mangel im Setup. | 3.1 |
| B2 | `tsconfig.json` deklariert `types: ["vite-plugin-pwa/client"]` im **Solution-File** | Wirkungslos: Bei Project References erben referenzierte Projekte die `compilerOptions` des Solution-Files nicht. `tsc --showConfig -p tsconfig.app.json` zeigt nur `["vite/client"]`. `virtual:pwa-register/react` liesse sich nicht typisieren. | 3.2 |
| B3 | `lib` ohne `DOM.Iterable`, kein `WebWorker` | Iterationen über `NodeList`/`FormData` schlagen fehl; ein Service Worker in TypeScript ist nicht übersetzbar. | 3.3, 3.4 |
| B4 | `vite.config.ts` nutzt die Vorgabe `strategies: 'generateSW'` | Der erzeugte Service Worker nimmt **keinen eigenen Code** auf. A25 verlangt eigene `push`- und `notificationclick`-Behandlung. | 8.1 |
| B5 | Manifest: die 512er-Ikone ist **nur** `purpose: 'maskable'` | Es fehlt eine 512er-Ikone mit `purpose: 'any'`. Chrome zählt eine rein maskierbare Ikone für die Installierbarkeit nicht mit; `beforeinstallprompt` feuert dann stillschweigend nicht. | 8.3 |
| B6 | Manifest: `app-icon-48.png` ist real 48×43, `-72` ist 72×65, `-96` ist 96×86 | Deklarierte und tatsächliche Grösse weichen ab; Browser verwerfen solche Einträge. | 8.3 |
| B7 | `includeAssets` nennt `favicon.svg` – die Datei existiert nicht | Toter Eintrag; zugleich hat `index.html` überhaupt kein Favicon. | 8.3 |
| B8 | `globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}']` | Precacht alle elf PWA-Ikonen (rund 1,1 MB) und dreissig UI-SVGs. Die Manifest-Ikonen liest das Betriebssystem, nicht die Anwendung – sie gehören nicht in den Precache. | 8.4 |
| B9 | Kommentar „Verhindert Caching von /api/*" an `navigateFallbackDenylist` | Sachlich falsch: Die Denylist steuert nur den Navigations-Rückfall, nicht das Caching. Der Kommentar lädt dazu ein, sich in Sicherheit zu wiegen. | 8.5 |
| B10 | `public/_headers` und `public/_redirects` fehlen | Drei der vier Cloudflare-Auflagen aus A25 sind nicht umgesetzt. | 9 |
| B11 | `index.html`: kein `viewport-fit=cover`, kein `theme-color`, Titel `MONTAGS-KICKER` ≠ Manifest-Name `FuBo – Teamgenerator` | Safe-Area-Werte bleiben 0; Titel und App-Name laufen auseinander. | 5.4 |
| B12 | `src/styles/main.scss` ist unverändert die Vite-Vorlage (`--accent: #aa3bff`, `#root { width: 1126px }`) | Eine feste Breite von 1126 px ist das Gegenteil von Mobile-First. | 4.1, 5 |
| B13 | `.gitignore` enthält `.env.*` ohne Ausnahme | Eine `.env.example` liesse sich nicht einchecken. | 10.2 |
| B14 | Die Client-Kopie des Kontrakts war **inhaltlich veraltet**: 38 Operationen, keine unter `/push/`, während der Server-Stand 44 führt | Die Kopie legte nahe, das serverseitige Paket S8 sei offen und C8 dadurch blockiert. Tatsächlich ist S8 seit dem 15.09.2026 verifiziert. Ein veralteter Kontrakt ist teurer als ein fehlender: Er sieht richtig aus. | 2.4 |
| B15 | Kein Router, kein TanStack Query, keine Testwerkzeuge installiert | Erwartet – das ist der Inhalt von C0. | 2.2, 6, 7, 11 |
| B16 | `package.json`: `name: "FuBo-Client"` (npm verlangt Kleinschreibung), `sass` **und** `sass-embedded` installiert | Kosmetisch bzw. redundant. | 2.3 |

**Was in Ordnung ist:** `tsc -b` läuft fehlerfrei durch (Exitcode 0). Die Abhängigkeiten sind aktuell
und untereinander verträglich (Vite 8.2.2, `vite-plugin-pwa` 1.3.0, Workbox 7.4.1, React 19.2.8,
TypeScript 6.0.3). Node 22.23.2 erfüllt die Workbox-Anforderung „ab 20". `.gitattributes` erzwingt LF.
Branch und Remote stimmen überein.

> **Hinweis zur Prüfung:** `npm run build` wurde in einer Linux-Umgebung ausgeführt und bricht dort in
> der Rolldown-Bindung ab (`@rolldown/binding-linux-arm64-gnu` fehlt). Das ist eine Folge davon, dass
> `node_modules` unter macOS installiert wurde, **kein Projektfehler**. Der Bau ist auf dem
> Entwicklungsrechner zu verifizieren (Schritt 13).

---

## 2. Vorbereitung

### 2.1 Branch und Node-Version festschreiben

Arbeitsbranch ist `dev_client` (Vorgabe aus `CONTEXT_HANDOFF_CLIENT.md`, Abschnitt 8). Nichts nach
`main`.

```bash
git checkout dev_client
git pull --ff-only
git switch -c dev_client_c0        # optionaler Feature-Branch fuer C0
```

Die Node-Version gehört ins Repository, sonst baut CI gegen eine andere Fassung als der
Entwicklungsrechner:

```bash
echo "22" > .nvmrc
```

```jsonc
// package.json – ergaenzen
"engines": {
  "node": ">=20"
}
```

**Warum `>=20` und nicht `>=22`?** Workbox verlangt 20; eine engere Grenze schlösse ohne Gewinn
Umgebungen aus. `.nvmrc` legt fest, womit *entwickelt* wird, `engines` was *mindestens* funktioniert.

### 2.2 Abhängigkeiten ergänzen

```bash
npm install react-router @tanstack/react-query
npm install -D @tanstack/react-query-devtools \
               workbox-precaching workbox-routing \
               vitest @vitest/coverage-v8 jsdom \
               @testing-library/react @testing-library/jest-dom @testing-library/user-event \
               @playwright/test
npx playwright install chromium
```

| Paket | Zweck | Begründung |
|---|---|---|
| `react-router` | Routing | Ab Fassung 7 ist `react-router-dom` überflüssig; alles liegt im Hauptpaket. **Entscheidung:** React Router statt TanStack Router, weil der Umfang klein ist (rund 15 Routen), die Bibliothek verbreiteter ist und die Typisierung hier keinen Vorteil bringt, der den zusätzlichen Generierungsschritt aufwöge. Siehe 6.1. |
| `@tanstack/react-query` | Server-State | Ausdrücklich vorgegeben (`AGENT_CLIENT.md`, „Verbindliche Architekturregeln"). Wird für das Polling des Belegtstatus (A6) und die Invalidierung nach Zu-/Absage gebraucht. |
| `workbox-precaching`, `workbox-routing` | Service Worker | Bei `injectManifest` schreibt man den Service Worker selbst und importiert die Workbox-Bausteine direkt. `workbox-window` (bereits vorhanden) deckt nur die Seite ab, nicht den Worker. Fassung 7.4.x, passend zum mitgelieferten `workbox-build`. |
| `vitest`, `jsdom`, Testing Library | Unit- und Komponententests | Vorgabe aus `AGENT_CLIENT.md`, Abschnitt „Techstack". |
| `@playwright/test` | End-to-End | Service Worker und Offline-Verhalten sind nur so prüfbar. |

**Nicht** in C0 installieren: `openapi-typescript` und `msw` – beide gehören zu C1 und würden hier nur
unbenutzt im Baum liegen.

### 2.3 Kleinigkeiten in `package.json`

```jsonc
{
  "name": "fubo-client",   // war "FuBo-Client"; npm verlangt Kleinbuchstaben
  ...
}
```

`sass` entfernen, `sass-embedded` behalten:

```bash
npm uninstall sass
```

Vite bevorzugt `sass-embedded`, wenn beide vorhanden sind. Zwei Übersetzer für dieselbe Sprache im Baum
zu halten, erzeugt nur die Frage, welcher gerade gilt.

### 2.4 Kontrakt-Kopie auffrischen (B14)

```bash
cp ../server/fubo-api.json harness/assets/fubo-api.json
```

**Warum das in C0 gehört.** Die Kopie im Client trug 38 Operationen, der Server-Stand 44 – die sechs
Push-Endpunkte aus A25 fehlten. Eine veraltete Kopie ist teurer als eine fehlende: Sie sieht richtig
aus, und jede Ableitung daraus – Typgenerierung, Mock-Schicht, Paketplanung – erbt den Fehler
stillschweigend. Konkret hatte sie zu der falschen Annahme geführt, das serverseitige Push-Paket sei
noch offen.

Was sich dadurch fachlich ändert und ab C7 zählt: Das Voll-Update der Konfiguration hat jetzt
**fünfzehn** Pflichtfelder; `pushAktiv` und `pushErinnerungStunden` sind hinzugekommen. Ein Formular,
das eines davon weglässt, bekommt `400`.

**Die Kopie ist nur eine Kopie.** Massgeblich bleibt `server/fubo-api.json`; Vertragsänderungen werden
immer zuerst dort abgebildet. Beim Auffrischen ist deshalb ein Blick in den Unterschied Pflicht, nicht
das blosse Überschreiben.

---

## 3. TypeScript-Konfiguration korrigieren

### 3.1 `strict` einschalten (B1)

```jsonc
// tsconfig.app.json – compilerOptions ergaenzen
"strict": true,
"noUncheckedSideEffectImports": true,
```

**Begründung.** Der Kontrakt arbeitet an mehreren Stellen bewusst mit `null` als eigenem Zustand:
`eigeneRueckmeldung` ist dreiwertig, `teams` ist `null`, solange nicht generiert wurde,
`auswechselspieler` ist `null` bei gerader Teilnehmerzahl, `ort` ist optional, `rolle` und
`anzeigeName` sind in der Stufe `PIN_VERIFIED` `null`. Ohne `strictNullChecks` sind das alles stumme
Fallen: Der Code übersetzt, und die Ansicht zeigt „undefined". Je später `strict` kommt, desto teurer
wird es – bei einem leeren `src/` kostet es nichts.

`noUncheckedSideEffectImports` meldet Importe wie `import './App.module.scss'`, die nichts binden. Genau
dieser Fehler steckt im Vorlagencode (Schritt 4.1).

### 3.2 Typen für die PWA-Module (B2)

```jsonc
// tsconfig.app.json
"types": ["vite/client", "vite-plugin-pwa/client"],
```

```jsonc
// tsconfig.json – die wirkungslose Angabe entfernen
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.worker.json" }
  ]
}
```

**Begründung.** Ein Solution-File mit `"files": []` gibt seine `compilerOptions` nicht an referenzierte
Projekte weiter. Zudem *überschreibt* `types` in `tsconfig.app.json` die Vorgabe, alle `@types`-Pakete
zu laden – wer dort nur `vite/client` nennt, schliesst alles andere aus. Prüfbar mit:

```bash
npx tsc --showConfig -p tsconfig.app.json
```

### 3.3 `lib` ergänzen (B3)

```jsonc
// tsconfig.app.json
"lib": ["ES2023", "DOM", "DOM.Iterable"],
```

`DOM.Iterable` wird bei der ersten Iteration über `FormData`, `URLSearchParams` oder eine `NodeList`
gebraucht – im Login-Formular also spätestens in C3.

### 3.4 Eigene `tsconfig` für den Service Worker (B3)

Der Service Worker läuft in einem anderen globalen Gültigkeitsbereich: Es gibt kein `window`, dafür
`ServiceWorkerGlobalScope`. `lib: ["DOM"]` und `lib: ["WebWorker"]` widersprechen sich, deshalb braucht
er ein eigenes Projekt – und `tsconfig.app.json` muss ihn **ausschliessen**, sonst wird er zweimal und
einmal falsch übersetzt.

```jsonc
// tsconfig.app.json – ergaenzen
"exclude": ["src/sw.ts"]
```

```jsonc
// tsconfig.worker.json – neu
{
  "extends": "./tsconfig.app.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.worker.tsbuildinfo",
    "lib": ["ES2023", "WebWorker"],
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src/sw.ts"],
  "exclude": []
}
```

### 3.5 Verifikation

```bash
npx tsc -b --force        # muss mit Exitcode 0 enden
```

---

## 4. Vorlagenreste entfernen und Ordnerstruktur anlegen

### 4.1 Reste entfernen (B12)

| Datei | Massnahme | Grund |
|---|---|---|
| `README.md` | ersetzen | Enthält den Vite-Vorlagentext auf Englisch. Vorgabe: deutschsprachige Dokumentation. |
| `src/styles/main.scss` | ersetzen (Schritt 5) | Vorlagen-Farbwelt und `#root { width: 1126px }`. |
| `src/app/App.tsx` | ersetzen (Schritt 6) | `import './App.module.scss'` bindet nichts – bei CSS Modules muss das Ergebnis gebunden werden (`import styles from …`). |
| `src/app/App.module.scss` | löschen | Leere Datei. |
| `src/assets/react.svg` | löschen | Nicht verwendet. |

Der neue `README.md` bleibt knapp: Zweck, Voraussetzungen (Node 22), die vier Befehle, Verweis auf
`harness/AGENT_CLIENT.md` und `harness/CONTEXT_HANDOFF_CLIENT.md`. **Keine realen Personennamen.**

### 4.2 Zielstruktur

```
src/
  api/                  # C1: erzeugte Typen, HTTP-Schicht, Query-Schluessel
  app/
    App.tsx             # Router-Einstieg
    routen.tsx          # Routenbaum
    QueryProvider.tsx   # TanStack-Query-Provider
  komponenten/          # C2: wiederverwendbare Basis-Komponenten
    <Name>/
      <Name>.tsx
      <Name>.module.scss
  layouts/
    AppLayout/          # Kopf, Zurueck-Navigation, Safe-Area, Inhaltsbereich
  seiten/               # je Ansicht ein Ordner, ab C3
  hooks/
  styles/
    _globalVars.scss    # globale Variablen (Vorgabe AGENT_CLIENT.md)
    _reset.scss
    global.scss         # einziger globaler Einstiegspunkt
  sw.ts                 # Service Worker (Geruest in C0, Push in C8)
  main.tsx
```

**Warum deutsche Ordnernamen?** Die Vorgabe verlangt deutschsprachige Dokumentation und Kommentare; die
Fachbegriffe der Anwendung sind durchweg deutsch (`teilnehmer`, `termin`, `rueckmeldung`). Ein
gemischtes Vokabular erzeugt bei jedem Import die Frage, in welcher Sprache der Ordner heisst.
Ausgenommen bleiben eingeführte technische Begriffe (`api`, `hooks`, `styles`, `layouts`).

> **Zu entscheiden:** Wer lieber durchgängig englische Ordnernamen möchte, legt das hier fest – danach
> ist es eine Umbenennung über den gesamten Baum.

### 4.3 Pfad-Aliase

```jsonc
// tsconfig.app.json
"paths": {
  "@/*": ["./src/*"]
}
```

**Kein `baseUrl`.** Seit TypeScript 6 ist die Option abgekündigt und bricht den Lauf mit `TS5101`.
Ohne sie löst `paths` relativ zur Konfigurationsdatei auf – die Einträge brauchen dann aber einen
führenden `./`, sonst meldet der Übersetzer `TS5090` („Non-relative paths are not allowed when
'baseUrl' is not set"). Beide Fehler traten bei der Umsetzung nacheinander auf; siehe Abschnitt 16.

```ts
// vite.config.ts – ergaenzen
import { fileURLToPath, URL } from 'node:url'

resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
},
```

Beides ist nötig: TypeScript löst über `paths` auf, der Bauvorgang über `resolve.alias`. Fehlt eines,
übersetzt der Code, aber der Bau bricht ab – oder umgekehrt.

---

## 5. SCSS-Fundament

### 5.1 `_globalVars.scss`

Die Datei ist in `AGENT_CLIENT.md` namentlich vorgeschrieben. Sie enthält **nur Variablen**, kein
Regelwerk – sonst wird sie bei jedem `@use` mehrfach ausgegeben.

```scss
// src/styles/_globalVars.scss
// Globale Design-Tokens und Umgebungswerte.
// Vorgabe: AGENT_CLIENT.md ("globale (S)CSS-Variablen zentral in _globalVars.scss").
// Die Farbwerte sind bewusst Platzhalter (DESIGN.md: "Eine verbindliche Markenfarbwelt
// existiert noch nicht"). Die endgueltigen Tokens werden in C2 festgelegt.

:root {
  /* Farben – Platzhalter, Kontrast in C2 gegen WCAG 2.1 AA pruefen */
  --farbe-primaer:        #0b6b3a;
  --farbe-primaer-dunkel: #075129;
  --farbe-hintergrund:    #ffffff;
  --farbe-text:           #121212;
  --farbe-warnung:        #b3261e;   /* Balken unter Mindestanzahl (A10) */
  --farbe-erfolg:         #0b6b3a;   /* Balken ab Mindestanzahl (A10) */

  /* Typografie – gross genug fuer Sonnenlicht (DESIGN.md) */
  --schrift-basis: 1.125rem;   /* 18 px */
  --schrift-klein: 1rem;
  --schrift-gross: 1.5rem;

  /* Abstaende */
  --abstand-xs: 0.25rem;
  --abstand-s:  0.5rem;
  --abstand-m:  1rem;
  --abstand-l:  1.5rem;
  --abstand-xl: 2rem;

  /* Tap-Ziele – Mindestmass aus DESIGN.md (WCAG 2.1 AA) */
  --tapziel-min: 44px;

  --radius-m: 0.5rem;

  /* Safe-Area des Vollbildmodus (A25a).
     Wirkt nur, wenn index.html viewport-fit=cover setzt – siehe 5.4. */
  --sicher-oben:   env(safe-area-inset-top, 0px);
  --sicher-unten:  env(safe-area-inset-bottom, 0px);
  --sicher-links:  env(safe-area-inset-left, 0px);
  --sicher-rechts: env(safe-area-inset-right, 0px);
}
```

**Warum CSS-Custom-Properties und nicht Sass-Variablen?** Sass-Variablen werden zur Bauzeit aufgelöst;
`env()` und ein späterer Dunkelmodus brauchen Laufzeitwerte. Sass-Variablen bleiben für Dinge sinnvoll,
die in Berechnungen eingehen (Rasterbreiten, Breakpoints) – die kommen in C2 dazu.

### 5.2 Globaler Einstiegspunkt

```scss
// src/styles/global.scss
@use 'globalVars';
@use 'reset';

html {
  box-sizing: border-box;
  font-size: 100%;                     /* Systemschriftgroesse respektieren */
}
*, *::before, *::after { box-sizing: inherit; }

body {
  margin: 0;
  min-height: 100dvh;                  /* nicht 100vh: sonst schneidet die Browserleiste ab */
  background: var(--farbe-hintergrund);
  color: var(--farbe-text);
  font-size: var(--schrift-basis);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

In `main.tsx` wird ausschliesslich `global.scss` importiert. Jede Komponente bringt ab C2 ihre eigene
`<Name>.module.scss` mit und bindet sie über `@use '@/styles/globalVars';`.

**`@use` statt `@import`** ist Vorgabe (`AGENT_CLIENT.md`) und sachlich richtig: `@import` ist
abgekündigt und fügt Dateien bei jedem Vorkommen erneut ein.

### 5.3 Konvention für Komponenten-Styles

```scss
// Beispiel: src/komponenten/Schaltflaeche/Schaltflaeche.module.scss
@use '@/styles/globalVars';   // nur Variablen, keine Ausgabe

.schaltflaeche {
  --hoehe: var(--tapziel-min);   // lokale Variable direkt in der Datei (Vorgabe)
  min-height: var(--hoehe);
  min-width: var(--tapziel-min);
}
```

### 5.4 `index.html` korrigieren (B11)

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <!-- viewport-fit=cover ist Voraussetzung dafuer, dass env(safe-area-inset-*)
         im Modus standalone ueberhaupt Werte liefert (A25a). -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <!-- Muss mit manifest.theme_color uebereinstimmen (vite.config.ts) -->
    <meta name="theme-color" content="#0b6b3a" />
    <meta name="description" content="Teameinteilung und Terminverwaltung fuer die Trainingsgruppe." />
    <link rel="icon" href="/icons/pwa/app-icon-192.png" type="image/png" />
    <link rel="apple-touch-icon" href="/icons/pwa/apple-touch-icon.png" />
    <title>MONTAGS-KICKER</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Zum Titel.** Vorher standen `MONTAGS-KICKER` im Dokumenttitel und `FuBo – Teamgenerator` im
Manifest – zwei Namen für dieselbe Anwendung. Im Vollbildmodus zeigt das Betriebssystem den
Manifest-Namen, im Browser den Dokumenttitel. **Entschieden am 25.09.2026: `MONTAGS-KICKER`**, an
beiden Stellen und auch als `short_name`. „FuBo" bleibt Projekt- und Repositoriumsname und erscheint
nicht in der Oberfläche.

> **Offener Punkt, rein kosmetisch:** Startbildschirme kürzen den `short_name` nach rund zwölf
> Zeichen. `MONTAGS-KICKER` hat vierzehn und erscheint dort abgeschnitten. Wer das nicht möchte, setzt
> für `short_name` eine Kurzform ein; der `name` bleibt davon unberührt.

**Die doppelte Farbangabe** (`theme-color` im HTML, `theme_color` im Manifest, `--farbe-primaer` im
SCSS) ist bewusst in Kauf genommen: `vite.config.ts` kann keine SCSS-Datei lesen. Der Kommentar an
beiden Stellen ist die Absicherung; ein Generierungsschritt für drei Zeilen wäre unverhältnismässig.

---

## 6. Routing und Layout

### 6.1 Entscheidung: React Router

| Kriterium | React Router 7 | TanStack Router |
|---|---|---|
| Typisierte Routen | nein (ohne Zusatzschritt) | ja, generiert |
| Zusätzlicher Bauschritt | nein | ja (Routenbaum-Generator) |
| Verbreitung, Materiallage | sehr hoch | geringer |
| Passung zu TanStack Query | gut | sehr gut |

**Gewählt: React Router 7.** Bei rund 15 Routen und ausschliesslich einfachen Parametern (`terminId`)
wiegt die typisierte Route den zusätzlichen Generierungsschritt nicht auf. Die Vorgaben nennen keinen
Router; die Entscheidung ist damit frei und wird hier festgehalten, damit sie nicht in C3 erneut
aufkommt.

### 6.2 Routenbaum (Gerüst)

```tsx
// src/app/routen.tsx
import { createBrowserRouter } from 'react-router'
import AppLayout from '@/layouts/AppLayout/AppLayout'

/** Routenbaum der Anwendung. Die Seiten werden ab C3 gefuellt. */
export const routen = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true,          element: <div>Start</div> },
      { path: 'anmelden',     element: <div>Anmeldung</div> },        // C3
      { path: 'termine/:terminId', element: <div>Termin</div> },      // C5
      { path: 'teams/:terminId',   element: <div>Teams</div> },       // C6
      { path: 'einstellungen',     element: <div>Einstellungen</div> },// C8
      { path: 'admin',        element: <div>Administration</div> },   // C7
      { path: '*',            element: <div>Seite nicht gefunden</div> },
    ],
  },
])
```

**Warum schon jetzt Platzhalter statt einer einzigen Route?** Der Routenbaum ist die Landkarte des
Pakets C1 bis C8. Er kostet hier zwanzig Zeilen und beantwortet später jede Frage nach dem Ablageort
einer Ansicht.

### 6.3 `AppLayout` mit Zurück-Navigation und Safe-Area

```tsx
// src/layouts/AppLayout/AppLayout.tsx
import { Outlet, useLocation, useNavigate } from 'react-router'
import stile from './AppLayout.module.scss'

/**
 * Rahmen aller Ansichten. Stellt die sichtbare Zurueck-Navigation bereit,
 * die im Anzeigemodus "standalone" an die Stelle der fehlenden
 * Browser-Schaltflaeche tritt (A25a).
 */
export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const istStartseite = pathname === '/'

  return (
    <div className={stile.rahmen}>
      <header className={stile.kopf}>
        {!istStartseite && (
          <button
            type="button"
            className={stile.zurueck}
            onClick={() => navigate(-1)}
            aria-label="Zurueck"
            data-testid="layout-zurueck"
          >
            Zurueck
          </button>
        )}
      </header>

      <main className={stile.inhalt}>
        <Outlet />
      </main>
    </div>
  )
}
```

```scss
// src/layouts/AppLayout/AppLayout.module.scss
@use '@/styles/globalVars';

.rahmen {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  /* Safe-Area: ohne diese Zeilen liegt der Inhalt im Vollbildmodus
     unter Notch und Home-Indicator (A25a). */
  padding-top:    var(--sicher-oben);
  padding-bottom: var(--sicher-unten);
  padding-left:   var(--sicher-links);
  padding-right:  var(--sicher-rechts);
}

.kopf {
  display: flex;
  align-items: center;
  min-height: var(--tapziel-min);
  padding: var(--abstand-s) var(--abstand-m);
}

.zurueck {
  min-height: var(--tapziel-min);
  min-width:  var(--tapziel-min);
}

.inhalt {
  flex: 1;
  padding: var(--abstand-m);
  /* Reserve fuer die primaeren Aktionen in Daumenreichweite (A2);
     der konkrete Aktionsbereich entsteht in C2. */
  padding-bottom: calc(var(--abstand-xl) + var(--sicher-unten));
}
```

Beachte: `data-testid` an jedem bedienbaren Element ist Vorgabe (`AGENT_CLIENT.md`,
Implementierungs-Richtlinien) und gilt ab der ersten Zeile, nicht erst in C9.

**Zu `navigate(-1)`:** Der Verlaufsschritt zurück genügt als Gerüst. Ob einzelne Ansichten stattdessen
ein festes Ziel brauchen (etwa „zurück zum Dashboard" nach dem Ergebniseintrag), entscheidet sich je
Ansicht ab C5; die Schaltfläche nimmt dafür später eine optionale Ziel-Eigenschaft auf.

---

## 7. TanStack Query einrichten

```tsx
// src/app/QueryProvider.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/**
 * Stellt den Query-Client bereit. Die Vorgaben sind bewusst zurueckhaltend:
 * der Server ist die Autoritaet, der Client haelt Daten nur kurz.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30 s: kurz genug fuer Zu-/Absagen, lang genug gegen Flattern
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true, // Rueckkehr aus dem Hintergrund soll aktuelle Daten zeigen
      retry: 1,                   // 401/403 duerfen nicht wiederholt werden – Feinsteuerung in C1
    },
    mutations: { retry: 0 },      // keine fachliche Aktion doppelt absenden (A21: erster Eintrag gilt)
  },
})

export default function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

**`retry: 0` bei Mutationen ist nicht Bequemlichkeit, sondern fachlich geboten.** A21 legt fest, dass
der zuerst eingetragene Ergebniseintrag gilt; A15 zählt Generierungsläufe gegen ein Kontingent. Ein
automatischer zweiter Versuch nach einem Zeitüberschreitungsfehler verbrauchte stillschweigend ein
Kontingent oder erzeugte einen Eintrag, den der Nutzer nicht mehr ändern kann.

Die endgültige Fehlerbehandlung (kein Wiederholen bei `401`/`403`/`409`, globaler Auto-Logout) gehört
zu C1, weil sie die Fehlertypen aus dem Kontrakt voraussetzt.

```tsx
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import QueryProvider from '@/app/QueryProvider'
import { routen } from '@/app/routen'
import '@/styles/global.scss'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider>
      <RouterProvider router={routen} />
    </QueryProvider>
  </StrictMode>,
)
```

---

## 8. PWA-Grundkonfiguration

### 8.1 Entscheidung: `injectManifest` statt `generateSW` (B4)

A25 verlangt einen Service Worker, der `push`- und `notificationclick`-Ereignisse selbst behandelt und
aus `typ`, `terminId`, `datum` und `uhrzeit` eine eigene Formulierung baut – mit Rückfall auf den
Servertext. Der von `generateSW` erzeugte Worker nimmt keinen eigenen Code auf.

| Weg | Bewertung |
|---|---|
| `generateSW` + `workbox.importScripts: ['push.js']` | Möglich, aber die Push-Logik läge als nicht übersetzte, nicht typisierte, nicht gebündelte Datei neben dem Rest. |
| **`injectManifest` mit eigenem `src/sw.ts`** | Gewählt. Der Worker ist normaler TypeScript-Code, wird mitgebaut, mitgeprüft und ist in Vitest wenigstens in Teilen prüfbar. |

Der Preis ist überschaubar: eine zusätzliche `tsconfig` (Schritt 3.4) und zwei Workbox-Pakete
(Schritt 2.2). Beides fällt jetzt an oder später als Umbau.

### 8.2 Service Worker – Gerüst

```ts
// src/sw.ts
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// App-Shell vorhalten (JS, CSS, HTML). API-Antworten werden bewusst NICHT
// zwischengespeichert (AGENT_CLIENT.md): der Cache Storage ueberlebt den Logout
// und ist von jedem Skript des Origins lesbar.
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Navigationen auf die App-Shell zurueckfallen lassen, /api/ jedoch nie.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)

// registerType: 'prompt' – die Seite entscheidet, wann aktualisiert wird (A21).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// In C8 kommen hier die Ereignisse 'push' und 'notificationclick' dazu (A25b).
```

**Es gibt bewusst keine `runtimeCaching`-Regel.** „`NetworkOnly` für `/api/v1/*`" wird nicht durch eine
Regel erreicht, sondern durch das Fehlen jeder Regel: Eine Anfrage, auf die der Service Worker nicht
antwortet, geht unverändert ins Netz. Hinzu kommt, dass die API produktiv unter `api.<domain>` liegt –
ein anderer Origin, den die Routen dieses Workers ohnehin nicht erfassen. Die Zeile ist trotzdem
wichtig als Merkposten: Wer hier später eine Caching-Regel ergänzt, verletzt die Architekturregel.

### 8.3 Manifest korrigieren (B5, B6, B7)

Zuerst die fehlende maskierbare Ikone erzeugen. Eine maskierbare Ikone braucht einen Sicherheitsbereich:
Das Motiv muss innerhalb der inneren 80 % liegen, sonst schneidet Android es an.

```bash
npm install -D @vite-pwa/assets-generator
npx pwa-assets-generator --preset minimal-2023 public/icons/pwa/app-icon-512.png
```

Alternativ von Hand: `app-icon-512-maskable.png`, 512×512, Motiv auf rund 80 % skaliert und mittig
platziert, Hintergrund `#0b6b3a`.

```ts
// vite.config.ts – manifest.icons ersetzen
icons: [
  { src: 'icons/pwa/app-icon-192.png',          sizes: '192x192', type: 'image/png' },
  { src: 'icons/pwa/app-icon-512.png',          sizes: '512x512', type: 'image/png' },
  { src: 'icons/pwa/app-icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  { src: 'icons/pwa/apple-touch-icon.png',      sizes: '180x180', type: 'image/png' },
],
```

**Drei Korrekturen auf einmal:**

1. Die 512er-Ikone erscheint jetzt ohne `purpose` (= `any`) **und** zusätzlich als eigene maskierbare
   Datei. Vorher war sie ausschliesslich `maskable`; Chrome zählt eine rein maskierbare Ikone für die
   Installierbarkeit nicht mit, und `beforeinstallprompt` feuert dann **stillschweigend nicht** – der
   Installationshinweis aus A25a käme nie.
2. Die Einträge für 48, 72 und 96 Pixel entfallen. Die Dateien sind real 48×43, 72×65 und 96×86; eine
   falsch deklarierte Grösse verwirft der Browser. Vier korrekte Einträge sind mehr wert als elf, von
   denen drei falsch sind. Die übrigen Dateien bleiben im Ordner, falls sie anderswo gebraucht werden.
3. `includeAssets: ['favicon.svg', ...]` nennt eine nicht existierende Datei – siehe 8.4.

### 8.4 Precache eingrenzen (B8)

```ts
injectManifest: {
  globPatterns: ['**/*.{js,css,html,woff2}'],
},
includeAssets: ['icons/no_connection_icon.svg'],
includeManifestIcons: false,
```

**`includeManifestIcons: false` ist der entscheidende Teil.** Das enge `globPatterns` allein genügt
nicht: `vite-plugin-pwa` nimmt die Manifest-Ikonen von sich aus in den Precache auf. Ohne diese Zeile
standen sie trotz des Musters in `sw.js` – zehn Einträge statt sechs. Nachgemessen: mit der Zeile
bleiben genau die App-Shell und die Offline-Ikone übrig.

**Begründung.** Das bisherige Muster zieht alle elf PWA-Ikonen (rund 1,1 MB, allein `app-icon-700.png`
482 kB) und dreissig UI-SVGs in den Precache. Die Manifest-Ikonen liest das Betriebssystem beim
Installieren aus dem Manifest, nicht die laufende Anwendung – sie gehören dort nicht hinein. Jede Datei
im Precache wird bei jeder Aktualisierung erneut geprüft; auf einem Mobilfunkanschluss am Spielfeldrand
ist das spürbar.

`no_connection_icon.svg` ist ausdrücklich für die Offline-Hinweisseite vorgesehen
(`AGENT_CLIENT.md`) und muss verfügbar sein, wenn keine Verbindung besteht. Die übrigen UI-Ikonen
werden ab C2 als Modul importiert und landen dadurch von selbst im gebündelten Ergebnis.

### 8.5 Vollständiger PWA-Abschnitt in `vite.config.ts` (B9)

```ts
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  registerType: 'prompt',   // kein autoUpdate: ein Neuladen mitten in der
                            // Ergebniserfassung waere nicht rueckholbar (A21)
  injectRegister: false,    // Registrierung uebernimmt useRegisterSW in der Anwendung
  includeAssets: ['icons/no_connection_icon.svg'],
  includeManifestIcons: false,   // sonst landen die Ikonen trotz globPatterns im Precache
  manifest: {
    name: 'MONTAGS-KICKER',
    short_name: 'MONTAGS-KICKER',
    description: 'Teameinteilung und Terminverwaltung fuer die Trainingsgruppe.',
    lang: 'de',
    dir: 'ltr',
    display: 'standalone',
    start_url: '/',
    scope: '/',
    background_color: '#ffffff',
    theme_color: '#0b6b3a',   // muss zu <meta name="theme-color"> passen
    icons: [ /* siehe 8.3 */ ],
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,woff2}'],
  },
  devOptions: {
    enabled: true,            // Service Worker auch unter npm run dev pruefbar
    type: 'module',
    navigateFallback: 'index.html',
  },
}),
```

Entfallen sind `workbox: { ... }` (bei `injectManifest` wirkungslos), `runtimeCaching: []` und die
Zeile `navigateFallbackDenylist` samt ihrem irreführenden Kommentar. Die Denylist steuert **nur** den
Navigations-Rückfall und nie das Caching; sie steht jetzt dort, wo sie hingehört – in `sw.ts`
(Schritt 8.2).

`scope: '/'` ist ergänzt, damit der Geltungsbereich ausdrücklich dokumentiert ist und nicht aus
`start_url` abgeleitet werden muss.

### 8.6 Aktualisierungshinweis (Gerüst)

```tsx
// src/komponenten/AktualisierungsHinweis/AktualisierungsHinweis.tsx
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Zeigt einen unaufdringlichen Hinweis, sobald eine neue Fassung bereitsteht.
 * Der Neuladevorgang bleibt beim Nutzer (registerType: 'prompt', A21).
 */
export default function AktualisierungsHinweis() {
  const {
    needRefresh: [aktualisierungNoetig],
    updateServiceWorker,
  } = useRegisterSW()

  if (!aktualisierungNoetig) return null

  return (
    <div role="status" data-testid="aktualisierung-hinweis">
      <span>Neue Version verfuegbar.</span>
      <button type="button" onClick={() => void updateServiceWorker(true)} data-testid="aktualisierung-neuladen">
        Jetzt laden
      </button>
    </div>
  )
}
```

Die Komponente wird in `AppLayout` eingehängt. Ihre Gestaltung kommt in C2; hier geht es darum, dass
`virtual:pwa-register/react` übersetzt – das ist zugleich der Nachweis, dass Schritt 3.2 gewirkt hat.

---

## 9. Auslieferung: Cloudflare Pages (B10)

Beide Dateien liegen in `public/` und werden dadurch unverändert nach `dist/` kopiert.

```
# public/_headers
/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

```
# public/_redirects
# Die SPA-Rueckfallregel darf sw.js, Manifest und Icons nicht erfassen (A25).
/sw.js                  /sw.js                  200
/manifest.webmanifest   /manifest.webmanifest   200
/icons/*                /icons/:splat           200
/*                      /index.html             200
```

**Zur Begründung.** Ein langlebiger Cache vor `sw.js` verzögert jede Aktualisierung um die Cache-Dauer;
`index.html` gehört aus demselben Grund dazu, weil es auf die versionierten Bundles verweist. Die
Dateien unter `/assets/` tragen dagegen einen Hash im Namen und dürfen dauerhaft gehalten werden.

Die drei ausdrücklichen `200`-Regeln vor dem Auffangmuster sind Absicherung: Würde `sw.js` über die
SPA-Regel als HTML ausgeliefert, scheiterte die Registrierung am Content-Type – und zwar ohne
Fehlermeldung in der Oberfläche. Ob Cloudflare Pages vorhandene Dateien ohnehin vorrangig ausliefert,
spielt dann keine Rolle mehr; die Regeln kosten nichts und schliessen den Fall aus.

**Zwei Punkte, die nicht im Repository stehen, aber zu C0 gehören** (in
`CONTEXT_HANDOFF_CLIENT.md` zu vermerken):

- **Rocket Loader und Auto-Minify** für die Domain abschalten. Rocket Loader verschiebt die
  Skriptausführung und bricht die Registrierung des Service Workers.
- **Die Adresse wird erst verteilt, wenn sie endgültig ist.** Eine PWA ist an ihren Origin gebunden.
  Wer von `*.pages.dev` installiert und später `app.<domain>` erhält, hat zwei getrennte Anwendungen
  auf dem Gerät. Hinzu kommt: `pages.dev` steht auf der Public Suffix List und wäre gegenüber
  `api.<domain>` **cross-site** – das Sitzungs-Cookie mit `SameSite=Lax` würde nicht mitgesendet und
  die Anmeldung schlüge produktiv fehl. Unter `app.<domain>` gegen `api.<domain>` ist es same-site und
  funktioniert.

Das tatsächliche Anlegen des Pages-Projekts und die Domainbindung gehören zu C9.

---

## 10. Umgebungsvariablen und Dev-Proxy

### 10.1 Basisadresse der API

```
# .env.example  (eingecheckt)
# Basis der API. In der Entwicklung relativ, damit der Vite-Proxy greift (siehe vite.config.ts).
# Produktiv in den Build-Einstellungen von Cloudflare Pages setzen:
#   VITE_API_BASE_URL=https://api.<domain>/api/v1
VITE_API_BASE_URL=/api/v1
```

```
# .env.local  (NICHT eingecheckt, lokal anzulegen)
VITE_API_BASE_URL=/api/v1
```

### 10.2 `.gitignore` anpassen (B13)

```gitignore
# Environment Variables
.env
.env.*
!.env.example
```

Ohne die Ausnahme liesse sich die Beispieldatei nicht einchecken – und genau sie ist die einzige, die
eingecheckt werden **soll**.

### 10.3 Dev-Proxy

```ts
// vite.config.ts – ergaenzen
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
    },
  },
},
```

**Warum ein Proxy, obwohl der Server in der Entwicklung `cookie-secure=false` fährt?** Über den Proxy
laufen Anwendung und API in der Entwicklung unter demselben Origin. Damit entfallen CORS-Vorabanfragen
komplett, `credentials: 'include'` verhält sich wie produktiv, und die Denylist `/^\/api\//` im Service
Worker ist überhaupt erst prüfbar – ohne Proxy zeigte sich ein Fehler dort erst im Betrieb. Die
Zieladresse `http://localhost:8080` stammt aus `fubo-api.json` (Server-Eintrag „Lokale Entwicklung").

---

## 11. Testwerkzeuge einrichten

Die Werkzeuge werden **jetzt** aufgesetzt, die Tests entstehen **in den jeweiligen Paketen**. Tests, die
erst am Ende geschrieben werden, sind ein eigenes Projekt und kein Sicherheitsnetz.

### 11.1 Vitest

```ts
// vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config'
// Mit Erweiterung: tsconfig.node.json faehrt `module: nodenext`, dort verlangt ein
// relativer Import den Dateinamen vollstaendig. `allowImportingTsExtensions` erlaubt ihn.
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,                       // CSS-Modules-Klassennamen in Tests aufloesen
      exclude: ['node_modules', 'dist', 'e2e'],
    },
  }),
)
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest'
```

`vitest.config.ts` gehört in `tsconfig.node.json` unter `include`, sonst wird sie nicht geprüft:

```jsonc
// tsconfig.node.json
"include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
```

Ein Rauchtest, der belegt, dass Router, Provider und Layout zusammenspielen:

```tsx
// src/layouts/AppLayout/AppLayout.test.tsx
import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import AppLayout from './AppLayout'

/** Auf der Startseite gibt es nichts, wohin zurueckzugehen waere. */
test('zeigt auf der Startseite keine Zurueck-Schaltflaeche', () => {
  const router = createMemoryRouter(
    [{ path: '/', element: <AppLayout />, children: [{ index: true, element: <p>Start</p> }] }],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  expect(screen.queryByTestId('layout-zurueck')).not.toBeInTheDocument()
})
```

### 11.2 Playwright

Die Konfiguration steht in `playwright.config.ts`, die Tests in `e2e/`. Drei Entscheidungen darin
lohnen eine Begründung, weil sie sonst wie Willkür aussehen.

**Gegen die gebaute Fassung, nicht gegen den Entwicklungsserver.** `webServer` ruft
`npm run build && npm run preview` auf. Service Worker, Precache und Manifest verhalten sich nur dort
wie im Betrieb.

**Acht Geräteprojekte statt eines.** Ein Deskriptor setzt Viewport, User-Agent, Touch und Pixeldichte –
und `defaultBrowserType`. Bei allen iPhone- und iPad-Einträgen steht dort `webkit`, Playwright startet
also seinen WebKit-Build (nicht Safari). Vor dem ersten Lauf deshalb:

```bash
npm run e2e:browser        # playwright install chromium webkit
```

Die Projekte sind nach Breite aufsteigend sortiert, das schmalste zuerst (360 px, `Galaxy S24`): Dort
brechen Tap-Ziele und Beschriftungen als Erstes. Firefox scheidet aus – Playwright dokumentiert
`isMobile` ausdrücklich als „not supported in Firefox".

*Gemessen am 26.09.2026:* Die vier breitesten Projekte (`iPad Mini`, `iPad Pro 11`,
`iPad (gen 11) landscape`, `Desktop Chrome`) rendern **dieselbe** Inhaltsbreite von 768 px, weil
`.inhalt` bei `max-width: 48rem` deckelt. Sie unterscheiden sich derzeit nur im Weissraum daneben und
werden erst aussagekräftig, wenn das Design-System echte Breakpoints einführt.

**Zwei Testdateien statt einer.** `pwa.spec.ts` braucht Service Worker, und die unterstützt Playwright
nur in Chromium – die Typdefinitionen halten das ausdrücklich fest. Alle WebKit-Projekte lassen die
Datei deshalb über `testIgnore: /\.pwa\.spec\.ts$/` aus. Ohne diese Trennung wären die PWA-Tests in
fünf von acht Projekten rot, ohne dass etwas kaputt ist. `layout.spec.ts` läuft überall und prüft, was
sich mit der Breite tatsächlich ändert: Rahmen, Zurück-Navigation, Tap-Ziel von 44×44 px, kein
waagerechtes Scrollen und der Verbrauch der Safe-Area-Tokens.

**Was auch mit iPhone-Projekten nicht prüfbar bleibt:** `beforeinstallprompt` gibt es nur in Chromium;
Web Push auf iOS setzt „Zum Home-Bildschirm" voraus und ist mit Playwright grundsätzlich nicht
erreichbar; `env(safe-area-inset-*)` bleibt unter Emulation null. Diese drei bleiben Handprüfungen
(Abnahmepunkte 10 und 11).

### 11.3 Typprüfung der E2E-Dateien

`tsconfig.app.json` erfasst nur `src`, `tsconfig.node.json` nur die drei Konfigurationsdateien – die
Tests unter `e2e/` lagen damit **ausserhalb jeder Typprüfung**, und ein Fehler dort wäre erst beim
Testlauf aufgefallen. Dafür gibt es `tsconfig.e2e.json`:

```jsonc
{
  "extends": "./tsconfig.node.json",
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "lib": ["ES2023", "DOM", "DOM.Iterable"]
  },
  "include": ["e2e"]
}
```

Die Rückrufe von `page.evaluate()` laufen im Browser und brauchen DOM-Typen, der Testlauf selbst
dagegen Node. Deshalb ein eigenes Teilprojekt, statt `DOM` in `tsconfig.node.json` aufzunehmen, wo es
für `vite.config.ts` nichts zu suchen hat. Der Verweis gehört in `tsconfig.json` – sonst wird die
Datei nie gelesen.

## 12. npm-Skripte und CI

### 12.1 Skripte

```jsonc
"scripts": {
  "dev":        "vite",
  "build":      "tsc -b && vite build",
  "preview":    "vite preview --port 4173",
  "lint":       "eslint .",
  "typecheck":  "tsc -b --force",
  "test":       "vitest run",
  "test:watch": "vitest",
  "test:e2e":   "playwright test",
  "e2e:browser": "playwright install chromium webkit"
}
```

### 12.2 ESLint um den Service Worker ergänzen

```js
// eslint.config.js – ergaenzen
{
  files: ['src/sw.ts'],
  languageOptions: { globals: globals.serviceworker },
},
{
  files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
  languageOptions: { globals: { ...globals.browser, ...globals.node } },
},
```

Zusätzlich `globalIgnores(['dist', 'dev-dist', 'playwright-report', 'coverage'])` – `dev-dist` entsteht
durch `devOptions.enabled: true`.

### 12.3 CI

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [dev_client]
  pull_request:

jobs:
  pruefen:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```

**End-to-End-Tests laufen bewusst nicht in CI**, solange kein Server erreichbar ist. Sie kommen in C9
dazu, dann gegen die Mock-Schicht aus C1.

### 12.4 `dev-dist` ignorieren

```gitignore
dev-dist
playwright-report
test-results
coverage
```

---

## 13. Abnahme von C0

**Stand vom 25.09.2026.** Die Punkte 1 bis 6 wurden bereits in einer sauberen Linux-Umgebung gegen
einen frischen `npm install` gefahren und sind grün: Typprüfung ohne Befund, ESLint ohne Befund, zwei
Komponententests, ein vollständiger Bau (`dist/sw.js` mit sechs Precache-Einträgen, Manifest mit vier
Ikonen) und **21 End-to-End-Tests über die drei Chromium-Projekte**, darunter die tatsächliche
Registrierung des Service Workers und die Prüfung, dass `sw.js` mit JavaScript-Inhaltstyp ausgeliefert
wird. **Die fünf WebKit-Projekte sind dabei nicht gelaufen** – der WebKit-Download war in der
Prüfumgebung durch die Netzrichtlinie gesperrt.

**Was das nicht ersetzt:** Auf dem Entwicklungsrechner ist zuerst **`npm install`** auszuführen –
`package.json` und `package-lock.json` haben neue Abhängigkeiten bekommen, und die plattformabhängigen
Rolldown-Bindungen müssen für macOS aufgelöst werden. Danach sind die Punkte 7 bis 13 dort
abzuarbeiten; sie brauchen einen Browser und ein Gerät und lassen sich nicht stellvertretend prüfen.

| # | Prüfung | Erwartet |
|---|---|---|
| 1 | `npm ci` | läuft durch |
| 2 | `npm run typecheck` | Exitcode 0 |
| 3 | `npm run lint` | keine Fehler |
| 4 | `npm run build` | erzeugt `dist/` mit `sw.js`, `manifest.webmanifest`, `_headers`, `_redirects` |
| 5 | `npm test` | Rauchtest grün |
| 6 | `npm run test:e2e` | Test aus 11.2 grün |
| 7 | `npm run dev`, Browser auf `localhost:5173` | Grundgerüst lädt, keine Konsolenfehler |
| 8 | Entwicklerwerkzeuge → Anwendung → Service Workers | ein Worker mit Geltungsbereich `/` ist registriert |
| 9 | Entwicklerwerkzeuge → Anwendung → Manifest | Name, `display: standalone`, keine Ikonen-Warnung |
| 10 | Lighthouse → „Installable" | erfüllt (prüft B5 und B7 unmittelbar) |
| 11 | `viewport-fit=cover` auf einem **echten** iPhone im Modus „Zum Home-Bildschirm" | Inhalt liegt nicht unter Notch und Home-Indicator (siehe Kasten unter der Tabelle) |
| 12 | `git grep -nE "(FuBo-Client|1126px|aa3bff|react\.svg)"` | keine Treffer ausser in Dokumentation |
| 13 | `git status` vor dem Commit | weder `.env` noch `.env.local` erfasst |

**Zu Prüfpunkt 11 – Korrektur vom 26.09.2026.** Hier stand zuvor „in der iPhone-Geräteansicht muss
`padding-bottom` ungleich 0 sein". **Das ist falsch.** Nachgemessen: Mit dem Deskriptor `iPhone 17`
liefert die Seite `env(safe-area-inset-*)` als `0px / 0px / 0px / 0px`, und der Rahmen bekommt
entsprechend `padding-bottom: 0px`. Geräteemulation bildet keine Notch ab – weder in Playwright noch
in der Geräteansicht des Browsers.

Was daraus folgt, ist eine Zweiteilung:

- **Automatisiert prüfbar** ist, ob das Layout die Tokens überhaupt verbraucht. Der Test in
  `e2e/layout.spec.ts` setzt `--sicher-oben` und `--sicher-unten` selbst und erwartet sie im
  berechneten Innenabstand wieder. Das fängt die Regression, die realistisch passiert: dass jemand die
  Variable aus dem Layout entfernt.
- **Nicht automatisierbar** ist der tatsächliche Wert. Er kommt vom Betriebssystem und verlangt ein
  echtes Gerät mit abgelegter Anwendung. Das bleibt Prüfpunkt 11.

Ergänzend die in `AGENT_CLIENT.md` verlangte **kurze visuelle Verifikation**: Das Grundgerüst auf einem
echten Mobilgerät öffnen und prüfen, dass die Zurück-Schaltfläche das Mindestmass von 44×44 px
erreicht. Automatisiert deckt das inzwischen ebenfalls ein Test in `e2e/layout.spec.ts` ab.

---

## 14. Nachdokumentation und Commit

Nach der Abnahme:

1. `client/harness/CONTEXT_HANDOFF_CLIENT.md` fortschreiben – Abschnitt 5 (neuer Paketschnitt),
   Abschnitt 6 (Code-Zustand), Abschnitt 7 (nächste Schritte). Vorfassung zuvor unter
   `client/harness/archive/CONTEXT_HANDOFF_CLIENT_2026-09-25.md` ablegen.
2. `client/harness/AGENT_CLIENT.md` um die in C0 getroffenen Festlegungen ergänzen: React Router,
   `injectManifest`, Ordner- und Token-Konventionen, `VITE_API_BASE_URL`.
3. `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) nachziehen – Abschnitt 4 „Client".
   Der Ordner liegt ausserhalb des Repositories und wird nicht mitcommittet.
4. Commit auf `dev_client`. **Nicht nach `main`.**

```bash
git add -A
git status            # letzte Sichtpruefung: keine .env, keine realen Namen
git commit -m "C0: Projektfundament – tsconfig, Routing, SCSS, PWA-Basis, Tests, CI"
git push origin dev_client
```

**Entschieden am 25.09.2026:** `client/harness/tmp/` wird **nicht** mitversioniert. Der Eintrag
`harness/tmp/` steht in `.gitignore`. Die Arbeitsdokumente bleiben damit lokal; das Repository ist
öffentlich, und ein Arbeitsdokument, das niemand ausserhalb braucht, gehört nicht in seine Historie.

---

## 15. Ausblick C1

C1 („Vertrag, Datenzugriff und Mocks") baut unmittelbar auf C0 auf:

- `openapi-typescript` gegen `harness/assets/fubo-api.json`, Generat unter `src/api/schema.d.ts`
  **einchecken** (Vorgabe aus `CONTEXT_HANDOFF.md`, Abschnitt 5) und ein npm-Skript zum Auffrischen.
- Ein `fetch`-Wrapper mit `credentials: 'include'`, der `ProblemDetail` auswertet: `detail` ist bereits
  deutschsprachig, `code` steuert die Behandlung (34 Werte in `Fehlercode`).
- Globale `401`-Behandlung: Query-Cache leeren, zur Anmeldung navigieren – die Stelle, an der
  `retry: 1` aus Schritt 7 präzisiert wird.
- Mock-Schicht (MSW) gegen den Kontrakt. Sie ist **nicht optional**, auch wenn der Server fachlich
  fertig ist (S0 bis S8): Ausgeliefert ist er noch nicht – S9, Härtung und Deployment, steht aus. Bis
  dahin gibt es ausser einer lokal gestarteten Instanz keine erreichbare API, und die End-to-End-Tests
  in CI brauchen ohnehin ein Gegenüber, das nicht vom Betrieb abhängt.
- Offline-Erkennung (`navigator.onLine` plus Ereignisse) und der global sichtbare Hinweis, dass die
  Anwendung eine Verbindung braucht (`AGENT_CLIENT.md`).

---

## 16. Abweichungen bei der Umsetzung (25.09.2026)

Vier Punkte liefen anders als in dieser Anleitung beschrieben. Alle vier sind oben eingearbeitet; sie
stehen hier gesammelt, weil jeder von ihnen beim nächsten Setup wieder auftreten würde.

**1. `baseUrl` ist seit TypeScript 6 abgekündigt.** Schritt 4.3 nannte ursprünglich
`"baseUrl": "."` neben `paths`. Der Übersetzer bricht damit mit `TS5101` ab. Entfernt man nur
`baseUrl`, folgt `TS5090`: Ohne sie müssen die Ziele in `paths` relativ geschrieben werden, also
`["./src/*"]` statt `["src/*"]`. Die beiden Fehler treten nacheinander auf und sehen wie ein
Widerspruch aus; sie sind keiner.

**2. `mergeConfig` braucht den Dateinamen mit Erweiterung.** `vitest.config.ts` wird über
`tsconfig.node.json` geprüft, und das fährt `module: nodenext`. Dort scheitert
`import viteConfig from './vite.config'` an `TS2307`. Richtig ist `'./vite.config.ts'`;
`allowImportingTsExtensions` ist dafür bereits gesetzt.

**3. Ein enges `globPatterns` hält die Manifest-Ikonen nicht aus dem Precache.** `vite-plugin-pwa`
nimmt sie unabhängig davon auf. Erst `includeManifestIcons: false` bringt den Precache von zehn auf
sechs Einträge. Der ursprüngliche Befund B8 war richtig, die dort vorgeschlagene Massnahme allein
aber wirkungslos – ein Fall, in dem die Zahl im Bauprotokoll die Prüfung ist und nicht die Absicht
im Konfigurationstext.

**4. `queryClient` und `QueryProvider` gehören in getrennte Dateien.** In Schritt 7 standen beide in
einer Datei; ESLint meldet dafür `react-refresh/only-export-components`. Die Regel hat hier recht:
Eine Datei, die sowohl eine Komponente als auch einen Wert ausgibt, bricht das Hot-Reloading. Der
Client liegt jetzt in `src/app/queryClient.ts`, was ohnehin besser passt – die globale
`401`-Behandlung in C1 braucht direkten Zugriff darauf.

### Nachträge vom 26.09.2026 (Geräteprojekte in Playwright)

**5. Geräteemulation liefert keine Safe-Area-Insets.** Prüfpunkt 11 ging davon aus, dass die
iPhone-Geräteansicht `env(safe-area-inset-*)` setzt. Sie tut es nicht – nachgemessen: `0px` auf allen
vier Seiten. Der Prüfpunkt ist korrigiert, und `e2e/layout.spec.ts` prüft stattdessen, dass das
Layout die Tokens verbraucht.

**6. Die E2E-Dateien lagen ausserhalb jeder Typprüfung.** `npm run typecheck` erfasste `src` und die
drei Konfigurationsdateien, aber nicht `e2e/`. Behoben mit `tsconfig.e2e.json` (Abschnitt 11.3).

**7. Zwei der acht Projektnamen waren invertiert.** `android` hiess der breiteste Deskriptor
(`Pixel 10 Pro XL`, 448 px), `android-big` der **schmalste** im gesamten Satz (`Galaxy S24`, 360 px –
schmaler noch als das iPhone SE mit 375 px). Jetzt `android-breit` und `android-schmal`, und die
Projektliste ist nach Breite sortiert.

**8. Vier Projekte prüfen dieselbe Darstellung.** `iPad Mini`, `iPad Pro 11`,
`iPad (gen 11) landscape` und `Desktop Chrome` rendern alle eine Inhaltsbreite von 768 px, weil
`.inhalt` dort deckelt. Kein Fehler, aber vervierfachte Laufzeit für eine Aussage. Vermerkt als
Kommentar in der Konfiguration; sinnvoll werden sie mit den Breakpoints des Design-Systems.

**Nicht eingetreten, aber erwähnenswert:** Der Verdacht aus Befund B5 liess sich nicht unmittelbar
beweisen – ob `beforeinstallprompt` mit einer rein maskierbaren 512er-Ikone ausbleibt, zeigt erst
Lighthouse auf einem echten Gerät (Prüfpunkt 10). Die Korrektur ist trotzdem richtig: Eine
zusätzliche Ikone mit `purpose: 'any'` kostet nichts und nimmt die Frage aus dem Weg. Die maskierbare
Fassung wurde aus der vorhandenen 512er erzeugt, indem die Innenfläche des Rundquadrats
freigeschnitten und auf volle Kantenlänge skaliert wurde – so füllt der Spielfeldhintergrund die
ganze Fläche, und der weisse Rahmen des Originals liegt ausserhalb jeder Maske.

### Nachprüfung vom 26.09.2026

Der abgeschlossene Stand wurde gegen diese Anleitung und die Vorgaben geprüft; sechs Punkte wurden
korrigiert. Sie stehen vollständig in `client/harness/CONTEXT_HANDOFF_CLIENT.md`, Abschnitt 6.1, und
sind hier nur benannt, damit diese Anleitung nicht als letzter Stand missverstanden wird:

1. `npm ci` schlug fehl (`Missing: sass@1.103.1 from lock file`) – Folge des `npm uninstall sass` aus
   Schritt 2.3 und damit ein Fehler **dieser Anleitung**: Schritt 2.3 hätte ein `npm ci` in einem
   frischen Baum als Kontrolle verlangen müssen, nicht nur ein `npm install`.
2. `public/_headers` (Schritt 9) hatte keine Regel für die Wurzel `/`; die Regel für `/index.html`
   greift dort nicht, weil Cloudflare Pages den angefragten Pfad auswertet.
3. Der Manifest-`short_name` stand auf `FuBo` – jetzt `GUT-KICK`.
4. Zwei Stil-Importe hießen `stile` statt `style`.
5. Die Zurück-Schaltfläche war mit „Zurueck" beschriftet statt „Zurück".
6. `playwright.config.ts` führt **sieben** Projekte, nicht acht; die Unit-Tests sind neun, nicht zwei.
   Die Zahlen in Abschnitt 11.2, 13 und 16 dieser Datei sind entsprechend veraltet.

Die Anleitung für das Folgepaket liegt unter `C1_UMSETZUNG.md`.

**Offen und nur auf dem Entwicklungsrechner zu klären:** Ob `navigator.serviceWorker.getRegistration()`
im WebKit-Build von Playwright durchläuft, liess sich hier nicht prüfen – der WebKit-Download ist in
der Prüfumgebung durch die Netzrichtlinie gesperrt. Die PWA-Tests sind deshalb vorsorglich auf
Chromium-Projekte begrenzt. Sollte sich nach `npm run e2e:browser` zeigen, dass WebKit sie trägt,
genügt es, das `testIgnore` der iPhone-Projekte zu entfernen.
