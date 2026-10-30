# C1 – Vertrag, Datenzugriff und Mocks (Umsetzungsanleitung)

> Schrittweise Anleitung zum Arbeitspaket **C1** (geschätzt 10 h).
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (Gesamtspezifikation), `client/harness/AGENT_CLIENT.md`
> (Systemprompt Client), `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (UI-Vorgaben).
> Kontrakt: `client/harness/assets/fubo-api.json` (OpenAPI 3.1, **44 Operationen**, 59 Schemata;
> am 26.09.2026 gegen `server/fubo-api.json` geprüft: byteweise identisch).
> Stand: 26.09.2026, Repository auf Branch `dev_client`, ausgehend von Commit `e6f8bad` plus den
> Korrekturen aus der C0-Nachprüfung (`CONTEXT_HANDOFF_CLIENT.md`, Abschnitt 6.1).
>
> **Die Kernbausteine dieser Anleitung sind vorab in einer Wegwerf-Kopie des Projekts ausgeführt
> worden** – Typgenerierung, fetch-Schicht und MSW liefen dort durch Typprüfung, Bau und Vitest. Wo
> im Folgenden „nachgemessen" steht, ist das Ergebnis dieser Probe und keine Vermutung. Abschnitt 13
> nennt die drei Fallen, die dabei aufgefallen sind.

---

## 0. Ziel und Abgrenzung

### 0.1 Ergebnis von C1

Nach C1 gibt es **einen** Weg, mit dem Server zu sprechen, und **einen** Weg, ohne ihn zu entwickeln:

- Aus `fubo-api.json` erzeugte TypeScript-Typen unter `src/api/schema.d.ts`, eingecheckt, mit einem
  npm-Skript zum Auffrischen.
- Eine HTTP-Schicht, die `credentials: 'include'` setzt, `204` von `200` unterscheidet und jede
  Fehlerantwort in einen `ApiFehler` mit `status`, `code` und deutschsprachigem Text übersetzt.
- Eine globale `401`-Behandlung: Query-Cache leeren, zur Anmeldung navigieren – an genau einer Stelle,
  nicht in jeder Ansicht.
- Eine Mock-Schicht (MSW), gegen die Unit- und Komponententests laufen, ohne dass ein Server läuft.
- Ein sichtbarer Offline-Hinweis, weil jede fachliche Aktion dieser Anwendung den Server braucht.
- `src/api/sitzung.ts` ist auf die neue Schicht umgestellt; die Signatur von `sitzungLesen` bleibt,
  damit die Routen-Guards aus C0 unberührt bleiben.

**C1 ist wie C0 kein fachliches Paket.** Es entsteht keine Ansicht, die ein Spieler benutzen könnte.
Was entsteht, ist die Unterlage, auf der C3 bis C8 jede einzelne Ansicht baut.

### 0.2 Nicht Teil von C1

| Thema | Paket |
|---|---|
| Design-Tokens, Basis-Komponenten (Button, Dropdown, Balken, Dialog, Lade-/Leer-/Fehlerzustand) | C2 |
| PIN-Login, Namensauswahl mit Polling, Gast, Sitzungs-Countdown, Auto-Logout als **Ansicht** | C3 |
| Admin-Login und Passwort-Reset | C4 |
| Termin, Zu-/Absage, Teilnehmerliste | C5 |
| Teamansicht, Generierung, Ergebniserfassung | C6 |
| Admin-Verwaltung | C7 |
| Push-Abonnement, Einstellungsansicht, Installations-Onboarding | C8 |
| Vollständige E2E-Suite, Barrierefreiheitsprüfung, Deployment | C9 |

Die Grenze zu C3 verläuft so: **C1 baut die Mechanik, C3 die Ansicht.** Die globale
`401`-Behandlung, das Werkzeug für den Polling-Kopf und der `sitzungLesen`-Aufruf gehören hierher;
der Countdown, die Schaltfläche „Sitzung verlängern" und die Namensauswahl gehören nach C3.

### 0.3 Warum dieses Paket vor allen fachlichen kommt

Drei Gründe, die jeweils teuer werden, wenn man sie verschiebt:

1. **Die Typen sind die Vertragsgrenze.** Ohne Generat schreibt jede Ansicht ihre eigenen Typen ab.
   Sie sind dann an acht Stellen leicht verschieden, und keine davon fällt beim Übersetzen auf, wenn
   der Server etwas ändert. Mit Generat bricht der Bau – genau dort, wo etwas zu tun ist.
2. **Fehlerbehandlung wandert nicht nachträglich nach unten.** Wer in C3 anfängt, `response.status`
   in der Komponente abzufragen, hat dieses Muster in C7 fünfzehnfach im Baum. Der Umbau danach ist
   teurer als die Schicht jetzt.
3. **Ohne Mocks gibt es keine Tests.** Der Server ist fachlich fertig (S0 bis S8), aber **nicht
   ausgeliefert** – S9 (Härtung, Deployment) steht aus. Bis dahin gibt es ausser einer lokal
   gestarteten Instanz kein Gegenüber, und CI hat ohnehin keines.

---

## 1. Befund des Ist-Zustands

Geprüft am 26.09.2026 am Stand nach der C0-Nachprüfung.

| Nr. | Befund | Wirkung | Schritt |
|---|---|---|---|
| B1 | Kein Generat aus `fubo-api.json` vorhanden | Jede Ansicht müsste Typen abschreiben. | 3 |
| B2 | `src/api/sitzung.ts` enthält einen eigenen `fetch` und handgeschriebene Typen | Bewusst vorläufig aus C0, damit der Routen-Schutz stehen konnte. Zwei Wege zum Server sind einer zu viel. | 5, 7 |
| B3 | Keine Übersetzung von `ProblemDetail` | Der Server liefert zu jedem Fehler einen deutschsprachigen `detail` und einen von **34** `code`-Werten. Ungenutzt zeigt die Oberfläche „Failed to fetch". | 4 |
| B4 | `401` wird nirgends global behandelt | A14 verlangt automatischen Logout bei `401`. Im Kontrakt steht `401` an **44** Operationen (40 über `$ref`, 4 inline) – also praktisch überall. | 6 |
| B5 | `queryClient` hat `retry: 1` für alle Abfragen | Ein `401`, `403` oder `409` wird dadurch stumpf wiederholt. Bei `429` (PIN-Sperre) verschärft die Wiederholung die Sperre. | 6.1 |
| B6 | Keine Mock-Schicht | Tests brauchen ein Gegenüber; CI hat keines. | 8 |
| B7 | Kein Offline-Hinweis | `AGENT_CLIENT.md` verlangt ihn ausdrücklich. `no_connection_icon_red.svg` ist bereits im Precache (nachgemessen). | 9 |
| B8 | `X-FuBo-Kein-Refresh` wird nirgends gesetzt | Der Kontrakt sieht den Kopf für zyklische Abrufe vor (`GET /auth/session/lesen`, `GET /auth/users/lesen`). Ohne ihn läuft das gleitende Sitzungsfenster nie ab, solange ein Tab offen ist. | 5.3 |

**Was der Kontrakt vorgibt** – die vier Zahlen, an denen die ganze Schicht hängt (alle ausgezählt,
nicht geschätzt):

- **23 von 44 Operationen antworten mit `204 No Content`.** Ein `await antwort.json()` darauf wirft
  `SyntaxError: Unexpected end of JSON input`. Das betrifft fast jede schreibende Aktion:
  PIN prüfen, Name wählen, Rückmeldung, Konfiguration ändern, Termin absagen.
- **Jede Fehlerantwort hat den Inhaltstyp `application/problem+json`**, nie `application/json`.
- **`401` steht an 44 Operationen, `403` an 34, `400` an 31, `409` an 19, `404` an 16, `429` an 5,
  `503` an 4.**
- **`429` trägt die Restwartezeit im Rumpf** (`wartesekunden`) *und* im Kopf `Retry-After`. Der
  Kontrakt begründet die Doppelung selbst: Ohne `Access-Control-Expose-Headers` ist der Kopf
  fremdursprünglich nicht lesbar. **Also den Rumpf auswerten, nicht den Kopf.**

---

## 2. Vorbereitung

### 2.1 Branch

```bash
git checkout dev_client
git pull --ff-only
git switch -c dev_client_c1        # optionaler Feature-Branch fuer C1
```

### 2.2 Abhängigkeiten – und eine Falle

```bash
npm install -D msw
```

Das genügt. **`openapi-typescript` wird bewusst nicht installiert.** Der Grund ist nachgemessen:

```
npm error peer typescript@"^5.x" from openapi-typescript@7.13.0
```

Das Werkzeug erklärt sich nur mit TypeScript 5 verträglich; das Projekt fährt TypeScript 6. Der
Aufruf bricht mit `ERESOLVE` ab. Drei Wege stehen offen:

| Weg | Bewertung |
|---|---|
| `--legacy-peer-deps` | Schreibt einen Baum in die Sperrdatei, den npm selbst für unzulässig hält. Der Zwang wäre dauerhaft, die Begründung in einem Jahr vergessen. |
| `.npmrc` mit `legacy-peer-deps=true` | Hebt die Peer-Prüfung für **alle** Pakete auf, nicht nur für dieses. Ein Schaden mit grossem Radius für einen Nutzen mit kleinem. |
| **`npx` mit fester Fassung** | Gewählt. Das Werkzeug läuft **einmal** und erzeugt eine Datei; danach wird es nicht mehr gebraucht, weil das Generat eingecheckt ist. Es gehört damit nicht in die Abhängigkeiten – auch nicht als Entwicklungsabhängigkeit, und schon gar nicht in `npm ci` auf dem CI-Läufer. |

Dass das Generat unter TypeScript 6 sauber übersetzt, ist geprüft: 4638 Zeilen, Typprüfung mit
`strict` ohne Befund. Die Peer-Angabe ist eine Vorsichtsangabe des Herstellers, kein tatsächlicher
Konflikt. **Bei der nächsten Auffrischung trotzdem kurz gegenprüfen** – deshalb steht die Fassung im
Skript und nicht ein `@latest`.

`msw@2.15.0` installiert dagegen konfliktfrei (Peer `typescript >= 4.8.x`).

### 2.3 Kontrakt-Kopie prüfen

```bash
diff ../server/fubo-api.json harness/assets/fubo-api.json && echo "identisch"
```

Am 26.09.2026 identisch. **Massgeblich bleibt `server/fubo-api.json`.** Vor jeder Typgenerierung
diesen Vergleich fahren: Ein veralteter Kontrakt ist teurer als ein fehlender, weil das Generat
daraus richtig aussieht.

---

## 3. Typen aus dem Kontrakt erzeugen

### 3.1 Skript

```jsonc
// package.json – scripts ergaenzen
"api:typen": "npx --yes openapi-typescript@7.13.0 harness/assets/fubo-api.json -o src/api/schema.d.ts"
```

```bash
npm run api:typen
```

**Das Generat wird eingecheckt.** Drei Gründe: Der Bau bleibt ohne Netz und ohne Zusatzwerkzeug
lauffähig, CI braucht `npx` nicht, und – der wichtigste – **eine Vertragsänderung wird im Diff
sichtbar**. Ein erzeugtes und weggeworfenes Artefakt zeigt niemandem, dass der Server ein Feld
umbenannt hat.

Das Generat wird **nie von Hand bearbeitet**; der Dateikopf sagt das auch.

### 3.2 Was darin steht und wie man es benutzt

Drei Einstiegspunkte, mehr braucht man nicht:

```ts
import type { components, operations, paths } from '@/api/schema'

