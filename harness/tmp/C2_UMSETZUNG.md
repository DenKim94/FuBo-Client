# C2 – Design-System und Basis-Layout (Umsetzungsanleitung)

> Arbeitspaket **C2** (geschätzt 12 h). Massgeblich: `/PRJ_FuBo/harness/AGENT.md`,
> `client/harness/AGENT_CLIENT.md`, `/PRJ_FuBo/harness/assets/Design/DESIGN.md`.
> Referenz: `/PRJ_FuBo/harness/assets/Design/FuBo_Design_Prototypen.html` – Abweichungen zulässig.
>
> **Fassung vom 03.10.2026**, Stand Commit `7931d46` auf `dev_client`. Sie ersetzt die Fassung vom
> 26.09.2026 (Kopie: `C2_UMSETZUNG_2026-09-26.md` im selben Ordner). Gegenüber damals gilt:
> Ordnernamen sind englisch (`src/components/`, nicht `src/komponenten/`), mehrere Teile sind bereits
> umgesetzt – zum Teil vorgezogen in C3 –, und einige Vorgaben haben sich als falsch oder überholt
> erwiesen (Abschnitt 1.2). Erledigte Schritte sind hier nur noch zusammengefasst; massgeblich ist der Code.

---

## 0. Ziel und Abgrenzung

Nach C2 gibt es eine **Sprache**, in der jede Ansicht geschrieben wird: geprüfte Farbwelt als Tokens,
sichtbarer Fokus, Aktionsbereich in Daumenreichweite, Basis-Komponenten, Lade-, Leer- und
Fehlerzustand sowie die Nacharbeiten aus C0/C1 (Zurück-Ziel, Offline-Hinweis).

**Nicht Teil von C2:** fachliche Ansichten (C3 bis C8), der Sitzungsablauf-Dialog mit seiner
Fachlichkeit (C3 – **C2 baut den Dialog, C3 füllt ihn**), vollständige E2E-Suite und
Barrierefreiheitsabnahme (C9). Keine Komponente, die nur ein einziges Paket braucht (z. B. der
Skill-Regler, C7).

**Keine neuen Abhängigkeiten** – keine Komponentenbibliothek, kein `vite-plugin-svgr`, kein `clsx`,
keine Animationsbibliothek. Gilt weiterhin.

---

## 1. Stand am 03.10.2026

### 1.1 Schritte

| Abschnitt | Inhalt | Stand |
|---|---|---|
| 2 | Vorbereitung | **erledigt** |
| 3 | Farbwelt und Tokens | **erledigt** (27.09.) |
| 4 | Typografie, Abstände, Fokus | **erledigt** (27.09.) |
| 5 | Raster und Aktionsleiste | **erledigt** (27.09.) |
| 6 | Icons als CSS-Maske | **erledigt** (03.10.) – Komponente `Icon` |
| 7.1 | Schaltfläche | **erledigt** (03.10.) – `CustomButton` |
| 7.2 | Eingabefeld | **erledigt** (03.10.) – `Feld` |
| 7.3 | Auswahlliste | **erledigt, abweichend** (03.10.) – gestaltete Combobox statt `<select>` |
| 7.4 | Fortschrittsbalken | **erledigt** (03.10.) – `Fortschrittsbalken` |
| 7.5 | Erklärung (Info-Icon) | **erledigt** (03.10.) – `Erklaerung` |
| 7.6 | Dialog | **erledigt** (03.10.) – `Dialog`; E2E folgt mit dem Ablauf-Dialog (C3) |
| 7.7 | Lade-, Leer-, Fehlerzustand | **erledigt** (03.10.) – `Ladespinner`, `Leerzustand`, `Fehlerzustand`, dazu `Fehlermeldung` |
| 8.1 | Zurück-Navigation mit Zielangabe | **erledigt** (03.10.) – `handle.zurueck`, Direkteinstieg |
| 8.2 | Offline-Hinweis fertigstellen | **erledigt** (03.10.) |
| 8.3 | Falscher Rand aus C0 | **erledigt** (27.09.) |
| 9–11 | Tests, Abnahme, Nachdokumentation | **erledigt** bis auf Abnahme 5 (WebKit im CI), 10 und 11 (Handprüfungen) |

