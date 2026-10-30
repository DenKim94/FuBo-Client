# C2 – Design-System und Basis-Layout (Umsetzungsanleitung)

> Schrittweise Anleitung zum Arbeitspaket **C2** (geschätzt 12 h).
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (Gesamtspezifikation), `client/harness/AGENT_CLIENT.md`
> (Systemprompt Client), `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (UI-Vorgaben, Fassung vom
> 25.09.2026).
> Referenz: `/PRJ_FuBo/harness/assets/Design/FuBo_Design_Prototypen.html` – Abweichungen sind zulässig.
> Stand: 26.09.2026, Repository auf Branch `dev_client`, ausgehend von Commit `e7fce6e` (C1).
>
> **Die kritischen Punkte dieser Anleitung sind vorab gemessen worden** – Farbkontraste, das
> Verhalten von `<dialog>` unter jsdom, die Einfärbbarkeit der vorhandenen Ikonen und der
> Verlaufszustand beim Direkteinstieg. Wo „nachgemessen" steht, ist das ein Ergebnis dieser Probe und
> keine Vermutung. Abschnitt 12 nennt die vier Fallen, die dabei aufgefallen sind.
>
> **Der Beispielcode ist übersetzt und ausgeführt worden.** `Ikone`, `Schaltflaeche`, `Dialog`,
> `Aktionsleiste` und `klassen` liefen in einer Wegwerf-Kopie des Projekts durch die Typprüfung mit
> `strict` unter TypeScript 6 und durch fünf Vitest-Fälle (vorbelegter `type`, `aria-busy`,
> `aria-hidden` an der Ikone, Öffnen und Schliessen des Dialogs). Die Auszüge in 7.2, 7.4, 7.5 und
> 7.7 sind dagegen gekürzt und als solche gekennzeichnet.

---

## 0. Ziel und Abgrenzung

### 0.1 Ergebnis von C2

Nach C2 gibt es eine **Sprache**, in der jede Ansicht ab C3 geschrieben wird:

- Eine geprüfte Farbwelt als Tokens in `_globalVars.scss`, jede Paarung gegen WCAG 2.1 AA gemessen.
- Ein sichtbarer Fokus, ein Raster und ein Aktionsbereich in Daumenreichweite – beides einmal im
  Layout statt in jeder Ansicht.
- Basis-Komponenten: Schaltfläche, Eingabefeld, Auswahlliste, Fortschrittsbalken, Erklärung
  (Info-Icon), Dialog.
- Lade-, Leer- und Fehlerzustand als eigene Komponenten. Der Fehlerzustand nimmt den `ApiFehler`
  aus C1 entgegen und zeigt den Servertext, ohne ihn zu ersetzen.
- Eine Ikonen-Einbindung, die der Textfarbe folgt – ohne neue Abhängigkeit und ohne Änderung an den
  vorhandenen SVG-Dateien.
- Die beiden Nachzieharbeiten aus C0 und C1: die Zurück-Schaltfläche mit Zielangabe und die
  endgültige Gestaltung des Offline-Hinweises.

**C2 ist das letzte Paket ohne Fachlichkeit.** Es entsteht keine Ansicht, die ein Spieler benutzen
könnte – aber jede Ansicht ab C3 besteht zu drei Vierteln aus diesen Teilen.

### 0.2 Nicht Teil von C2

| Thema | Paket |
|---|---|
| PIN-Eingabe, Namensauswahl, Gast-Anmeldung, Sitzungs-Countdown als **Ansicht** | C3 |
| Der Dialog „Sitzung läuft ab" mit seiner Fachlichkeit (verlängern, abmelden, harte Obergrenze) | C3 |
| Admin-Login und Passwort-Reset | C4 |
| Teilnehmerliste, Warteschlange, Zu-/Absage | C5 |
| Teamansicht, Kontingent, Ergebniseintrag | C6 |
| Admin-Verwaltung, Skill-Eingabe | C7 |
| Installationshinweis, Benachrichtigungsschalter | C8 |
| Vollständige E2E-Suite und die Barrierefreiheitsabnahme über alle Ansichten | C9 |

Die Grenze zu C3 verläuft so: **C2 baut den Dialog, C3 füllt ihn.** Ein `Dialog`, der öffnet,
schliesst, den Fokus hält und auf `Escape` reagiert, gehört hierher; „Sitzung verlängern" gehört
nach C3.

**Nicht gebaut wird eine Komponente, die nur ein einziges Paket braucht.** Ein Skill-Regler
(0 bis 6, Torwart 0 bis 3) erscheint ausschliesslich in Admin-Ansichten und entsteht in C7; eine
Vorratshaltung hier hätte keinen zweiten Aufrufer und keine Prüfung an echten Daten.

### 0.3 Warum dieses Paket vor den fachlichen kommt

1. **Tap-Ziele und Kontraste lassen sich nachträglich nicht einsammeln.** Wenn acht Ansichten je
   eigene Schaltflächen mitbringen, ist die Prüfung nach WCAG 2.1 AA in C9 kein Prüfschritt mehr,
   sondern ein eigenes Projekt.
2. **Die drei Zustände sind die halbe Arbeit jeder Ansicht.** DESIGN.md verlangt für *jeden* Screen
   Lade-, Leer- und Fehlerzustand. Dreimal gebaut sind sie drei Varianten, einmal gebaut sind sie
   eine.
3. **Der Fehlerzustand ist die Anzeigeseite von C1.** Die HTTP-Schicht übersetzt jede Antwort in
   einen `ApiFehler`; ohne die Anzeige dazu bleibt die Übersetzung folgenlos.

---

## 1. Befund des Ist-Zustands

Geprüft am 26.09.2026 am Stand nach C1 (`e7fce6e`).

| Nr. | Befund | Wirkung | Schritt |
|---|---|---|---|
| B1 | `--farbe-rand: #d6d8d6` erreicht gegen Weiss **1.43:1** (nachgemessen) | WCAG 2.1 AA verlangt in 1.4.11 **3:1** für die Begrenzung eines Bedienelements. Die Zurück-Schaltfläche aus C0 ist genau so gebaut: heller Rand auf heller Fläche. Bei Sonnenlicht am Spielfeldrand bricht das zuerst. | 3 |
| B2 | Es gibt `--fokus-rand: 3px`, aber **keine Fokusfarbe und keine `:focus-visible`-Regel** | Ohne sichtbaren Fokus ist die Anwendung mit Tastatur unbedienbar (2.4.7). Der Wert allein tut nichts. | 4.3 |
| B3 | **Keine der 29 Ikonen in `public/icons/` nutzt `currentColor`** (nachgezählt); alle tragen feste `fill`-Werte | Ein Symbol auf einer Primärfläche bleibt grau, ein deaktiviertes bleibt kräftig. Zustände sind damit nicht darstellbar. | 6 |
| B4 | `warning_icon.svg` trägt `#DA954B` – **2.51:1** gegen Weiss (nachgemessen) | Unter der 3:1-Schwelle für aussagetragende Grafiken (1.4.11). Ausgerechnet die Warnung ist das am schlechtesten sichtbare Symbol. | 6.2 |
| B5 | Die Ikonenfarben weichen von den Tokens ab: `#BB271A` gegen `--farbe-warnung: #b3261e`, `#48752C` gegen `--farbe-erfolg: #0b6b3a` | Zwei Wahrheiten für dieselbe Aussage. Nebeneinander sieht es nach einem Fehler aus. | 6 |
| B6 | Keine Basis-Komponenten vorhanden (`src/komponenten/` enthält nur `AktualisierungsHinweis` und `OfflineHinweis`) | Jede Ansicht ab C3 brächte ihre eigene Schaltfläche mit. | 7 |
| B7 | Kein Lade-, Leer- oder Fehlerzustand; `ApiFehler` aus C1 hat keine Anzeige | Die Fehlerübersetzung aus C1 bleibt ohne sie unsichtbar. | 7.7 |
| B8 | `navigate(-1)` in `AppLayout` hat bei Direkteinstieg keinen Vorgänger (offener Punkt aus C0) | Beim Start der installierten PWA oder über einen Deeplink tut die Schaltfläche nichts – im Vollbildmodus gibt es keine Browser-Zurück-Schaltfläche daneben. **Nachgemessen:** Beim Direkteinstieg steht `history.state = {"idx":0}`; `history.length` taugt nicht als Kriterium (Wert 2 trotz Direkteinstieg). | 8.1 |
| B9 | Der Offline-Hinweis aus C1 ist bewusst provisorisch gestaltet | Er ist die erste Ansicht, die C2 fertigstellen kann – und der einzige Hinweis, den ein Spieler ohne Verbindung überhaupt sieht. | 8.2 |
| B10 | **jsdom 27 kennt `HTMLDialogElement`, implementiert aber weder `showModal` noch `close`** (nachgemessen: `typeof element.showModal === 'undefined'`) | Jeder Komponententest eines Dialogs scheitert mit `showModal is not a function`. Ohne Stub ist der Dialog nur in Playwright prüfbar. | 7.6 |