/** Ein Datentyp aus dem Kontrakt. */
type SitzungInfo = components['schemas']['SitzungInfo']

/** Der Rumpf einer bestimmten Antwort. */
type Teilnehmerliste =
  operations['terminLesen']['responses'][200]['content']['application/json']
```

`paths` braucht man nur, wenn man einen typisierten Klienten generieren liesse – hier nicht.

**Eine Eigenheit, die beim ersten Mock auffällt:** `ProblemDetail.type` hat im Kontrakt einen
Vorgabewert (`about:blank`) und ist im Generat deshalb **Pflichtfeld**. Ein handgeschriebenes
Fehlerobjekt in einem Test muss `type` mitgeben, sonst meldet der Übersetzer `TS2741`.

---

## 4. Fehler übersetzen

### 4.1 `src/api/fehler.ts`

```ts
import type { components } from '@/api/schema'

/** Einheitliches Fehlerformat des Servers (RFC 9457). */
export type ProblemDetail = components['schemas']['ProblemDetail']

/** Maschinenlesbarer Fehlercode; 34 Werte im Kontrakt. */
export type Fehlercode = components['schemas']['Fehlercode']

/**
 * Fehler eines API-Aufrufs.
 *
 * Traegt drei Dinge getrennt: den Statuscode fuer die Ablaufsteuerung, den
 * `code` fuer die Programmlogik und `message` als bereits deutschsprachigen
 * Anzeigetext des Servers.
 */