### 1.2 Korrekturen an der Fassung vom 26.09.2026

1. **`:focus-visible { border-radius: inherit }` ist falsch.** Die Eigenschaft setzt den Radius des
   Elements auf den des Elternteils (Zurück-Schaltfläche fiel von 8 px auf 0 px). Die Fokusregel steht
   ohne diese Zeile in `_reset.scss`, **nicht** zusätzlich in `global.scss`.
2. **`.gefahr { color: #fff }` verletzt die Hexwert-Regel.** Umgesetzt mit `--farbe-primaer-kontrast`.
3. **Feste `id` im Dialog** (`aria-labelledby="dialog-titel"`) erzeugt doppelte IDs, sobald zwei Dialoge
   im Baum stehen. Mit `useId` bauen (Abschnitt 4.2).
4. **Natives `<select>` (alte 7.3) ist verworfen** (Entscheidung des Entwicklers vom 03.10.2026): Dessen
   aufgeklappte Liste zeichnet das Betriebssystem, Farben und Schrift passen nicht zum Design.
5. **Der Helfer `klassen` (alte 7.0) existiert nicht.** Die Komponenten setzen Klassen mit
   `[…].filter(Boolean).join(' ')`. Bei weiterem Bedarf einen Ort im Ordnermuster festlegen, bevor er
   entsteht – `src/components/klassen.ts` wäre kein Komponentenordner.
6. **Namen:** `Schaltflaeche` heisst `CustomButton`, `Ikone` heisst `Icon`, Testhilfe für Hooks ist
   `src/test/QueryUmgebung.tsx`.

---

## 2. Was bereits steht (Kurzfassung)

**Tokens (`src/styles/_globalVars.scss`)** – einzige Datei mit Hexwerten. Flächen, Text, Primäraktion
samt `--farbe-primaer-dunkel`, Bedeutungen samt Flächen, **zwei Randrollen** (`--farbe-rand`
dekorativ 1.38:1, `--farbe-rand-bedienbar` 4.33:1), `--farbe-fokus` (9.39:1), `--farbe-link` (6.76:1),
Schriftskala inkl. `--schrift-zahl`, Gewichte, `--breite-text`, `--aktionsleiste-hoehe`,
`--tapziel-min` (44 px), `--tapziel-primaer` (64 px). Jede Paarung ist gegen WCAG 2.1 AA nachgerechnet
(Tabelle in der Fassung vom 26.09.2026, Abschnitt 3.2). Zustände der Primäraktion über eigene Tokens,
sonst `color-mix`; `darken()`/`lighten()`/`mix()` nicht verwenden.

**Fokus (`_reset.scss`)** – `:focus-visible` mit `--farbe-fokus`, Gegenregel `:focus:not(:focus-visible)`,
`prefers-reduced-motion`.

**Komponenten (`src/components/`)**

| Komponente | Kern |
|---|---|
| `Aktionsleiste` | klebt unten (`sticky`), verbraucht `--sicher-unten` |
| `CustomButton` | `art` primaer/sekundaer/gefahr, `breit`, `laedt` (Spinner vor der Beschriftung, Farbe bleibt, `aria-busy`), `type="button"` vorbelegt |
| `Ladespinner` | CSS-Kreis, `farbe` primaer/erben, `role="status"` oder `dekorativ`, 150 ms verzögert, `zentriert` |
| `Icon` | SVG aus `public/icons/` als CSS-Maske in `currentColor`; Test prüft jeden benutzten Namen |
| `Feld` | Beschriftung, Hinweis, Fehler, `aria-describedby`, `aria-invalid` |
| `Auswahlliste` | Select-only Combobox nach WAI-ARIA APG: `aria-activedescendant`, Pfeiltasten, Pos1/Ende, Enter/Leertaste, Escape, Tab, Anfangsbuchstabe, gesperrte Einträge mit Grund als zweite Zeile |
| `Erklaerung` | Info-Schalter mit `aria-expanded`, Text per `hidden`, Tap-Ziel 44 px |