**Was DESIGN.md vorgibt** – die vier Sätze, an denen dieses Paket hängt:

- **Nutzungssituation draussen, bei Sonnenlicht, einhändig, in Eile.** Daraus folgen hoher Kontrast,
  grosse Schrift, grosse Tap-Ziele und primäre Aktionen in Daumenreichweite.
- **Tap-Ziele mindestens 44×44 px.**
- **Bedienbarkeit nicht ausschliesslich über Farbe vermitteln** – ausdrücklich genannt für den
  Fortschrittsbalken (rot/grün).
- **Tokens als neutrale Platzhalter; eine verbindliche Markenfarbwelt existiert noch nicht.** C2
  legt sie deshalb nicht fest, sondern macht sie austauschbar: Wer später eine Marke bekommt,
  ändert eine Datei.

---

## 2. Vorbereitung

### 2.1 Branch

```bash
git checkout dev_client
git pull --ff-only
git switch -c dev_client_c2        # optionaler Feature-Branch fuer C2
```

### 2.2 Keine neuen Abhängigkeiten

C2 kommt ohne zusätzliche Pakete aus. Das ist eine Entscheidung, keine Zufälligkeit:

| Verlockung | Warum nicht |
|---|---|
| Eine Komponentenbibliothek (MUI, Mantine, shadcn) | Sie brächte ein zweites Token-System mit, das neben `_globalVars.scss` steht, und eine Fassung, die das Projekt pflegen muss. Gebraucht werden sechs Komponenten, von denen vier auf nativen Elementen aufsetzen. |
| `vite-plugin-svgr`, um SVG als Komponente zu importieren | Abschnitt 6 zeigt eine Einfärbung über CSS-Masken, die ohne Werkzeugkette auskommt und in Chromium nachgemessen ist. |
| `clsx` / `classnames` | Fünf Zeilen eigener Helfer (Abschnitt 7.0) tun dasselbe. Eine Abhängigkeit mehr heisst eine Prüfung mehr bei jedem `npm audit`. |
| Eine Animationsbibliothek | Es gibt in diesem Paket genau zwei Bewegungen (Dialog, verzögerter Ladezustand), beide in CSS. |

### 2.3 Was zuerst zu lesen ist

`DESIGN.md`, Abschnitte „Rahmenbedingungen", „Weitere Vorgaben" und die drei „Besonderheiten". Die
Prototypen-Datei ist eine gebündelte Seite; sie lässt sich im Browser öffnen, aber nicht sinnvoll
im Editor lesen. **Ihre Farbwerte sind bereits ausgewertet** (Abschnitt 3.1) – wer mehr braucht,
öffnet sie im Browser und misst mit den Entwicklerwerkzeugen nach.

---

## 3. Farbwelt und Tokens

### 3.1 Woher die Werte kommen

Aus den Prototypen ausgezählt, absteigend nach Häufigkeit: ein Primärgrün `#1B7A33`, ein Textschwarz
`#11150F`, eine Reihe grünstichiger Neutraltöne (`#3C4239`, `#5A6157`, `#8A9084`, `#B9BFB4`,
`#C9CFC6`, `#D8DDD6`, `#EDEFEB`, `#F4F6F4`), ein Rot `#A6231C`, ein Blau `#1A5BA8` / `#14477F` und
ein Gold `#8A5A00`.

**Diese Werte werden übernommen**, weil sie aus dem Entwurf stammen und geprüft sind – nicht, weil
sie Marke wären. DESIGN.md hält die Markenfarbwelt ausdrücklich offen. Die Tokens sind die Stelle,
an der ein späterer Wechsel stattfindet; **keine Komponente schreibt einen Hexwert**.

### 3.2 Gemessene Kontraste

Alle Werte nach WCAG 2.1 berechnet. Soll: **4.5:1** für Text, **3:1** für grossen Text
(ab 24 px bzw. 18,66 px fett) und für die Begrenzung von Bedienelementen und aussagetragende
Grafiken (1.4.11).

| Paarung | Verhältnis | Soll | Urteil |
|---|---|---|---|
| `#11150F` auf Weiss (Fliesstext) | 18.45:1 | 4.5 | ✔ |
| `#3C4239` auf Weiss | 10.34:1 | 4.5 | ✔ |
| `#5A6157` auf Weiss (sekundärer Text) | 6.40:1 | 4.5 | ✔ |
| `#5A6157` auf `#F4F6F4` (auf der Fläche) | 5.89:1 | 4.5 | ✔ |
| Weiss auf `#1B7A33` (Primärschaltfläche) | 5.41:1 | 4.5 | ✔ |
| `#1B7A33` als Text auf Weiss | 5.41:1 | 4.5 | ✔ |
| `#A6231C` auf Weiss (Fehler) | 7.30:1 | 4.5 | ✔ |
| `#8A5A00` auf Weiss (Hinweis) | 5.93:1 | 4.5 | ✔ |
| `#14477F` auf Weiss (Fokus) | 9.39:1 | 3.0 | ✔ |
| Balken `#1B7A33` auf `#EDEFEB` | 4.68:1 | 3.0 | ✔ |
| Balken `#A6231C` auf `#EDEFEB` | 6.30:1 | 3.0 | ✔ |
| **`#8A9084` als Text auf Weiss** | **3.28:1** | 4.5 | ✘ – nur für Ränder und Symbole |
| **`#D8DDD6` als Rand auf Weiss** | **1.38:1** | 3.0 | ✘ – nur dekorativ |
| **`#d6d8d6` (Bestand) als Rand** | **1.43:1** | 3.0 | ✘ – Befund B1 |

Zwei Ergebnisse daraus sind tragend:

- **`#8A9084` ist kein Textton.** Er kommt in den Prototypen 21-mal vor und liegt nahe an der Rolle
  „unwichtiger Text". Als Beschriftung verfehlt er AA. Er taugt für Ränder (3.28:1 ≥ 3) und für
  Symbole, nicht für Wörter.