export class ApiFehler extends Error {
  readonly status: number
  readonly code: Fehlercode | 'UNBEKANNT'
  /** Nur bei 429: Restwartezeit in Sekunden (aus dem Rumpf, nicht aus Retry-After). */
  readonly wartesekunden?: number

  constructor(status: number, code: Fehlercode | 'UNBEKANNT', text: string, wartesekunden?: number) {
    super(text)
    this.name = 'ApiFehler'
    this.status = status
    this.code = code
    this.wartesekunden = wartesekunden
  }
}
```

### 4.2 Warum `code` und nicht `detail` die Logik steuert

Der Kontrakt sagt es selbst: *„Massgeblich ist `code`, nicht `detail`. Der Meldungstext ist
Anzeigetext und darf sich ohne Vertragsänderung ändern."* Eine Verzweigung über den Text bräche,
sobald jemand ein Komma ändert.

### 4.3 Warum es **keine** Übersetzungstabelle im Frontend gibt

Es liegt nahe, eine Abbildung `Fehlercode → deutscher Text` anzulegen. **Das wäre ein zweiter Ort für
dieselbe Wahrheit.** Der Server liefert `detail` bereits deutschsprachig und formuliert ihn oft
genauer, als das Frontend könnte („Bitte in 58 Sekunden erneut versuchen"). Der Anzeigetext ist
deshalb grundsätzlich `detail`.

Eigene Formulierungen gibt es nur an zwei Stellen, und beide sind Ausnahmen mit Grund:

- **Wenn gar keine Antwort kommt** (Netzfehler, Server nicht erreichbar). Dann gibt es kein `detail`.
- **Wenn die Oberfläche mehr weiss als der Server**, etwa weil sie einen Fehler in ein Formularfeld
  schreibt statt in einen Kasten. Das entsteht in den fachlichen Paketen, nicht hier.

Der Fall „unbekannter `code`" braucht keine Sonderbehandlung: Der Kontrakt hält ausdrücklich fest,
dass die Liste wächst und ein unbekannter Wert wie ein allgemeiner Fehler zu behandeln ist. Genau
das passiert, wenn man den Text anzeigt und nur bei bekannten Codes verzweigt.

---

## 5. Die HTTP-Schicht

### 5.1 `src/api/httpService.ts`

```ts
import { ApiFehler, type Fehlercode } from '@/api/fehler'