**Layout** – `AppLayout`: Safe-Area, `.inhalt` als Flex-Spalte (Ansichten mit `flex: 1` schieben die
Aktionsleiste nach unten), Zurück-Schaltfläche mit bedienbarem Rand, per `handle.ohneZurueck` abbestellbar.

---

## 3. Fortschrittsbalken (offen, alte 7.4)

Für A10 (C5): Zusagen gegen die Mindestanzahl. **Kein `<progress>`** – es lässt sich nur über
herstellereigene Pseudoelemente einfärben, und die Farbe wechselt hier fachlich.

```tsx
// src/components/Fortschrittsbalken/Fortschrittsbalken.tsx (Auszug)
/**
 * Zeigt den Stand der Zusagen gegen die Mindestanzahl (A10).
 *
 * Die Aussage hängt nicht an der Farbe: Neben dem Balken steht „x von y",
 * und `aria-valuetext` sagt dasselbe für Screenreader.
 */
export default function Fortschrittsbalken({ wert, ziel, erreicht }: FortschrittsbalkenEigenschaften) {
  const anteil = Math.min(100, Math.round((wert / Math.max(ziel, 1)) * 100))
  return (
    <div className={style.behaelter} data-testid="fortschrittsbalken">
      <div
        className={style.spur}
        role="progressbar"
        aria-valuenow={wert}
        aria-valuemin={0}
        aria-valuemax={ziel}
        aria-valuetext={`${wert} von ${ziel} Zusagen`}
      >
        <div
          className={[style.fuellung, erreicht ? style.erreicht : style.offen].join(' ')}
          style={{ inlineSize: `${anteil}%` }}
        />
      </div>
      <p className={style.text}>
        <strong>{wert}</strong> von {ziel} Zusagen
        {!erreicht && ' – Mindestanzahl noch nicht erreicht'}
      </p>
    </div>
  )
}
```

- **Rot oder grün entscheidet der Server** (`mindestzahlErreicht` in der Teilnehmerliste); der Client
  rechnet nicht nach.
- Farben: Spur `--farbe-flaeche-kraeftig`, Füllung `--farbe-erfolg` (4.68:1 auf der Spur) bzw.
  `--farbe-fehler` (6.30:1). Rot meint hier „noch zu wenige", nicht „Fehler" – deshalb der Text daneben.
- Test: Text und `aria-valuetext` nennen die Zahlen unabhängig von der Farbe.

---

## 4. Dialog (offen, alte 7.6)

### 4.1 Warum das native `<dialog>`

`showModal()` bringt Fokusfalle, Inertisierung des Hintergrunds, `::backdrop` und Escape mit. Ein
eigener Dialog müsste all das nachbilden. (Anders als bei der Auswahlliste ist hier nichts
Gestalterisches im Weg: Inhalt und Rahmen des `<dialog>` sind vollständig stylebar.)

### 4.2 Umsetzung

```tsx
// src/components/Dialog/Dialog.tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'
import style from './Dialog.module.scss'

/** Eigenschaften des Dialogs. */
type DialogEigenschaften = {
  offen: boolean
  titel: string
  /** Wird bei Escape und beim Schliessen gerufen. */
  aufSchliessen: () => void
  /** Verhindert das Schliessen über Escape – für unterbrechungsfeindliche Eingaben. */
  festhalten?: boolean
  children: ReactNode
}

/**
 * Modaler Dialog auf Basis des nativen `<dialog>`-Elements.
 *
 * Der Titel wird über `useId` verknüpft, nicht über eine feste ID – sonst
 * kollidierten zwei Dialoge im selben Baum.
 */
export default function Dialog({ offen, titel, aufSchliessen, festhalten, children }: DialogEigenschaften) {
  const ref = useRef<HTMLDialogElement>(null)
  const titelId = useId()

  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (offen && !element.open) element.showModal()
    if (!offen && element.open) element.close()
  }, [offen])

  return (
    <dialog
      ref={ref}
      className={style.dialog}
      aria-labelledby={titelId}
      onClose={aufSchliessen}
      // Escape darf eine laufende Eingabe nicht wegwerfen (DESIGN.md, Sitzungsablauf).
      onCancel={(e) => festhalten && e.preventDefault()}
      data-testid="dialog"
    >
      <h2 id={titelId} className={style.titel}>{titel}</h2>
      <div className={style.inhalt}>{children}</div>
    </dialog>
  )
}
```