- **Eine Randfarbe reicht nicht.** Siehe 3.4.

### 3.3 Die Tokens

`src/styles/_globalVars.scss` – die Farbblöcke werden ersetzt, Abstände, Tap-Ziel und Safe-Area
bleiben unverändert.

```scss
:root {
  /* --- Flaechen --- */
  --farbe-hintergrund: #ffffff;
  --farbe-flaeche: #f4f6f4;          /* Karten, Listenzeilen */
  --farbe-flaeche-kraeftig: #edefeb;  /* Spur des Fortschrittsbalkens */

  /* --- Text --- */
  --farbe-text: #11150f;
  --farbe-text-schwach: #5a6157;      /* 6.40:1 – noch AA-tauglich */
  --farbe-primaer-kontrast: #ffffff;  /* Name aus C0 beibehalten */

  /* --- Primaeraktion --- */
  --farbe-primaer: #1b7a33;
  --farbe-primaer-dunkel: #145c26;    /* gedrueckt; siehe 3.5 */

  /* --- Bedeutungen ---
     Die Aussage darf nie allein an der Farbe haengen (DESIGN.md). Diese Werte
     begleiten immer einen Text oder ein Symbol. */
  --farbe-fehler: #a6231c;
  --farbe-erfolg: #1b7a33;
  --farbe-hinweis: #8a5a00;
  --farbe-fehler-flaeche: #fdf2f1;
  --farbe-hinweis-flaeche: #fdf6e8;

  /* --- Raender: zwei Rollen, nicht eine (siehe 3.4) --- */
  --farbe-rand: #d8ddd6;              /* dekorativ: Trennlinien, 1.38:1 */
  --farbe-rand-bedienbar: #767b72;    /* Begrenzung von Bedienelementen, 4.33:1 */

  /* --- Fokus --- */
  --farbe-fokus: #14477f;             /* 9.39:1 – nicht mit Erfolg/Fehler verwechselbar */
}
```

#### Was umbenannt wird – und wo es nachzuziehen ist

CSS-Variablen scheitern **lautlos**: Ein `var(--farbe-warnung)` auf ein gelöschtes Token liefert
keinen Fehler, sondern gar keine Farbe. Deshalb gehören die beiden Umbenennungen und ihre
Fundstellen in denselben Arbeitsschritt (im Bestand ausgezählt):

| Alt | Neu | Betroffene Datei |
|---|---|---|
| `--farbe-warnung` | `--farbe-fehler` | `OfflineHinweis.module.scss` (Zeile 16) |
| `--farbe-rand` an Bedienelementen | `--farbe-rand-bedienbar` | `AppLayout.module.scss` (Zeile 31, `.zurueck`) |

`--farbe-primaer`, `--farbe-primaer-kontrast`, `--farbe-flaeche`, `--farbe-text`,
`--farbe-text-schwach` und `--farbe-hintergrund` **behalten ihre Namen** – nur ihre Werte ändern
sich. Der dekorative `--farbe-rand` bleibt in `AppLayout.module.scss` (Zeile 22, Trennlinie unter
dem Kopf) und in `AktualisierungsHinweis.module.scss` (Zeile 17) richtig.

Zur Kontrolle nach dem Umbau:

```bash
# Findet jedes Token, das benutzt, aber nicht definiert ist.
grep -rhro "var(--farbe-[a-z-]*)" src --include=*.scss | sort -u \
  | sed 's/var(\(.*\))/\1/' \
  | while read -r name; do grep -q -- "$name:" src/styles/_globalVars.scss || echo "FEHLT: $name"; done
```

**`--farbe-warnung` entfällt und heisst künftig `--farbe-fehler`.** Der alte Name beschrieb zwei
verschiedene Dinge zugleich: den roten Fortschrittsbalken (eine Warnung: noch zu wenige Zusagen) und
eine Fehlermeldung. Der Balken benutzt jetzt ausdrücklich `--farbe-fehler`, weil beide Male Rot
gemeint ist – aber der Name sagt nicht mehr, es handle sich um dieselbe Aussage. Wer in C5 den
Balken einfärbt, soll nicht glauben, er zeige einen Fehler an.

### 3.4 Zwei Randfarben statt einer

WCAG 1.4.11 verlangt 3:1 für „visuelle Information, die zum Erkennen von Bedienelementen nötig ist".
Das trifft den Rand einer Schaltfläche, deren Fläche sich kaum vom Hintergrund abhebt – und genau so
ist die Zurück-Schaltfläche aus C0 gebaut. Es trifft **nicht** eine Trennlinie zwischen zwei
Listenzeilen: Die trägt keine Information, sie ordnet.

Ein einziges Token für beides zwingt zur Wahl zwischen einem zu schwachen Rand an Schaltflächen und
einem zu harten Gitter in Listen. Deshalb:

- `--farbe-rand` – dekorativ. Trennlinien, Kartenkanten neben gefüllten Flächen.
- `--farbe-rand-bedienbar` – alles, was ein Nutzer antippen oder befüllen kann: Schaltflächen,
  Eingabefelder, Auswahllisten, Kontrollkästchen.

**In C0 ist an drei Stellen der falsche gesetzt** (`AppLayout.module.scss`: `.kopf`, `.zurueck`;
`AktualisierungsHinweis.module.scss`: `.hinweis`). Die Schaltfläche bekommt den bedienbaren Rand,
die Trennlinie unter dem Kopf behält den dekorativen.

### 3.5 Zustände: `color-mix` statt Sass-Funktionen

Die Farben liegen als CSS-Variablen vor. **Sass kann damit nicht rechnen** – `color.adjust(var(--x))`
ist kein gültiger Ausdruck, weil der Wert erst im Browser existiert. Für Hover- und Aktivzustände
gibt es zwei Wege:

```scss
.schaltflaeche:active {
  /* Weg 1: eigenes Token (vorhersehbar, aber ein Token je Zustand) */
  background: var(--farbe-primaer-dunkel);
}

.karte:hover {
  /* Weg 2: im Browser mischen – kein zusaetzliches Token noetig */
  background: color-mix(in srgb, var(--farbe-flaeche) 92%, #000);
}
```

**Regel:** Zustände der Primäraktion bekommen ein eigenes Token (sie sind zu wichtig, um sie
rechnen zu lassen); alles andere mischt mit `color-mix`. Unterstützt wird das von Chrome ab 111 und
Safari ab 16.2 – unterhalb der Schwelle, die A25b ohnehin setzt (Web Push ab iOS 16.4).

**Nicht benutzen:** die globalen Funktionen `darken()`, `lighten()`, `mix()`. Nachgemessen mit
sass-embedded 1.103: `DEPRECATION WARNING [global-builtin]` und `darken() is deprecated`. Wo eine
feste Farbe gerechnet werden muss, gilt `@use 'sass:color'` und `color.adjust($farbe, $lightness: -8%)`;
das läuft ohne Warnung.

---

## 4. Typografie, Abstände und Fokus

### 4.1 Schriftskala

Die Skala aus C0 bleibt – sie ist bereits auf die Nutzung bei Sonnenlicht ausgelegt
(`--schrift-basis: 1.125rem`, also 18 px statt 16 px). Zwei Ergänzungen:

```scss
:root {
  --schrift-klein: 1rem;       /* Fusszeilen, Zeitangaben – nie fuer Aussagen */
  --schrift-basis: 1.125rem;
  --schrift-gross: 1.5rem;
  --schrift-titel: 2rem;
  --schrift-zahl: 2.5rem;      /* NEU: Teilnehmerzahl, Countdown, Bilanz */
  --gewicht-normal: 400;
  --gewicht-halbfett: 600;     /* NEU: Hervorhebung ohne Farbwechsel */
}
```

Das halbfette Gewicht ist kein Schmuck: Es ist das Mittel, mit dem sich eine Aussage **ohne Farbe**
hervorheben lässt – die Vorgabe aus DESIGN.md, Bedienbarkeit nicht allein über Farbe zu vermitteln.

### 4.2 Abstände

Unverändert aus C0 (`--abstand-xs` bis `--abstand-xl`). Ein Zusatz für den unteren Aktionsbereich:

```scss
--aktionsleiste-hoehe: 4.5rem;   /* Hoehe des unteren Aktionsbereichs (Abschnitt 5.2) */
--breite-text: 34rem;            /* Zeilenlaenge fuer Fliesstext (Abschnitt 5.1) */
```

### 4.3 Fokus – eine Regel für die ganze Anwendung

In `src/styles/global.scss`:

```scss
/* Sichtbarer Fokus fuer Tastatur und Schalter-Steuerung (WCAG 2.4.7).
   `:focus-visible` statt `:focus`: Ein Mausklick soll keinen Ring hinterlassen,
   eine Tabulatortaste schon. */
:focus-visible {
  outline: var(--fokus-rand) solid var(--farbe-fokus);
  outline-offset: 2px;
  /* Ohne Radius liegt der Ring bei runden Schaltflaechen in den Ecken daneben. */
  border-radius: inherit;
}

/* Den Vorgabe-Ring des Browsers nicht entfernen, ohne ihn zu ersetzen –
   genau das ist der haeufigste Zugaenglichkeitsfehler ueberhaupt. */
:focus:not(:focus-visible) {
  outline: none;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

`:focus-visible` lässt sich in jsdom nicht prüfen – die Heuristik dahinter ist Sache des Browsers.
Der Nachweis gehört deshalb in einen Playwright-Test (Abschnitt 9).

---

## 5. Raster und Aktionsbereich

### 5.1 Der Inhaltsbereich

`AppLayout` begrenzt bereits auf `max-width: 48rem` und setzt die Safe-Area-Ränder. Das bleibt. Neu
ist eine Zeilenbreite für Fliesstext (`--breite-text: 34rem`), damit Hinweistexte auf dem Tablet
nicht über die volle Breite laufen.

### 5.2 Die Aktionsleiste in Daumenreichweite

DESIGN.md verlangt die primären Aktionen im unteren Bildschirmbereich. In C0 ist dafür nur Platz
reserviert (`padding-bottom` im Inhalt). C2 baut den Bereich:

```tsx
// src/komponenten/Aktionsleiste/Aktionsleiste.tsx
import type { ReactNode } from 'react'
import style from './Aktionsleiste.module.scss'

/**
 * Hält die primäre Aktion einer Ansicht am unteren Rand, in Daumenreichweite (A2).
 *
 * Die Leiste klebt am unteren Rand und liegt über dem Home-Indicator, nicht
 * darunter. Sie ist bewusst eine Komponente und keine Klasse: Der Abstand zur
 * Safe Area und die Höhe müssen an einer Stelle stehen, sonst rutscht in einer
 * der acht Ansichten die Schaltfläche unter den Bildschirmrand.
 */
export default function Aktionsleiste({ children }: { children: ReactNode }) {
  return (
    <div className={style.leiste} data-testid="aktionsleiste">
      {children}
    </div>
  )
}
```

```scss
// src/komponenten/Aktionsleiste/Aktionsleiste.module.scss
@use '@/styles/globalVars';

.leiste {
  position: sticky;
  bottom: 0;
  z-index: var(--ebene-kopf);

  display: flex;
  gap: var(--abstand-s);
  align-items: center;

  min-height: var(--aktionsleiste-hoehe);
  padding: var(--abstand-s) var(--abstand-m);
  // Der Home-Indicator liegt genau hier. Ohne diese Zeile steht die wichtigste
  // Schaltflaeche der Anwendung halb darunter (A25a).
  padding-bottom: calc(var(--abstand-s) + var(--sicher-unten));

  background: var(--farbe-hintergrund);
  border-top: 1px solid var(--farbe-rand);
}

.leiste > * {
  flex: 1;   // eine Aktion nimmt die Breite, zwei teilen sie
}
```

`position: sticky` statt `fixed`: Eine feste Leiste überdeckt auf kurzen Ansichten den letzten
Listeneintrag, und auf iOS springt sie beim Einblenden der Tastatur.

---

## 6. Ikonen

### 6.1 Das Problem und die Messung

Alle 29 Dateien in `public/icons/` tragen feste Füllfarben; `currentColor` kommt in keiner vor
(nachgezählt). Vorherrschend ist `#666666` (Material-Symbols-Export), dazu `#BB271A` rot,
`#48752C` grün und `#DA954B` orange.

Daraus folgen drei Probleme: Ein Symbol auf der Primärschaltfläche bliebe grau statt weiss, ein
deaktivierter Zustand liesse sich nicht abschwächen, und die Farben stehen neben den Tokens (B5).

### 6.2 Die Lösung: CSS-Maske

Das SVG wird nicht als Bild eingebunden, sondern als **Maske**; die Farbe liefert `currentColor`.
Damit folgt jedes Symbol der Textfarbe seiner Umgebung – ohne Änderung an den Dateien und ohne
zusätzliches Werkzeug.

**Nachgemessen in Chromium:** dasselbe `warning_icon.svg` erscheint als Maske in Gold auf Weiss,
in Weiss auf der Primärfläche und in Grau im deaktivierten Zustand; als Hintergrundbild bleibt es in
allen drei Fällen beim blassen `#DA954B` (2.51:1, Befund B4).

```tsx
// src/komponenten/Ikone/Ikone.tsx
import type { CSSProperties } from 'react'
import style from './Ikone.module.scss'

/** Eigenschaften der Ikone. */
type IkoneEigenschaften = {
  /** Dateiname ohne Pfad und Endung, z. B. "info_circle_icon". */
  name: string
  /** Kantenlänge in rem. Vorgabe 1.5 (24 px bei 16-px-Wurzel). */
  groesse?: number
  /**
   * Beschriftung für Screenreader. Fehlt sie, gilt das Symbol als schmückend
   * und wird ausgeblendet – das ist der Normalfall neben einem Text.
   */
  beschriftung?: string
}

/**
 * Zeigt ein Symbol aus `public/icons/` in der Farbe seiner Umgebung.
 *
 * Als CSS-Maske und nicht als Bild: Die vorhandenen SVG-Dateien tragen feste
 * Füllfarben und folgten sonst keinem Zustand – ein Symbol auf der
 * Primärschaltfläche bliebe grau, ein deaktiviertes bliebe kräftig.
 */
export default function Ikone({ name, groesse = 1.5, beschriftung }: IkoneEigenschaften) {
  return (
    <span
      className={style.ikone}
      style={{
        '--ikone-quelle': `url('/icons/${name}.svg')`,
        '--ikone-groesse': `${groesse}rem`,
      } as CSSProperties}
      role={beschriftung ? 'img' : undefined}
      aria-label={beschriftung}
      aria-hidden={beschriftung ? undefined : true}
      data-testid={`ikone-${name}`}
    />
  )
}
```