const BASIS = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Zusatzangaben eines Aufrufs. */
export type AufrufOptionen = {
  /** Wird als JSON gesendet. Fehlt er, geht kein Rumpf und kein Content-Type hinaus. */
  body?: unknown
  /** Hintergrundaufruf: verlaengert das gleitende Sitzungsfenster nicht (siehe 5.3). */
  keinRefresh?: boolean
  signal?: AbortSignal
}

/**
 * Fuehrt einen Aufruf gegen die API aus.
 *
 * Wirft bei jeder Fehlerantwort einen {@link ApiFehler}; der Aufrufer muss den
 * Statuscode nicht kennen. Bei `204` liefert die Funktion `undefined` – das
 * betrifft 23 der 44 Operationen.
 */
export async function aufrufen<T>(
  methode: 'GET' | 'POST',
  pfad: string,
  optionen: AufrufOptionen = {},
): Promise<T> {
  const header: Record<string, string> = { Accept: 'application/json' }
  if (optionen.body !== undefined) header['Content-Type'] = 'application/json'
  if (optionen.keinRefresh) header['X-FuBo-Kein-Refresh'] = 'true'

  const antwort = await fetch(`${BASIS}${pfad}`, {
    method: methode,
    // Das Sitzungscookie ist HttpOnly. Ohne diese Zeile geht es nicht mit,
    // und jeder Aufruf antwortet mit 401 (AGENT_CLIENT.md).
    credentials: 'include',
    headers: header,
    body: optionen.body === undefined ? undefined : JSON.stringify(optionen.body),
    signal: optionen.signal,
  })

  if (!antwort.ok) throw await erstelleFehlerAntwort(antwort)
  // 23 von 44 Operationen antworten ohne Rumpf; `json()` wuerfe hier.
  if (antwort.status === 204) return undefined as T
  return (await antwort.json()) as T
}

/** Uebersetzt eine Fehlerantwort in einen ApiFehler. */
async function erstelleFehlerAntwort(antwort: Response): Promise<ApiFehler> {
  try {
    const inhalt = (await antwort.json()) as {
      code?: Fehlercode
      detail?: string
      wartesekunden?: number
    }
    return new ApiFehler(
      antwort.status,
      inhalt.code ?? 'UNBEKANNT',
      inhalt.detail ?? 'Unbekannter Fehler.',
      // Aus dem Rumpf, nicht aus Retry-After: der Kopf ist fremdursprünglich
      // ohne Access-Control-Expose-Headers nicht lesbar (so der Kontrakt).
      inhalt.wartesekunden,
    )
  } catch {
    // Kein JSON im Rumpf: Gegenstelle antwortet nicht wie vereinbart
    // (Proxy-Fehlerseite, abgebrochene Verbindung, HTML statt JSON).
    return new ApiFehler(antwort.status, 'UNBEKANNT', 'Der Server ist nicht erreichbar.')
  }
}
```

**`fetch` wirft nur bei Netzfehlern**, nicht bei `4xx`/`5xx`. Ein `try/catch` um `aufrufen` fängt
also beides: den `ApiFehler` aus dieser Schicht und den `TypeError` des Browsers, wenn gar nichts
ankommt. Beides ist in der Oberfläche unterschiedlich zu behandeln – der zweite Fall ist der
Offline-Hinweis aus Schritt 9.

### 5.2 Warum keine generierte Klientenbibliothek

`openapi-fetch` oder ein ähnliches Paket nähme diese dreissig Zeilen ab und brächte dafür eine
Abhängigkeit, eine zweite Typenwelt und eine eigene Fehlerkonvention mit. Bei **zwei** Methoden
(`GET`, `POST`), **einem** Inhaltstyp und **einem** Fehlerformat lohnt das nicht. Die Typsicherheit
kommt ohnehin aus dem Generat und nicht aus dem Klienten.

### 5.3 Der Kopf `X-FuBo-Kein-Refresh`

Zwei Operationen im Kontrakt nehmen ihn entgegen: `GET /auth/session/lesen` und
`GET /auth/users/lesen`. Beide werden ab C3 **zyklisch** abgerufen – die eine für den Countdown, die
andere für das Ausgrauen belegter Namen (A6).

Der Kontrakt formuliert die Folge unmissverständlich: *„Ohne den Header liefe das gleitende Fenster
nie ab, solange ein Browser-Tab offen ist."* Ein Countdown, der sich durch seine eigene Abfrage
zurücksetzt, zählt nie zu Ende.

Die Richtung ist bewusst so gewählt, dass ein Tippfehler zum **bisherigen** Verhalten führt: Nur der
exakte Wert `true` zählt. Deshalb gehört der Kopf in die Schicht und nicht in jede Aufrufstelle –
`keinRefresh: true` ist schwerer falsch zu schreiben als eine Zeichenkette.

---

## 6. Query-Schlüssel und globale `401`-Behandlung

### 6.1 Wiederholungen begrenzen (B5)

```ts
// src/app/queryClient.ts – defaultOptions.queries.retry ersetzen
import { ApiFehler } from '@/api/fehler'