```scss
.dialog {
  // Top-Layer: Die Safe-Area-Raender aus AppLayout erreichen den Dialog nicht.
  margin: auto auto 0; // auf dem Telefon unten andocken
  inline-size: min(100%, 32rem);
  padding: var(--abstand-l);
  padding-bottom: calc(var(--abstand-l) + var(--sicher-unten));
  border: 0;
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  background: var(--farbe-hintergrund);
  color: var(--farbe-text);
}

.dialog::backdrop {
  background: color-mix(in srgb, var(--farbe-text) 45%, transparent); // kein Hexwert
}

@media (min-width: 40rem) {
  .dialog {
    margin: auto;
    border-radius: var(--radius-l);
  }
}
```

### 4.3 Test-Stub (Pflicht)

**jsdom kennt `HTMLDialogElement`, implementiert aber weder `showModal` noch `close`.** In
`src/test/setup.ts`:

```ts
/** Ergänzt jsdom um die fehlenden Methoden von `<dialog>` (nur `open` und das `close`-Ereignis). */
function dialogStubEinrichten() {
  const proto = globalThis.HTMLDialogElement?.prototype
  if (!proto || typeof proto.showModal === 'function') return
  proto.showModal = function (this: HTMLDialogElement) { this.open = true }
  proto.show = function (this: HTMLDialogElement) { this.open = true }
  proto.close = function (this: HTMLDialogElement, rueckgabe?: string) {
    this.open = false
    if (rueckgabe !== undefined) this.returnValue = rueckgabe
    this.dispatchEvent(new Event('close'))
  }
}
beforeAll(() => dialogStubEinrichten())
```

**Falle:** jsdom rendert kein CSS; der Dialoginhalt steht auch geschlossen im Baum. Ein Test prüft
`dialog.open`, nicht die Auffindbarkeit. Fokusfalle, Inertisierung und `::backdrop` gehören in einen
Playwright-Test.

---

## 5. Leer- und Fehlerzustand (offen, Rest der alten 7.7)

Der Ladezustand steht als `Ladespinner` (`zentriert`, mit `text`). Es fehlen zwei Komponenten.

### 5.1 Fehlerzustand

```tsx
// src/components/Fehlerzustand/Fehlerzustand.tsx (Auszug)
import { ApiFehler, istNetzfehler } from '@/api/common/fehler'
import CustomButton from '@/components/CustomButton/CustomButton'
import Icon from '@/components/Icon/Icon'

/**
 * Fehlerzustand einer Ansicht.
 *
 * Zeigt den Text des Servers und ersetzt ihn nicht. Eigene Worte nur, wo gar
 * keine Antwort kam. „Erneut versuchen" erscheint nur, wenn ein zweiter
 * Versuch etwas ändern kann (Netzfehler, `≥ 500`) – nicht bei `403` oder `409`.
 */
export default function Fehlerzustand({ fehler, erneut }: FehlerzustandEigenschaften) {
  const netzfehler = istNetzfehler(fehler)
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const wiederholbar = netzfehler || (apiFehler?.status ?? 0) >= 500

  return (
    <div className={style.zustand} role="alert" data-testid="fehlerzustand">
      <Icon name="error_circle_icon" />
      <p className={style.text}>
        {netzfehler
          ? 'Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung.'
          : (apiFehler?.message ?? 'Unbekannter Fehler.')}
      </p>
      {wiederholbar && erneut && (
        <CustomButton onClick={erneut} data-testid="fehler-erneut">Erneut versuchen</CustomButton>
      )}
    </div>
  )
}
```

**Bestand, der danach umzustellen ist:** `PinEingabe` und `Namensauswahl` tragen je eine eigene
Funktion `fehlertextBilden` und eigenes Markup für Fehlerkästen. Die Texte und die Unterscheidung
Netzfehler/Serverantwort sind dieselben – sie gehören in `Fehlerzustand` bzw. eine kleine
Meldungskomponente, sonst wächst die Kopie mit jeder Ansicht.