```scss
// src/komponenten/Ikone/Ikone.module.scss
.ikone {
  display: inline-block;
  flex: 0 0 auto;
  inline-size: var(--ikone-groesse, 1.5rem);
  block-size: var(--ikone-groesse, 1.5rem);

  background-color: currentColor;
  // Beide Schreibweisen: Safari braucht die praefixierte Fassung bis 15.4.
  -webkit-mask: var(--ikone-quelle) no-repeat center / contain;
  mask: var(--ikone-quelle) no-repeat center / contain;
}
```

**Zwei Dinge, die dabei zu beachten sind:**

1. **Das Symbol verschwindet, wenn die Datei fehlt** – lautlos, ohne kaputtes Bild. Das ist der
   Vorteil gegenüber `<img>` (siehe C1, Offline-Hinweis), aber es heisst auch: Ein Tippfehler im
   Namen fällt nicht auf. Deshalb prüft ein Test, dass jeder benutzte Name in `public/icons/` liegt
   (Abschnitt 9).
2. **Maskierte Symbole liegen nicht im Precache.** `includeAssets` in `vite.config.ts` führt heute
   nur `no_connection_icon_red.svg`. Symbole, die in der Anwendung dauernd sichtbar sind, gehören
   dort ergänzt – aber nur diese; der Precache soll die App-Shell bleiben.

### 6.3 Was mit den abweichenden Farbwerten geschieht

Nichts. Sobald die Symbole als Maske eingebunden sind, spielen ihre Füllfarben keine Rolle mehr –
die Farbe kommt aus dem Token der Umgebung. Die Dateien bleiben unangetastet, und die Doppelspurigkeit
aus B5 löst sich von selbst auf. Wer ein Symbol ausnahmsweise als Bild braucht (etwa das App-Logo),
nimmt es weiter als `<img>`.

---

## 7. Basis-Komponenten

### 7.0 Ein Helfer vorweg

```ts
// src/komponenten/klassen.ts
/**
 * Fügt Klassennamen zusammen und lässt leere Werte weg.
 *
 * Ersetzt `clsx`: Der Bedarf beschränkt sich auf diesen einen Fall, und eine
 * Abhängigkeit weniger ist eine Prüfung weniger bei jedem `npm audit`.
 */
export function klassen(...werte: (string | false | null | undefined)[]): string {
  return werte.filter(Boolean).join(' ')
}
```

### 7.1 Schaltfläche

```tsx
// src/komponenten/Schaltflaeche/Schaltflaeche.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { klassen } from '@/komponenten/klassen'
import style from './Schaltflaeche.module.scss'

/** Eigenschaften der Schaltfläche. */
type SchaltflaecheEigenschaften = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Gewicht der Aktion. `gefahr` ist für unwiderrufliche Schritte (A23). */
  art?: 'primaer' | 'sekundaer' | 'gefahr'
  /** Nimmt die volle Breite ein – der Normalfall in der Aktionsleiste. */
  breit?: boolean
  /** Zeigt einen Ladezustand und sperrt die Schaltfläche. */
  laedt?: boolean
  children: ReactNode
}

/**
 * Die Schaltfläche der Anwendung.
 *
 * `type` ist ausdrücklich vorbelegt: Ohne Angabe ist eine Schaltfläche im
 * Formular ein Absenden-Knopf, und ein „Abbrechen" schickte das Formular ab.
 *
 * Im Ladezustand bleibt die Beschriftung stehen und wird nicht durch einen
 * Wirbel ersetzt: Der Wechsel änderte die Breite und liesse den Nutzer im
 * Unklaren, was gerade läuft.
 */
export default function Schaltflaeche({
  art = 'sekundaer',
  breit = false,
  laedt = false,
  disabled,
  type = 'button',
  className,
  children,
  ...rest
}: SchaltflaecheEigenschaften) {
  return (
    <button
      type={type}
      className={klassen(style.schaltflaeche, style[art], breit && style.breit, className)}
      disabled={disabled || laedt}
      aria-busy={laedt || undefined}
      {...rest}
    >
      {children}
    </button>
  )
}
```

```scss
// src/komponenten/Schaltflaeche/Schaltflaeche.module.scss
@use '@/styles/globalVars';

.schaltflaeche {
  // 44 px sind das Mindestmass aus DESIGN.md; der Aktionsbereich liegt darueber.
  min-block-size: var(--tapziel-min);
  padding-inline: var(--abstand-l);

  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--abstand-s);

  border: 1px solid transparent;
  border-radius: var(--radius-m);
  font-size: var(--schrift-basis);
  font-weight: var(--gewicht-halbfett);
  cursor: pointer;
}

.primaer {
  background: var(--farbe-primaer);
  color: var(--farbe-primaer-kontrast);
}

.primaer:active {
  background: var(--farbe-primaer-dunkel);
}

.sekundaer {
  background: var(--farbe-hintergrund);
  color: var(--farbe-text);
  // Der bedienbare Rand, nicht der dekorative: Ohne ihn ist die Flaeche vom
  // Hintergrund nicht zu unterscheiden (1.4.11, Befund B1).
  border-color: var(--farbe-rand-bedienbar);
}

.gefahr {
  background: var(--farbe-fehler);
  color: #fff;
}

.breit {
  inline-size: 100%;
}

.schaltflaeche:disabled {
  // Nicht ueber die Deckkraft: Das nimmt auch dem Text den Kontrast und macht
  // die Beschriftung unlesbar statt die Schaltflaeche ruhig.
  background: var(--farbe-flaeche-kraeftig);
  color: var(--farbe-text-schwach);
  border-color: var(--farbe-rand);
  cursor: not-allowed;
}
```

### 7.2 Eingabefeld

Ein Feld ist nie nur ein Feld: Es trägt Beschriftung, Fehlertext und die Verbindung zwischen beiden.
Genau diese Verbindung wird sonst in jeder Ansicht neu vergessen.

```tsx
// src/komponenten/Feld/Feld.tsx (Auszug)
import { useId } from 'react'

/**
 * Beschriftetes Eingabefeld mit Fehlertext.
 *
 * `useId` statt eines übergebenen Bezeichners: Die Verknüpfung von Beschriftung,
 * Feld und Fehlertext muss eindeutig sein, auch wenn dieselbe Ansicht das Feld
 * zweimal zeigt. `aria-describedby` zeigt auf den Fehler, `aria-invalid` sagt,
 * dass es einen gibt – ein rot gefärbter Rahmen allein sagt es nur den
 * Sehenden.
 */
export default function Feld({ beschriftung, fehler, ...rest }: FeldEigenschaften) {
  const id = useId()
  const fehlerId = `${id}-fehler`

  return (
    <div className={style.feld}>
      <label className={style.beschriftung} htmlFor={id}>{beschriftung}</label>
      <input
        id={id}
        className={klassen(style.eingabe, fehler && style.ungueltig)}
        aria-invalid={fehler ? true : undefined}
        aria-describedby={fehler ? fehlerId : undefined}
        data-testid={rest['data-testid'] ?? 'feld-eingabe'}
        {...rest}
      />
      {fehler && (
        <p className={style.fehler} id={fehlerId} data-testid="feld-fehler">{fehler}</p>
      )}
    </div>
  )
}
```