retry: (versuch, fehler) => {
  // Fachliche Ablehnungen sind endgueltig: Ein zweiter Versuch aendert nichts
  // und verschaerft bei 429 sogar die Sperre.
  if (fehler instanceof ApiFehler && fehler.status < 500) return false
  return versuch < 1
},
```

`retry: 0` bei Mutationen bleibt unverändert – die Begründung aus C0 gilt weiter (A21: der erste
Ergebniseintrag gilt; A15: Generierungsläufe zählen gegen ein Kontingent).

### 6.2 `401` an genau einer Stelle

```ts
// src/app/queryClient.ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

/**
 * Wird bei jedem `401` gerufen: Die Sitzung ist abgelaufen oder widerrufen.
 * Setzt `window.location` bewusst nicht selbst – das Umleiten uebernimmt der
 * Router (siehe 6.3), damit der Zustand der Anwendung erhalten bleibt.
 */
let beiSitzungsende: () => void = () => {}

/** Hinterlegt den Rueckruf fuer den Sitzungsablauf. Einmal beim Start aufgerufen. */
export function sitzungsendeBehandeln(rueckruf: () => void) {
  beiSitzungsende = rueckruf
}

function pruefen(fehler: unknown) {
  if (fehler instanceof ApiFehler && fehler.status === 401) {
    queryClient.clear()   // keine Daten der alten Sitzung im Speicher lassen
    beiSitzungsende()
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: pruefen }),
  mutationCache: new MutationCache({ onError: pruefen }),
  defaultOptions: { /* wie bisher, mit retry aus 6.1 */ },
})
```

**Warum `queryClient.clear()` und nicht nur eine Umleitung?** Der Cache überlebt den Seitenwechsel
im Router. Ohne das Leeren sähe die nächste angemeldete Person kurz die Daten der vorigen – auf einem
Gerät, das am Spielfeldrand herumgereicht wird, ist das kein theoretischer Fall.

**Warum ein Rückruf statt `window.location.href = '/anmelden'`?** Ein harter Seitenwechsel wirft die
ganze Anwendung weg, lädt sie neu und lässt den Nutzer auf ein weisses Bild sehen. Der Router kann
dasselbe ohne Neuladen.

### 6.3 Den Rückruf anmelden

```tsx
// src/app/SitzungsWaechter.tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { sitzungsendeBehandeln } from '@/app/queryClient'

/**
 * Verbindet die globale 401-Behandlung mit dem Router. Rendert nichts.
 * Gehoert einmal in den Baum, innerhalb des RouterProvider.
 */
export default function SitzungsWaechter() {
  const navigate = useNavigate()
  useEffect(() => {
    sitzungsendeBehandeln(() => void navigate('/anmelden', { replace: true }))
  }, [navigate])
  return null
}
```

Die Komponente wird in `AppLayout` eingehängt, neben `AktualisierungsHinweis`.

### 6.4 Query-Schlüssel an einem Ort

```ts
// src/api/schluessel.ts
/**
 * Alle Query-Schluessel der Anwendung.
 *
 * An einem Ort, weil das Invalidieren sonst rät: Nach einer Zu-/Absage muss
 * die Teilnehmerliste neu geladen werden, und wer den Schluessel dort
 * abschreibt, trifft ihn irgendwann knapp daneben - ohne Fehlermeldung, nur
 * mit einer Ansicht, die alte Zahlen zeigt.
 */
export const schluessel = {
  sitzung: ['sitzung'] as const,
  namensliste: ['namensliste'] as const,
  termine: ['termine'] as const,
  termin: (terminId: string) => ['termin', terminId] as const,
  teams: (terminId: string) => ['teams', terminId] as const,
  bilanz: ['bilanz'] as const,
  pushStatus: ['push', 'status'] as const,
} as const
```

`SITZUNG_SCHLUESSEL` aus `src/hooks/useSitzung.ts` wird durch `schluessel.sitzung` ersetzt.

---

## 7. `src/api/sitzung.ts` ablösen

Die Datei war in C0 ausdrücklich vorläufig. Jetzt wird sie zur ersten regulären Ressource – und zum
Muster für alle weiteren.

```ts
// src/api/sitzung.ts
import { aufrufen } from '@/api/httpService'
import { ApiFehler } from '@/api/fehler'
import type { components } from '@/api/schema'

/** Zustand der eigenen Sitzung, wie der Server ihn meldet. */
export type SitzungInfo = components['schemas']['SitzungInfo']

/**
 * Liest die laufende Sitzung.
 *
 * Gibt bei `401` bewusst `null` zurueck statt zu werfen: „keine Sitzung" ist
 * der Normalzustand eines nicht angemeldeten Besuchers und kein Fehlerfall.
 * Zugleich darf dieser eine Aufruf die globale Abmeldung **nicht** ausloesen -
 * sonst leitete schon der Startaufruf jeden Besucher um.
 *
 * @param keinRefresh Bei zyklischen Abrufen `true` setzen (Countdown ab C3).
 */