### 5.2 Leerzustand

Trägt immer **Grund und nächsten Schritt** („Noch keine Zusagen. Sei der Erste."), nie nur
„Keine Daten". Eigenschaften: `titel`, `text`, optional eine Aktion (`CustomButton`). Die fachlichen
Texte kommen aus den Paketen C5 bis C8.

---

## 6. Nacharbeiten aus C0 und C1 (offen, alte 8)

### 6.1 Zurück-Navigation mit Zielangabe

**Nachgemessen:** Beim Direkteinstieg (Deeplink, Start der installierten PWA) steht
`history.state = {"idx":0}`; `history.length` taugt nicht als Erkennung (Wert 2 trotz Direkteinstieg).

`RoutenAngaben` (`src/app/routenAngaben.ts`) wird um ein Ziel erweitert; `AppLayout` liest es wie
`ohneZurueck` über `useMatches`:

```ts
export type RoutenAngaben = {
  ohneZurueck?: boolean
  /** Übergeordnete Ansicht für die Zurück-Schaltfläche. */
  zurueck?: string
}
```

```tsx
// In AppLayout: Ziel aus der Route, sonst ein Schritt zurück, sonst zur Startseite.
const ziel = treffer.findLast((t) => (t.handle as RoutenAngaben | undefined)?.zurueck)
  ?.handle as RoutenAngaben | undefined

function zurueck() {
  if (ziel?.zurueck) return void navigate(ziel.zurueck)
  // `idx` stammt aus dem Verlaufszustand von React Router: 0 heisst Direkteinstieg.
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  return void (idx > 0 ? navigate(-1) : navigate('/'))
}
```

„Einen Schritt zurück" und „zur übergeordneten Ansicht" sind verschiedene Dinge: Aus der
Ergebniserfassung zurück zur Teamansicht und wieder zurück landet man mit `-1` erneut in der
Ergebniserfassung. Die Zielangabe ist die Regel, `-1` die Abkürzung. Die Zurück-Schaltfläche kann
dabei zur `CustomButton art="sekundaer"` werden; ihre `data-testid` bleibt `layout-zurueck`.

### 6.2 Offline-Hinweis fertigstellen

- Aufbau und Verhalten bleiben. Tokens: Fläche `--farbe-fehler-flaeche`, Rand `--farbe-fehler`,
  Text `--farbe-text`; das Symbol über `Icon` statt über den CSS-Hintergrund.
- **Der Precache-Eintrag `no_connection_icon_red.svg` bleibt** – als Maske wird die Datei weiterhin
  geladen, offline nur aus dem Precache. Danach muss der Bau weiterhin **sechs** Precache-Einträge melden.
- Den Kommentar „Die Gestaltung ist vorläufig" in `OfflineHinweis.tsx` entfernen.
- `useVerbindung`: Der dritte Parameter von `useSyncExternalStore` (`() => true`) ist nur der
  Serverschnappschuss und wird nie aufgerufen; er kann entfallen. Die frühere Optimismus-Lücke ist
  seit dem 03.10.2026 geschlossen – jede Ansicht liest beim Start über ihren Guard die Sitzung.

---

## 7. Tests

| Was | Stand |
|---|---|
| `CustomButton`, `Ladespinner`, `Icon` (inkl. Namensprüfung), `Feld`, `Auswahlliste` (Tastatur, gesperrte Einträge, Tipp ausserhalb), `Erklaerung` | **vorhanden** |
| `Fortschrittsbalken`: Text und `aria-valuetext` unabhängig von der Farbe | offen |
| `Dialog`: öffnet/schliesst über `offen`, meldet `close`, `festhalten` verhindert Escape (mit Stub) | offen |
| `Fehlerzustand`: zeigt `ApiFehler.message`; „Erneut versuchen" bei `500` und Netzfehler, nicht bei `409` | offen |
| Zurück-Ziel: Direkteinstieg führt zur Startseite bzw. zum Ziel aus `handle` | offen |
| E2E: Fokusring bei Tastaturbedienung sichtbar; Dialog hält den Fokus | offen |
| E2E: Aktionsleiste verbraucht `--sicher-unten`; PIN-Kästchen nebeneinander | **vorhanden** |

Stand: 113 Unit-Tests; E2E in drei Chromium-Projekten lokal, alle sieben (inkl. WebKit) in CI.

---

## 8. Abnahme von C2

| # | Prüfung | Erwartet |
|---|---|---|
| 1 | `npm run typecheck` | Exitcode 0 über alle vier Teilprojekte |
| 2 | `npm run lint` | keine Fehler |
| 3 | `npm test` | grün, inkl. der offenen Fälle aus Abschnitt 7 |
| 4 | `npm run build` | weiterhin **sechs** Precache-Einträge |
| 5 | `npm run test:e2e` | alle sieben Projekte grün (lokal oder CI-Job `e2e`) |
| 6 | `grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.scss --include=*.tsx` | Treffer **nur** in `_globalVars.scss` |
| 7 | `grep -rn "darken(\|lighten(\|@import" src` | keine Treffer |
| 8 | Kontraste der Tokens nachrechnen | Text ≥ 4.5:1, Begrenzung von Bedienelementen ≥ 3:1 |
| 9 | Tastaturdurchlauf PIN → Namensauswahl → offener Dialog | Fokus überall sichtbar, Dialog hält ihn, Escape schliesst |
| 10 | 360 px Breite, Zoom 200 % | kein waagerechtes Scrollen, Aktionsleiste erreichbar |
| 11 | Echtes Telefon im Sonnenlicht, **auch Safari/iOS** | lesbar, einhändig bedienbar |

Prüfpunkt 6 ist der eigentliche Abnahmetest: Ein Hexwert ausserhalb der Tokendatei macht das
Design-System zur Empfehlung.

---

## 9. Nachdokumentation und Commit

1. `client/harness/CONTEXT_HANDOFF_CLIENT.md` fortschreiben (C2 auf „abgeschlossen", Code-Zustand,
   nächste Schritte); Vorfassung unter `client/harness/archive/` ablegen.
2. `client/harness/AGENT_CLIENT.md` um neue Festlegungen ergänzen (Dialog samt Stub, Fehler- und
   Leerzustand, Zurück-Ziel).
3. `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` nachziehen (liegt ausserhalb des Repositorys).
4. Commit auf `dev_client`, nicht nach `main`. Vorher prüfen: keine `.env`, keine realen Namen.

---

## 10. Fallen

1. **jsdom implementiert `showModal` nicht** – Stub aus 4.3; `dialog.open` prüfen, nicht die
   Auffindbarkeit.
2. **Die Icons in `public/icons/` tragen feste Füllfarben** – nur als Maske folgen sie dem Token
   (erledigt mit `Icon`). `warning_icon.svg` erreicht in Eigenfarbe nur 2.51:1.
3. **`history.length` erkennt den Direkteinstieg nicht**, `history.state.idx` schon.
4. **`border-radius: inherit` in der Fokusregel** macht runde Schaltflächen eckig.
5. **Safari und `fit-content` an einer umbrechenden Flex-Zeile:** Die Breite wird aus einem einzigen
   Element berechnet, alle weiteren brechen um. Für feste Anzahlen ein Raster mit festen Spalten.
6. **Natives `<select>` ist aufgeklappt nicht gestaltbar** – deshalb die eigene `Auswahlliste`.
7. **Playwright klickt nicht auf `aria-disabled`-Elemente**, sondern wartet; im Test `force: true`.
8. **Umbenennen nie per blindem Suchen und Ersetzen** – es trifft Kommentare, Doku und Archive.

---

## 11. Bezug zu C3

C3 hat bereits begonnen und benutzt aus diesem Paket `CustomButton`, `Ladespinner`, `Feld`,
`Auswahlliste`, `Erklaerung`, `Icon` und `Aktionsleiste` (PIN-Eingabe, Namensauswahl, Gast). Für den
Rest von C3 – Restlaufzeit, Erneuerung, **Ablauf-Dialog**, Abmelden – ist der **Dialog** aus Abschnitt 4
die Voraussetzung; er sollte als Nächstes entstehen.