Für die PIN-Eingabe in C3 gilt zusätzlich `inputMode="numeric"` und `autoComplete="one-time-code"` –
das gehört an die Aufrufstelle, nicht in die Komponente. **Kein `type="number"`:** Es bringt
Pfeilchen, erlaubt Exponentialschreibweise und schluckt führende Nullen – bei einer vierstelligen PIN
der falsche Typ.

### 7.3 Auswahlliste – nativ

Die Namensauswahl (A4/A6) wird ein natives `<select>`. Die Begründung ist für C3 tragend, deshalb
steht sie hier:

| | natives `<select>` | eigenes Listbox-Widget |
|---|---|---|
| Bedienung auf dem Telefon | System-Picker, einhändig, gross | eigenes Auf- und Zuklappen, eigene Trefferflächen |
| Tastatur und Screenreader | vollständig, ohne Code | vollständig nachzubauen (`aria-activedescendant`, Rollen, Fokusfalle) |
| Belegte Namen ausgrauen (A6) | `<option disabled>` | eigene Logik |
| Freie Gestaltung, Symbole je Eintrag | nein | ja |

Gebraucht wird aus der rechten Spalte nichts: A6 verlangt genau das Ausgrauen, und der Zusatz
„(Gast)" ist Text. Der System-Picker ist am Spielfeldrand die bessere Bedienung.

```tsx
<Auswahlliste beschriftung="Dein Name" value={name} onChange={...} data-testid="namensauswahl">
  <option value="">Bitte wählen</option>
  {namen.map((n) => (
    // `disabled` und der Zusatz im Text: Die Aussage haengt nicht an der Farbe.
    <option key={n.id} value={n.id} disabled={n.belegt}>
      {n.belegt ? `${n.anzeigeName} (bereits angemeldet)` : n.anzeigeName}
    </option>
  ))}
</Auswahlliste>
```

### 7.4 Fortschrittsbalken

```tsx
// src/komponenten/Fortschrittsbalken/Fortschrittsbalken.tsx
/**
 * Zeigt den Stand der Zusagen gegen die Mindestanzahl (A10).
 *
 * Kein `<progress>`: Das Element lässt sich nur über herstellereigene
 * Pseudoelemente einfärben, und die Farbe wechselt hier fachlich.
 *
 * **Die Aussage hängt nicht an der Farbe** (DESIGN.md): Neben dem Balken steht
 * immer der Text „x von y", und `aria-valuetext` sagt dasselbe noch einmal für
 * Screenreader. Rot allein wäre für rund acht Prozent der Männer keine Aussage.
 */
export default function Fortschrittsbalken({ wert, ziel, erreicht }: BalkenEigenschaften) {
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
          className={klassen(style.fuellung, erreicht ? style.erreicht : style.offen)}
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

Die Entscheidung „rot oder grün" trifft **der Server**: `mindestzahlErreicht` steht in der
Teilnehmerliste. Der Client rechnet sie nicht nach – sonst liefen zwei Wahrheiten auseinander,
sobald der Admin die Mindestanzahl ändert.

### 7.5 Erklärung (Info-Icon)

A8 verlangt eine einblendbare Erklärung am Gast-Eintrag. **Kein `title`-Attribut und kein
Hover-Tooltip:** Auf einem Telefon gibt es kein Hover, und `title` erscheint dort nie.

```tsx
/**
 * Info-Symbol, das einen erklärenden Text ein- und ausblendet.
 *
 * Ein Umschalter statt eines Tooltips: Auf Touchgeräten gibt es kein Hover,
 * und ein `title`-Attribut wird dort nie angezeigt. `aria-expanded` macht den
 * Zustand hörbar, die Schaltfläche hält das Tap-Ziel von 44 px ein.
 */
export default function Erklaerung({ text, beschriftung = 'Erklärung anzeigen' }: ErklaerungEigenschaften) {
  const [offen, setOffen] = useState(false)
  const id = useId()

  return (
    <>
      <button
        type="button"
        className={style.schalter}
        aria-expanded={offen}
        aria-controls={id}
        aria-label={beschriftung}
        onClick={() => setOffen((z) => !z)}
        data-testid="erklaerung-schalter"
      >
        <Ikone name="info_circle_icon" />
      </button>
      {offen && (
        <p className={style.text} id={id} data-testid="erklaerung-text">{text}</p>
      )}
    </>
  )
}
```

### 7.6 Dialog

```tsx
// src/komponenten/Dialog/Dialog.tsx
import { useEffect, useRef } from 'react'
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
 * `showModal()` bringt Fokusfalle, Inertisierung des Hintergrunds, `::backdrop`
 * und das Schliessen mit Escape vom Browser mit. Ein selbstgebauter Dialog
 * müsste all das nachbilden – und genau dort entstehen die Fehler, die nur mit
 * Tastatur oder Screenreader auffallen.
 */
export default function Dialog({ offen, titel, aufSchliessen, festhalten, children }: DialogEigenschaften) {
  const ref = useRef<HTMLDialogElement>(null)

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
      aria-labelledby="dialog-titel"
      onClose={aufSchliessen}
      onCancel={(e) => {
        // Escape darf eine laufende Eingabe nicht wegwerfen (DESIGN.md,
        // "Besonderheit: Sitzungsablauf").
        if (festhalten) e.preventDefault()
      }}
      data-testid="dialog"
    >
      <h2 id="dialog-titel" className={style.titel}>{titel}</h2>
      <div className={style.inhalt}>{children}</div>
    </dialog>
  )
}
```

```scss
.dialog {
  // Der Dialog liegt in der Top-Layer, ausserhalb des Rahmens aus AppLayout –
  // die Safe-Area-Raender von dort erreichen ihn nicht. Er braucht eigene.
  margin: auto auto 0;                       // auf dem Telefon unten andocken
  inline-size: min(100%, 32rem);
  padding: var(--abstand-l);
  padding-bottom: calc(var(--abstand-l) + var(--sicher-unten));

  border: 0;
  border-radius: var(--radius-l) var(--radius-l) 0 0;
  background: var(--farbe-hintergrund);
  color: var(--farbe-text);
}

.dialog::backdrop {
  background: rgb(0 0 0 / 45%);
}

@media (min-width: 40rem) {
  .dialog {
    margin: auto;
    border-radius: var(--radius-l);
  }
}
```

**Der Stub für die Tests** (Befund B10) gehört in `src/test/setup.ts`:

```ts
/**
 * Ergänzt jsdom um die fehlenden Methoden von `<dialog>`.
 *
 * jsdom 27 kennt `HTMLDialogElement`, implementiert aber weder `showModal` noch
 * `close`; ohne diesen Stub scheitert jeder Dialogtest mit
 * `showModal is not a function`. Nachgebildet werden nur das `open`-Attribut
 * und das `close`-Ereignis – Fokusfalle, Inertisierung und `::backdrop` sind
 * Browserverhalten und gehören in einen Playwright-Test.
 */
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

*Geprüft:* Mit diesem Stub laufen `showModal`, `close`, das `close`-Ereignis und `returnValue` in
Vitest durch. **Und eine Falle dazu:** jsdom rendert kein CSS, der Dialoginhalt steht auch im
geschlossenen Zustand im Baum. `getByRole('dialog')` findet ihn deshalb immer – ein Test muss
`dialog.open` prüfen, nicht die Auffindbarkeit.

### 7.7 Lade-, Leer- und Fehlerzustand

Die drei Zustände sind je eine Komponente, kein Schalter in jeder Ansicht.