export async function sitzungLesen(keinRefresh = false): Promise<SitzungInfo | null> {
  try {
    return await aufrufen<SitzungInfo>('GET', '/auth/session/lesen', { keinRefresh })
  } catch (fehler) {
    if (fehler instanceof ApiFehler && fehler.status === 401) return null
    throw fehler
  }
}
```

**Die Signatur bleibt aufwärtskompatibel** (der neue Parameter hat einen Vorgabewert), die Guards aus
C0 bleiben also unberührt. Die handgeschriebenen Typen `Stage`, `Rolle` und `SitzungInfo` entfallen;
wer sie importiert hat, nimmt sie künftig aus `components['schemas'][...]`.

> **Achtung, sonst dreht sich die Anwendung im Kreis:** `sitzungLesen` fängt den `401` selbst ab.
> Täte es das nicht, liefe der Startaufruf jedes nicht angemeldeten Besuchers in die globale
> Behandlung aus 6.2, die auf `/anmelden` umleitet – wo derselbe Aufruf wieder stattfindet. Der Fall
> ist genau deshalb hier notiert und nicht in einem Kommentar weiter unten.

---

## 8. Mock-Schicht (MSW)

### 8.1 Warum MSW und nicht `vi.mock('fetch')`

Ein gemocktes `fetch` prüft, dass die Anwendung eine Funktion aufruft. MSW fängt auf der Netzebene ab
und prüft, dass sie **die richtige Anfrage stellt** – Pfad, Methode, Rumpf, Kopfzeilen. Genau dort
liegen die Fehler, die später im Betrieb auffallen: ein vergessenes `credentials`, ein falscher Pfad,
ein fehlender Kopf. Ausserdem laufen dieselben Handler später in Playwright und im Browser.

### 8.2 Handler

```ts
// src/test/mocks/handlers.ts
import { HttpResponse, http } from 'msw'
import type { components } from '@/api/schema'

/** Beispielsitzung. Keine realen Personennamen (Vorgabe AGENT_CLIENT.md). */
const sitzung: components['schemas']['SitzungInfo'] = {
  stage: 'PROFILE_AUTHENTICATED',
  rolle: 'USER',
  anzeigeName: 'Beispielspieler 03',
  gueltigBis: '2026-09-26T16:12:00Z',
  absolutGueltigBis: '2026-09-26T17:00:00Z',
}

export const handlers = [
  // `*` vor dem Pfad: der Praefix kommt aus VITE_API_BASE_URL und ist im Test
  // relativ. Ein absoluter Mustertext ginge in Vitest und im Browser
  // auseinander.
  http.get('*/auth/session/lesen', () => HttpResponse.json(sitzung)),

  // 204: kein Rumpf. Genau der Fall, den 23 Operationen liefern.
  http.post('*/auth/pin/pruefen', () => new HttpResponse(null, { status: 204 })),

  // Fehlerfall im Vertragsformat - `type` ist Pflichtfeld im Generat.
  http.post('*/termine/rueckmeldung', () =>
    HttpResponse.json(
      {
        type: 'about:blank',
        status: 409,
        code: 'TERMIN_GESCHLOSSEN',
        detail: 'Der Termin ist geschlossen.',
      },
      { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
    ),
  ),
]
```

### 8.3 Einbindung in Vitest

```ts
// src/test/setup.ts – ergaenzen
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { handlers } from './mocks/handlers'

export const mockServer = setupServer(...handlers)

// `error` statt `warn`: Eine nicht abgedeckte Anfrage ist eine Luecke im Test,
// keine Nebensaechlichkeit. Sie faellt sonst erst im Betrieb auf.
beforeAll(() => mockServer.listen({ onUnhandledRequest: 'error' }))
afterEach(() => mockServer.resetHandlers())
afterAll(() => mockServer.close())
```

Einzelne Tests überschreiben einen Handler gezielt mit `mockServer.use(...)` – das `resetHandlers`
nach jedem Test stellt den Ausgangszustand wieder her.

*Geprüft:* Diese Einbindung läuft in der vorhandenen jsdom-Umgebung ohne zusätzliche Polyfills; drei
Beispieltests gegen `aufrufen` (JSON, `204`, `ProblemDetail`) waren grün.

### 8.4 Der Browser-Modus – zwei Fallen, beide nachgemessen

Für `npm run dev` ohne Server gäbe es zusätzlich den Browser-Modus
(`npx msw init public/`). **Er ist optional und in diesem Projekt mit Vorsicht zu geniessen.**

**Falle 1: MSW bringt einen zweiten Service Worker mit.** `msw init` legt
`public/mockServiceWorker.js` an und registriert ihn im Geltungsbereich `/` – demselben, den der
PWA-Worker aus C0 beansprucht. Ein Geltungsbereich trägt genau **eine** Registrierung: Die zweite
ersetzt die erste. Je nach Reihenfolge funktioniert dann entweder das Mocking nicht oder der
PWA-Worker nicht, und zwar stillschweigend. Da `devOptions.enabled: true` gesetzt ist, tritt der Fall
unter `npm run dev` sofort ein.

**Falle 2: Die Datei landet im Produktionsbau und im Precache.** `public/` wird unverändert nach
`dist/` kopiert, und `globPatterns: ['**/*.{js,css,html,woff2}']` greift sie auf. Nachgemessen:
**sieben** Precache-Einträge statt sechs, der Mock-Worker mittendrin – ausgeliefert an alle Spieler.

Wer den Browser-Modus trotzdem will, braucht beides:

```ts
// vite.config.ts – injectManifest ergaenzen
injectManifest: {
  globPatterns: ['**/*.{js,css,html,woff2}'],
  // Der Mock-Worker ist ein Entwicklungswerkzeug und gehoert nicht in den
  // Precache. Nachgemessen: ohne diese Zeile sieben statt sechs Eintraege.
  globIgnores: ['**/mockServiceWorker.js'],
},
```

```ts
// src/main.tsx – vor dem Rendern
if (import.meta.env.DEV && import.meta.env.VITE_MOCKS === '1') {
  const { worker } = await import('@/test/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}
```

Und zusätzlich `devOptions.enabled: false`, solange mit Mocks entwickelt wird – sonst streiten sich
die beiden Worker. **Empfehlung: den Browser-Modus zurückstellen.** Für die Entwicklung gegen echte
Daten steht der lokale Server bereit, für Tests reicht der Node-Modus, und die PWA-Prüfung unter
`npm run dev` ist mehr wert als ein Mock im Browser. Fällt die Entscheidung anders aus, gehört sie in
`CONTEXT_HANDOFF_CLIENT.md`.

---

## 9. Offline-Hinweis

`AGENT_CLIENT.md` verlangt ihn ausdrücklich: *„Im Offline-Modus muss dem User ein entsprechender
Hinweis angezeigt werden, dass die Funktionen der Anwendung eine stabile Verbindung zum Server
benötigen."* Das ist kein Widerspruch zu „Offline-Fähigkeit ist kein Ziel", sondern die Folge davon:
Weil nichts offline geht, muss der Zustand **sichtbar** sein statt in Fehlermeldungen einzelner
Aktionen zu zerfallen.

```ts
// src/hooks/useVerbindung.ts
import { useEffect, useState } from 'react'

/**
 * Meldet, ob der Browser eine Netzverbindung sieht.
 *
 * `navigator.onLine` ist notorisch optimistisch: Es meldet `true`, sobald eine
 * Verbindung zu irgendeinem Netz besteht - auch zu einem WLAN ohne Weg ins
 * Internet. Der Wert taugt deshalb nur fuer die eine sichere Richtung:
 * `false` heisst zuverlaessig „offline", `true` heisst nur „vielleicht".
 *
 * Der Gegenbeweis kommt aus der Praxis: Ein fehlgeschlagener Aufruf meldet
 * sich ueber {@link verbindungAlsGestoertMelden}.
 */
export function useVerbindung(): { verbunden: boolean } {
  const [verbunden, setVerbunden] = useState(() => navigator.onLine)

  useEffect(() => {
    const an = () => setVerbunden(true)
    const aus = () => setVerbunden(false)
    window.addEventListener('online', an)
    window.addEventListener('offline', aus)
    return () => {
      window.removeEventListener('online', an)
      window.removeEventListener('offline', aus)
    }
  }, [])

  return { verbunden }
}
```

Die Anzeige selbst ist ein schmaler Streifen im `AppLayout`, gestaltet wie der
`AktualisierungsHinweis` – Ikone `no_connection_icon_red.svg` (liegt bereits im Precache), Text
etwa „Keine Verbindung. Die Anwendung braucht den Server; Eingaben werden nicht gespeichert.",
`role="status"`, `data-testid="offline-hinweis"`. Die endgültige Gestaltung kommt mit dem
Design-System in C2; hier zählt, dass der Zustand überhaupt sichtbar ist.

> **Was der Hinweis nicht tut:** Er sperrt keine Schaltflächen und legt keine Warteschlange an. Eine
> lokal zwischengespeicherte Zusage widerspräche A15 (`teilnehmer_version`) und A21 („der erste
> Eintrag gilt") – siehe `AGENT_CLIENT.md`, „Offline-Fähigkeit ist kein Ziel".

---

## 10. Tests in diesem Paket

Die Werkzeuge stehen seit C0; die Tests entstehen mit dem Code. Für C1 sind es vier Gruppen:

| Was | Wo | Warum gerade das |
|---|---|---|
| `aufrufen`: JSON-Antwort, `204` ohne Rumpf, `ProblemDetail` → `ApiFehler`, Netzfehler → `UNBEKANNT` | `src/api/http.test.ts` | Die vier Wege durch die Schicht. Der `204`-Fall betrifft 23 Operationen. |
| `credentials: 'include'` und `X-FuBo-Kein-Refresh` gehen tatsächlich hinaus | `src/api/http.test.ts` | Beides fällt sonst erst im Betrieb auf – das eine als Dauer-`401`, das andere als Sitzung, die nie abläuft. |
| `sitzungLesen` liefert bei `401` `null` und löst **keine** Umleitung aus | `src/api/sitzung.test.ts` | Der Ringschluss aus Schritt 7. |
| Globale `401`-Behandlung leert den Cache und ruft den Rückruf | `src/app/queryClient.test.ts` | Die Stelle, an der zwei Sitzungen sich sonst vermischen. |

Die Zählung nach C0 lag bei neun Unit-Tests; C1 sollte sie etwa verdoppeln.

---

## 11. Abnahme von C1

| # | Prüfung | Erwartet |
|---|---|---|
| 1 | `diff ../server/fubo-api.json harness/assets/fubo-api.json` | identisch |
| 2 | `npm run api:typen` | erzeugt `src/api/schema.d.ts` ohne Fehler; Datei ist eingecheckt |
| 3 | `npm run typecheck` | Exitcode 0 über alle vier Teilprojekte |
| 4 | `npm run lint` | keine Fehler |
| 5 | `npm test` | alle Tests grün, darunter die vier Gruppen aus Abschnitt 10 |
| 6 | **`npm ci` in einem frischen Baum** | läuft durch (die Lehre aus der C0-Nachprüfung) |
| 7 | `npm run build` | `dist/sw.js` mit **sechs** Precache-Einträgen – kein `mockServiceWorker.js` |
| 8 | `npm run test:e2e` | die 27 Chromium-Tests bleiben grün |
| 9 | `npm run dev` gegen den laufenden Server, Netzwerkansicht des Browsers | jeder Aufruf trägt das Sitzungscookie; `GET /auth/session/lesen` liefert `200` |
| 10 | Server anhalten, Seite bedienen | Offline-Hinweis erscheint, keine unbehandelte Ausnahme in der Konsole |
| 11 | Sitzung serverseitig beenden, dann eine Aktion auslösen | Umleitung auf `/anmelden`, Cache geleert, kein Neuladen der Seite |
| 12 | `git grep -n "fetch("` | Treffer nur in `src/api/http.ts` |
| 13 | `git status` vor dem Commit | weder `.env` noch `.env.local` erfasst; keine realen Personennamen |

Prüfpunkt 12 ist der eigentliche Abnahmetest des Pakets: **Wenn es mehr als eine Stelle gibt, an der
`fetch` aufgerufen wird, ist C1 nicht fertig.**

---

## 12. Nachdokumentation und Commit

1. `client/harness/CONTEXT_HANDOFF_CLIENT.md` fortschreiben – Abschnitt 5 (C1 auf „abgeschlossen"),
   Abschnitt 6 (Code-Zustand), Abschnitt 7 (nächste Schritte). Vorfassung zuvor unter
   `client/harness/archive/CONTEXT_HANDOFF_CLIENT_<Datum>.md` ablegen.
2. `client/harness/AGENT_CLIENT.md` um die Festlegungen aus C1 ergänzen: `aufrufen` als einziger
   Zugang zum Server, `code` statt `detail` für Programmlogik, kein Übersetzungstabellen-Duplikat,
   Entscheidung zum MSW-Browser-Modus.
3. `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md` (Gesamtstand) nachziehen – Abschnitt „Client". Der Ordner
   liegt ausserhalb des Repositories und wird nicht mitcommittet.
4. Commit auf `dev_client`. **Nicht nach `main`.**

```bash
git add -A
git status            # letzte Sichtpruefung: keine .env, keine realen Namen
git commit -m "C1: Vertragstypen, HTTP-Schicht, Fehleruebersetzung, MSW, Offline-Hinweis"
git push origin dev_client
```

---

## 13. Fallen, die bei der Vorab-Probe aufgefallen sind

Drei Punkte, die ohne Probe erst mitten in der Umsetzung aufgefallen wären:

**1. `openapi-typescript` lässt sich unter TypeScript 6 nicht installieren.** `npm install -D` bricht
mit `ERESOLVE` ab (Peer `typescript@^5.x`). Das Generat selbst übersetzt dagegen einwandfrei mit
`strict`. Deshalb der `npx`-Weg aus Schritt 2.2 – er umgeht den Konflikt, statt ihn mit
`--legacy-peer-deps` in die Sperrdatei zu schreiben.

**2. `ProblemDetail.type` ist im Generat Pflichtfeld.** Der Kontrakt gibt einen Vorgabewert
(`about:blank`) an, und daraus macht der Erzeuger ein `required`. Jedes handgeschriebene Fehlerobjekt
in einem Mock oder Test braucht das Feld, sonst `TS2741`.

**3. `mockServiceWorker.js` landet im Produktionsbau und im Precache.** Nachgemessen: sieben statt
sechs Einträge. Die Datei liegt in `public/`, und das Muster `**/*.{js,...}` greift sie auf.
`globIgnores` behebt es (wieder sechs); die Datei selbst bleibt dennoch in `dist/`. Das ist der
Hauptgrund für die Empfehlung in 8.4, den Browser-Modus zurückzustellen.

---

## 14. Ausblick C2

C2 („Design-System & Basis-Layout") setzt unmittelbar auf C1 auf: Die Lade-, Leer- und
Fehlerzustände, die dort als Komponenten entstehen, brauchen die `ApiFehler`-Struktur aus diesem
Paket als Eingang. Die Farbwerte in `_globalVars.scss` sind bis dahin Platzhalter; die
Kontrastprüfung nach WCAG 2.1 AA gehört dorthin, nicht hierher.