```tsx
/**
 * Fehlerzustand einer Ansicht.
 *
 * Zeigt den Text des Servers und ersetzt ihn nicht: Der Kontrakt liefert
 * `detail` bereits deutschsprachig und oft genauer, als die Oberfläche
 * formulieren könnte (C1, Abschnitt 4.3). Eigene Worte gibt es nur dort, wo gar
 * keine Antwort kam – dann gibt es auch kein `detail`.
 *
 * **Erneut versuchen erscheint nicht immer.** Bei einem `409` oder `403` ändert
 * ein zweiter Versuch nichts; die Schaltfläche verspräche etwas, das sie nicht
 * halten kann.
 */
export default function Fehlerzustand({ fehler, erneut }: FehlerzustandEigenschaften) {
  const netzfehler = istNetzfehler(fehler)
  const apiFehler = fehler instanceof ApiFehler ? fehler : null
  const wiederholbar = netzfehler || (apiFehler?.status ?? 0) >= 500

  return (
    <div className={style.zustand} role="alert" data-testid="fehlerzustand">
      <Ikone name="error_circle_icon" />
      <p className={style.text}>
        {netzfehler
          ? 'Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung.'
          : (apiFehler?.message ?? 'Unbekannter Fehler.')}
      </p>
      {wiederholbar && erneut && (
        <Schaltflaeche art="sekundaer" onClick={erneut} data-testid="fehler-erneut">
          Erneut versuchen
        </Schaltflaeche>
      )}
    </div>
  )
}
```

**Der Ladezustand blendet verzögert ein.** Eine Antwort nach 80 ms mit einem Wirbel dazwischen wirkt
langsamer als eine Antwort nach 80 ms ohne:

```scss
.wirbel {
  animation: erscheinen 0.01s linear 150ms both;   // 150 ms Karenz
}
```

Der Leerzustand ist die dritte Komponente und trägt immer einen **Grund und einen nächsten Schritt**
(„Noch keine Zusagen. Sei der Erste."), nie nur „Keine Daten".

---

## 8. Nachzieharbeiten aus C0 und C1

### 8.1 Zurück-Navigation mit Zielangabe (Befund B8)

**Nachgemessen:** Beim Direkteinstieg – Deeplink oder Start der installierten PWA – steht
`history.state = {"idx":0}`. `history.length` taugt nicht als Erkennung (Wert 2 trotz
Direkteinstieg). Es gibt also einen verlässlichen Marker für „kein Vorgänger innerhalb der
Anwendung".

Die Schaltfläche bekommt deshalb zwei Wege und eine Reihenfolge:

```tsx
// In AppLayout: Ziel aus der Route, sonst ein Schritt zurueck, sonst zur Startseite.
const treffer = useMatches()
const ziel = treffer.findLast((t) => (t.handle as RoutenAngaben)?.zurueck)?.handle?.zurueck

function zurueck() {
  if (ziel) return void navigate(ziel)
  // `idx` stammt aus dem Verlaufszustand von React Router: 0 heisst Direkteinstieg.
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
  return void (idx > 0 ? navigate(-1) : navigate('/'))
}
```

Die Zielangabe steht an der Route, nicht in der Ansicht:

```tsx
{ path: 'teams/:terminId', element: <Teamansicht />, handle: { zurueck: '/' } }
```

**Warum nicht nur `navigate(-1)` mit Rückfall?** Weil „einen Schritt zurück" und „zur übergeordneten
Ansicht" verschiedene Dinge sind. Wer aus der Teamansicht in die Ergebniserfassung und wieder zurück
geht, landet mit `-1` erneut in der Ergebniserfassung. Die Zielangabe ist die Regel, `-1` die
Abkürzung, wo keine nötig ist.

### 8.2 Offline-Hinweis fertigstellen (Befund B9)

Der Streifen aus C1 bleibt in Aufbau und Verhalten unverändert – er bekommt die Tokens aus
Abschnitt 3 (Fläche `--farbe-fehler-flaeche`, Rand `--farbe-fehler`, Text `--farbe-text`) und das
Symbol über die `Ikone`-Komponente statt über den CSS-Hintergrund in der Komponentendatei.

**Der Precache-Eintrag bleibt.** `no_connection_icon_red.svg` steht in `includeAssets`; als Maske
wird die Datei weiterhin geladen, und offline ist sie nur aus dem Precache zu bekommen. Wer den
Eintrag entfernt, hat im Offline-Fall ein leeres Kästchen. Nach dem Umbau ist die Zahl der
Precache-Einträge zu prüfen: Sie muss **sechs** bleiben.

#### Die offene Stelle in `useVerbindung` (vermerkt im Code als TODO)

Der Hook meldet `verbunden: true`, solange zwei Dinge gelten: Der Browser sieht ein Netz, und kein
Aufruf ist ohne Antwort geblieben. **Hat noch gar kein Aufruf stattgefunden, ist die zweite
Bedingung leer** – der Hook sagt dann „verbunden", obwohl er nichts weiss. Sichtbar wird das auf
`/anmelden`: Die Ansicht löst heute keinen Aufruf aus, also fehlt der Gegenbeweis, und bei einem
WLAN ohne Weg ins Internet bleibt der Streifen aus.

Zwei Dinge gehören dazu, eines davon in C2:

1. **In C2:** Der dritte Parameter von `useSyncExternalStore` (`() => true`) ist der
   Server-Schnappschuss für das Rendern auf dem Server. Diese Anwendung rendert nirgends auf dem
   Server; der Parameter wird nie aufgerufen und liest sich trotzdem wie eine Zusicherung
   „verbunden". Er entfällt – der Aufruf mit zwei Argumenten ist gültig.
2. **In C3, nicht hier:** Den Gegenbeweis liefert erst ein Aufruf. Ab C3 laufen ohnehin zwei
   zyklische Abrufe (Sitzungs-Countdown und Belegtstatus der Namen, beide mit
   `X-FuBo-Kein-Refresh: true`). Jeder Zyklus beantwortet die Frage von selbst: Antwort heisst
   verbunden, Netzfehler heisst gestört. **Ein eigener Ping ist dafür nicht zu bauen** – er wäre ein
   dritter zyklischer Aufruf für eine Auskunft, die zwei andere nebenbei liefern, und
   `/actuator/health` ist laut Kontrakt ausdrücklich kein Teil der öffentlichen API.

Bis dahin bleibt der harte Fall abgedeckt: `navigator.onLine === false` zeigt den Streifen überall,
auch ohne Aufruf.

### 8.3 Der falsche Rand aus C0

Von den vier Stellen, die heute `--farbe-rand` benutzen, ist genau **eine** falsch: `.zurueck` in
`AppLayout.module.scss` – eine Schaltfläche, deren Grenze der Rand überhaupt erst zeigt. Die
Trennlinie unter dem Kopf, die Kante des Aktualisierungshinweises und die des Offline-Streifens
ordnen nur und dürfen dekorativ bleiben.

Die Zurück-Schaltfläche wird dabei zur `Schaltflaeche art="sekundaer"` – sie ist die erste
Anwenderin der neuen Komponente und zugleich die Probe, ob deren Masse stimmen. Ihre `data-testid`
bleibt `layout-zurueck`, sonst fallen vier E2E-Tests aus C0 um.

---

## 9. Tests in diesem Paket

| Was | Wo | Warum gerade das |
|---|---|---|
| `Schaltflaeche`: `type` ist ohne Angabe `button`; `laedt` sperrt und setzt `aria-busy` | `Schaltflaeche.test.tsx` | Der vorbelegte `type` verhindert, dass „Abbrechen" ein Formular abschickt – ein Fehler, der erst in C4 auffiele. |
| `Feld`: Beschriftung, Feld und Fehlertext sind verknüpft (`aria-describedby`, `aria-invalid`) | `Feld.test.tsx` | Die Verknüpfung ist unsichtbar und wird genau deshalb vergessen. |
| `Fortschrittsbalken`: Text und `aria-valuetext` nennen die Zahlen, unabhängig von der Farbe | `Fortschrittsbalken.test.tsx` | Die Vorgabe „nicht allein über Farbe" ist sonst nicht prüfbar. |
| `Dialog`: öffnet und schliesst über `offen`, meldet `close`, `festhalten` verhindert Escape | `Dialog.test.tsx` | Braucht den Stub aus 7.6. Prüft `dialog.open`, **nicht** die Auffindbarkeit im Baum. |
| `Fehlerzustand`: zeigt `ApiFehler.message`; „Erneut versuchen" erscheint bei `500` und Netzfehler, nicht bei `409` | `Fehlerzustand.test.tsx` | Die Anbindung an C1 – und die einzige Stelle, an der die Regel „kein eigener Text" durchgesetzt wird. |
| `Ikone`: jeder in der Anwendung benutzte Name liegt in `public/icons/` | `Ikone.test.ts` | Eine Maske mit falschem Dateinamen verschwindet lautlos (6.2). |
| Fokusring ist bei Tastaturbedienung sichtbar | `e2e/layout.spec.ts` | `:focus-visible` ist Browserverhalten und in jsdom nicht prüfbar. |
| Die Aktionsleiste verbraucht `--sicher-unten` | `e2e/layout.spec.ts` | Wie schon in C0: Der Wert ist unter Emulation `0px`; geprüft wird, ob das Layout das Token benutzt. |

Nach C1 stehen 35 Unit-Tests; C2 sollte auf etwa 55 bis 60 kommen.

---

## 10. Abnahme von C2

| # | Prüfung | Erwartet |
|---|---|---|
| 1 | `npm run typecheck` | Exitcode 0 über alle vier Teilprojekte |
| 2 | `npm run lint` | keine Fehler |
| 3 | `npm test` | grün, darunter die acht Gruppen aus Abschnitt 9 |
| 4 | `npm run build` | `dist/sw.js` weiterhin mit **sechs** Precache-Einträgen |
| 5 | `npm run test:e2e` | die 27 Chromium-Tests bleiben grün, ergänzt um Fokus und Aktionsleiste |
| 6 | `grep -rn "#[0-9a-fA-F]\{6\}" src --include=*.scss` | Treffer **nur** in `_globalVars.scss` |
| 7 | `grep -rn "darken(\|lighten(\|@import" src` | keine Treffer |
| 8 | Kontrastprüfung der neuen Tokens (Tabelle 3.2 nachrechnen) | jede Textpaarung ≥ 4.5:1, jede Bedienelementbegrenzung ≥ 3:1 |
| 9 | Tastaturdurchlauf durch `/anmelden` und einen offenen Dialog | Fokus überall sichtbar, Dialog hält den Fokus, Escape schliesst ihn |
| 10 | Ansicht bei 360 px Breite, Zoom 200 % | kein waagerechtes Scrollen, Aktionsleiste bleibt erreichbar |
| 11 | Handprüfung auf einem echten Telefon im Sonnenlicht | Beschriftungen lesbar, Schaltflächen einhändig erreichbar |

Prüfpunkt 6 ist der eigentliche Abnahmetest des Pakets: **Wenn ausserhalb von `_globalVars.scss`
noch ein Hexwert steht, ist das Design-System nicht das Design-System, sondern eine Empfehlung.**

---

## 11. Nachdokumentation und Commit

1. `client/harness/CONTEXT_HANDOFF_CLIENT.md` fortschreiben – Abschnitt 5 (C2 auf „abgeschlossen"),
   Abschnitt 6 (neuer Unterabschnitt zum Code-Zustand), Abschnitt 7 (nächste Schritte). Vorfassung
   zuvor unter `client/harness/archive/CONTEXT_HANDOFF_CLIENT_<Datum>.md` ablegen.
2. `client/harness/AGENT_CLIENT.md` um die Festlegungen aus C2 ergänzen: zwei Randrollen, Zustände
   über `color-mix`, Ikonen als Maske, natives `<select>`, `<dialog>` samt Test-Stub, keine Hexwerte
   ausserhalb der Tokendatei.
3. `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) nachziehen – Abschnitt „Client". Der Ordner
   liegt ausserhalb des Repositories und wird nicht mitcommittet.
4. Commit auf `dev_client`. **Nicht nach `main`.**

```bash
git add -A
git status            # letzte Sichtpruefung: keine .env, keine realen Namen
git commit -m "C2: Design-Tokens, Basis-Komponenten, Zustaende, Ikonen"
git push origin dev_client
```

---

## 12. Fallen, die bei der Vorab-Probe aufgefallen sind

**1. jsdom implementiert `showModal` nicht.** `HTMLDialogElement` existiert, `showModal` ist
`undefined`. Ohne den Stub aus 7.6 scheitert jeder Dialogtest. Dazu die zweite Hälfte derselben
Falle: jsdom rendert kein CSS, der Dialoginhalt steht auch geschlossen im Baum – `getByRole('dialog')`
beweist nichts, `dialog.open` schon.

**2. Die vorhandenen Ikonen folgen keiner Farbe.** Keine der 29 Dateien nutzt `currentColor`; alle
tragen feste Füllwerte. Als CSS-Maske eingebunden folgen sie `currentColor` trotzdem – in Chromium
nachgemessen für Gold auf Weiss, Weiss auf Grün und Grau im deaktivierten Zustand. Nebenbefund:
`warning_icon.svg` erreicht in seiner Eigenfarbe nur 2.51:1 und verfehlt damit 1.4.11.

**3. Die Randfarbe aus C0 ist zu schwach.** `#d6d8d6` gegen Weiss sind 1.43:1; verlangt sind 3:1 für
die Begrenzung eines Bedienelements. Betroffen ist die einzige Schaltfläche, die es bisher gibt.
Zwei Randrollen lösen das, eine einzige nicht.

**4. `history.length` erkennt den Direkteinstieg nicht.** Beim ersten Aufruf steht der Wert auf 2,
obwohl es keinen Vorgänger in der Anwendung gibt. `history.state.idx` steht dabei auf 0 und ist der
belastbare Marker. Wer die Zurück-Schaltfläche an `history.length` hängt, baut den Fehler aus C0
nach.

---

## 13. Ausblick C3

C3 („Sitzung und Spieler-Login") ist die erste Ansicht, die ein Spieler zu sehen bekommt, und sie
benutzt fast alles aus diesem Paket: `Feld` für die PIN, `Auswahlliste` für die Namen samt
ausgegrauten Einträgen (A6), `Erklaerung` am Gast-Eintrag (A8), `Dialog` für den Sitzungsablauf und
alle drei Zustände. Zwei Dinge aus C1 werden dort zum ersten Mal scharf geschaltet: der Kopf
`X-FuBo-Kein-Refresh` beim zyklischen Abruf der Namensliste und der Countdown auf `gueltigBis`.

Was C2 dafür offen lassen darf und soll: die fachliche Formulierung der Texte. Ein Leerzustand
braucht seinen Grund aus der Fachlichkeit, und die steht in C3 bis C8 – nicht hier.
