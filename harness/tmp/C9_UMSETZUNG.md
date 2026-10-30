# C9 – PWA-Onboarding und Push (Umsetzungsanleitung)

> Arbeitspaket **C9** (geschätzt **14,0 h**; zwei Stufen, siehe 12). Es **setzt C0 bis C8 voraus** und setzt die offenen
> Client-Punkte von **A25** um: Push-Abonnement, Einstellungsansicht mit zwei getrennten Bedienelementen und dreiteiliger
> Zustandsanzeige, erneute Abo-Anmeldung bei jedem Start, Probeversand des Admins (E21 aus C8), die Ereignisse `push` und
> `notificationclick` im Service Worker sowie das Installations-Onboarding. Manifest, Worker-Grundgerüst, Update-Hinweis,
> Zurück-Navigation und Safe-Area stammen aus **C0** und bleiben, wie sie sind.
>
> **Nummerierung:** Die Entscheidungen setzen die Zählung aus C7/C8 fort (**E23–E33**). „C8 x.y“ bezeichnet einen Abschnitt
> der C8-Anleitung; was hier nicht steht, gilt aus C7 und C8 unverändert (insbesondere E3 Ordnung, E4 Lesen im Admin
> ohne Polling, E19 Dialoge nennen die Folgen).
>
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (**A25 a–f**, Abschnitte „Push-Benachrichtigungen“ und „Serverseitige
> Umsetzung“), `client/harness/AGENT_CLIENT.md` (PWA und Push), `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Ansichten
> **20 bis 22**, „Besonderheit: Vollbildmodus“), Vertrag `client/harness/assets/fubo-api.json` (**46 Operationen**, Stand
> 24.10.2026; sechs davon Push), dazu serverseitig `server/harness/tmp/S8_PUSH_UMSETZUNG.md` (Handprüfliste 13.1) und
> `server/src/main/java/de/fubo/appserver/domain/push/PushNutzlast.java` (Nutzlast, steht **nicht** im Vertrag).
>
> **Fassung vom 24.10.2026.** Die Entscheidungen E23–E33 (1.2) sind **Vorschläge** und vor Beginn der jeweiligen Stufe vom
> Entwickler zu bestätigen oder zu ändern.

---

## 0. Ziel und Abgrenzung

Nach C9 kann ein Spieler die Anwendung auf dem Startbildschirm ablegen, Benachrichtigungen **für sich** ein- und
ausschalten und **dieses Gerät** an- und abmelden. Er sieht jederzeit, auf welcher der drei Ebenen es hakt. Der Service
Worker zeigt die zwei Versandanlässe (Erinnerung, Terminabsage) und führt beim Antippen zum Termin. Der Admin prüft den
Versand mit einem Probeversand an die eigenen Geräte. Der letzte `Platzhalter` (`/einstellungen`) entfällt.

| Bereich | Ort (Vorschlag E23) | Inhalt | Endpunkte |
|---|---|---|---|
| Einstellungen | `/einstellungen` | Zustand (drei Ebenen), Personenschalter, Gerät ein-/austragen, App installieren | `GET /push/schluessel/lesen`, `GET /push/status/lesen`, `POST /push/einstellung/aendern`, `POST /push/abo/anlegen`, `POST /push/abo/entfernen` |
| Einstellungen, nur Admin | `/einstellungen` | Probeversand mit `anlageAktiv` daneben | `POST /admin/push/test` |
| Start der Anwendung | `AppLayout` (unsichtbar) | vorhandenes Abonnement erneut anmelden | `POST /push/abo/anlegen` |
| Startseite | `Dashboard`, `AdminDashboard` | Onboarding: erst Installation, dann Benachrichtigungen | wie Einstellungen |
| Service Worker | `src/sw.ts` | `push`, `notificationclick` | keine (der Worker ruft die API **nie** auf) |

Alle sechs Endpunkte verlangen `stage = PROFILE_AUTHENTICATED` und `USER` oder `ADMIN`; **`GAST` bekommt `403`** (A25d),
`/admin/push/test` verlangt `ADMIN`.

**Nicht Teil von C9:**

- **Auslösen eines Versands.** Erinnerung und Absage laufen serverseitig (Auftrag bzw. Statuswechsel); der Client legt nur
  sein Abonnement an und widerruft es (AGENT.md, Architekturregel „Push-Versand ist Serversache“).
- **Konfiguration** von `pushAktiv` und `pushErinnerungStunden` – steht seit C8 in `/admin/konfiguration`.
- **Deployment, `_headers`, WCAG-Abnahme** → **C10**. Die Auflagen für Cloudflare Pages (`no-cache` für `sw.js`, Manifest,
  `/`) sind seit C0 erfüllt und werden nicht angefasst.
- Keine neuen Abhängigkeiten (Web Push, Notifications API und `beforeinstallprompt` sind Browser-Bordmittel; Workbox ist da).

---

## 1. Vorab: Befunde und Entscheidungen

### 1.1 Befunde aus Vertrag, AGENT.md und Server

| Nr. | Befund | Folge für den Client |
|---|---|---|
| P1 | **Drei Bedingungen** gelten gleichzeitig: Anlage (`anlageAktiv`), Person (`pushErwuenscht`), Gerät (aktives Abonnement). Zwei liefert `GET /push/status/lesen`, die dritte **nur der Browser** (`pushManager.getSubscription()`). | Zustandsanzeige mit drei Zeilen; die Gerätezeile entsteht lokal (4.3). |
| P2 | `GET /push/schluessel/lesen` liefert `503 PUSH_NICHT_KONFIGURIERT`, wenn keine VAPID-Schlüssel hinterlegt sind: „gibt es hier nicht“, **kein Fehler, Wiederholen hilft nie**. Die übrigen vier Push-Endpunkte antworten trotzdem `200`. | Bedienelemente ausblenden; die Abfrage **ohne** Wiederholung (der `queryClient` wiederholt `5xx` sonst einmal, C8 2). |
| P3 | `POST /push/abo/anlegen` ist über einen Hash der Endpoint-Adresse **idempotent**, setzt `fehlversuche` zurück und heilt ein nach `410` deaktiviertes Abonnement. Er ist **bei jedem Anwendungsstart** aufzurufen. Dieselbe Adresse unter einem anderen Spieler **wechselt den Eigentümer**. | Start-Abgleich (6.4), auch nach einem Personenwechsel auf demselben Gerät. |
| P4 | `POST /push/abo/entfernen` antwortet **immer** `200` (`aboVorhanden: false`), auch für unbekannte oder fremde Adressen. | Keine Fallunterscheidung; die Antwort beschreibt den Zustand. |
| P5 | `POST /push/einstellung/aendern` wirkt auf **alle** Geräte der Person und **löscht kein Abonnement**; Pflichtfeld `pushErwuenscht`, Antwort ist der **gespeicherte** Stand. Beim Abschalten ist **einmal** darauf hinzuweisen, dass auch eine Absage nicht mehr ankommt. | Schalter sofort wirksam, Anzeige aus der Antwort (6.2). |
| P6 | `POST /admin/push/test` hat **keinen Körper**, prüft die Schalter **nicht** und antwortet `{ empfaenger, zugestellt }` (Geräte, keine Personen; `0` ist kein Fehler; `zugestellt` ist keine Zustellbestätigung). **`anlageAktiv` gehört daneben.** | 6.3. |
| P7 | `vapidPublicKey`: unkomprimierter P-256-Punkt, base64url **ohne Polsterung**, 87 Zeichen, beginnt mit `B`. **Nicht ins Frontend einbauen** – ein Schlüsselwechsel entwertet alle Abonnements. | Bei jedem Einrichten und im Start-Abgleich frisch lesen und mit dem Schlüssel des vorhandenen Abonnements vergleichen (4.2). |
| P8 | `AboAnlegenRequest`: `endpoint` (≤ 2048, `https://`, **unverändert** übernehmen), `p256dh` (80–120), `auth` (16–32), beide base64url. **Keine Spieler-Id, kein Gerätename.** | Werte aus `PushSubscription.toJSON()` ohne Bearbeitung senden. |
| P9 | **Nutzlast** (`PushNutzlast`, nicht im Vertrag): `typ` (`ERINNERUNG`, `TERMIN_ABGESAGT`, `PROBE`), `titel`/`text` als **immer gefüllter Rückfalltext**, `terminId`, `datum`, `uhrzeit`, `ort` (nullbar), `url` (Pfad, z. B. `/termine/42`; bei `PROBE` `/`). Bei `PROBE` sind Termin-Id, Datum und Uhrzeit leer. Serialisiert mit Jackson: `datum` als `YYYY-MM-DD`, `uhrzeit` als `HH:MM` oder `HH:MM:SS`; leere Felder können als `null` **oder** gar nicht ankommen. | Der Worker formuliert bei bekanntem `typ` selbst, sonst Rückfalltext (6.5); jede Feldform tolerieren. |
| P10 | Der Worker darf die Nutzlast **nie** über einen API-Aufruf ergänzen: Die Sitzung ist zur Versandzeit abgelaufen (`401`). | Kein `fetch` im Worker. |
| P11 | **iOS:** Web Push erst ab 16.4 und **nur nach „Zum Home-Bildschirm“**; kein `beforeinstallprompt`. Die Berechtigung ist aus einer **Nutzergeste** zu erfragen. | Anleitung statt totem Schalter (4.1, 7.1). |
| P12 | Das **Adminprofil** ist von der Empfängerauswahl der Erinnerung ausgenommen und sagt nicht zu (C7 E2); es bekommt also nur Probeversände. | E25: kein Personenschalter für den Admin. |
| P13 | Die Server-Nutzlast `PROBE` trägt den Titel „FuBo – Testbenachrichtigung“; „FuBo“ erscheint nicht in der Oberfläche (AGENT_CLIENT.md). | Der Worker setzt für `PROBE` einen eigenen Titel (6.5); Hinweis an den Server-Track (1.4). |

### 1.2 Entscheidungen (Vorschläge vom 24.10.2026)

| Nr. | Entscheidung | Begründung |
|---|---|---|
| E23 | **Einstellungen unter `/einstellungen`**, erreichbar über eine Symbolschaltfläche (`settings_icon_dark`, `aria-label="Einstellungen"`, 44 × 44 px) in der Kopfzeile links neben „Abmelden“ – **für USER und ADMIN**, nicht für GAST und nicht auf `/einstellungen` selbst. Ein Gast, der die Adresse direkt aufruft, sieht nur einen Satz („Für Gäste gibt es keine Einstellungen.“). | Ein Ort für alle Ansichten, auch für den Admin ohne Tab-Leiste. Gäste haben keinen Push (A25d), und eine Seite, die für sie leer bliebe, braucht keinen Weg. Gegenvorschlag: Eintrag auf der Startseite statt in der Kopfzeile. |
| E24 | **Zustandsanzeige dreiteilig** (drei Zeilen mit Symbol und Text: Anlage, „Für dich“, „Dieses Gerät“) und darunter **ein** Gesamtsatz. Die Gerätezeile kennt mehr als zwei Lagen: eingerichtet, nicht eingerichtet, im Browser blockiert, auf dem iPhone erst nach „Zum Home-Bildschirm“, im Browser nicht möglich, keine sichere Verbindung (4.3). | DESIGN.md Ansicht 20: Jede Lage verlangt eine andere Handlung, ein Ja/Nein schickt den Nutzer an die falsche Stelle (P1). |
| E25 | **Zwei getrennte Bedienelemente**: der Personenschalter (`Schalter`, sofort wirksam, Erklärung „gilt für alle deine Geräte“) und der Gerätebereich mit „Auf diesem Gerät einrichten“ bzw. „Auf diesem Gerät entfernen“ (Erklärung „nur dieses Gerät“). **Der Admin sieht keinen Personenschalter** (P12), sondern den Satz „Als Admin bekommst du keine Erinnerungen und Absagen; dieses Gerät dient dem Probeversand.“ | A25c/f; ein Schalter ohne Wirkung wäre eine falsche Auskunft. |
| E26 | **Einrichten nur aus einem Klick**, in dieser Reihenfolge: (1) Schlüssel ist **vorher** geladen (Abfrage beim Öffnen), (2) im Klick **zuerst** `Notification.requestPermission()`, (3) `navigator.serviceWorker.ready` mit Zeitlimit, (4) vorhandenes Abonnement mit anderem Schlüssel kündigen, (5) `subscribe({ userVisibleOnly: true, applicationServerKey })`, (6) `POST /push/abo/anlegen`. **Scheitert (6), wird das Browser-Abonnement wieder gekündigt** und der Fehler gezeigt. | Safari verliert die Nutzergeste nach einem `await` auf das Netz (P11). Ohne Rücknahme zeigte das Gerät „eingerichtet“, während der Server nichts weiss. |
| E27 | **Entfernen: erst der Browser (`unsubscribe()`), dann `POST /push/abo/entfernen`.** Ein Serverfehler wird gezeigt, ist aber unschädlich: Die verwaiste Zeile beantwortet der Push-Dienst mit `410`, und der Server deaktiviert sie. | Umgekehrt würde ein gescheitertes `unsubscribe()` das Abonnement im Browser stehen lassen, und der nächste Start-Abgleich meldete es dem Server wieder an. |
| E28 | **Personenschalter:** Beim Ausschalten erscheint **einmal** ein Hinweis (`role="status"`) unter dem Schalter: „Du bekommst dann auch keine Nachricht, wenn ein Termin abgesagt wird. Das siehst du erst in der App.“ Kein Dialog; der Hinweis verschwindet beim Verlassen der Seite und beim Wiedereinschalten. Angezeigt wird der Stand **aus der Antwort**. | P5; der Schalter ist jederzeit umkehrbar, ein Bestätigungsdialog (E19) gilt für Unumkehrbares. |
| E29 | **Start-Abgleich** (`PushAbgleich`, rendert nichts, im `AppLayout`): Bei `angemeldet`, Rolle USER oder ADMIN, unterstütztem Push, Berechtigung `granted` und **vorhandenem** Abonnement einmal je Identität (`rolle` + `anzeigeName`) und Seitenaufruf `POST /push/abo/anlegen` mit `keinRefresh: true`. Weicht der Schlüssel ab, wird ohne Rückfrage neu abonniert (die Berechtigung besteht schon). Fehler bleiben still. | P3, P7. Der Aufruf ist keine Bedienung und darf das Sitzungsfenster nicht verlängern (AGENT_CLIENT.md, Hintergrundaufrufe). |
| E30 | **Abmelden kündigt das Abonnement nicht.** Auf einem geteilten Gerät übernimmt die nächste Anmeldung das Abonnement (P3); der Gerätebereich nennt das: „Gibst du das Gerät weiter, entferne es vorher hier.“ | Die Erinnerung kommt rund 24 h vor dem Termin, wenn die Sitzung längst abgelaufen ist – ein Abo, das am Abmelden hinge, käme nie an. |
| E31 | **Service Worker:** formuliert `ERINNERUNG`, `TERMIN_ABGESAGT` und `PROBE` selbst, sonst den Rückfalltext, und zeigt **immer** eine Benachrichtigung. `tag` = `termin-{terminId}` (die Absage ersetzt die Erinnerung desselben Termins, `renotify: true` bei der Absage), `probe` für den Probeversand. Beim Antippen: offenes Fenster fokussieren und per Nachricht navigieren, sonst `openWindow`; nur Pfade des eigenen Ursprungs. **Kein** `pushsubscriptionchange`. | P9, P10, AGENT_CLIENT.md („`tag` je Termin“, „Titel ohne Anwendungsnamen“). `userVisibleOnly: true` verpflichtet zur Anzeige. Ein erneuertes Abonnement meldet der Start-Abgleich an; der Worker hätte dafür keine Sitzung. |
| E32 | **Installationsangebot:** `beforeinstallprompt` wird **vor** dem ersten Rendern abgefangen (`src/pwa/installation.ts`, Import in `main.tsx`) und zurückgehalten; „Installieren“ ruft `prompt()`. Auf iOS (nicht `standalone`) steht eine Anleitung („Teilen → Zum Home-Bildschirm“). In Browsern ohne beides gibt es **kein** Angebot im Onboarding, in den Einstellungen nur den Satz „Über das Menü des Browsers kannst du die App installieren.“ | DESIGN.md Ansicht 21; das Ereignis feuert oft, bevor React steht. Kein toter Knopf. |
| E33 | **Onboarding als Karte oben auf der Startseite** (`Dashboard` für USER, `AdminDashboard` für ADMIN, **nicht für GAST**), zwei Schritte nacheinander: **(1) Installation** (nur wenn nicht `standalone` und ein Weg nach E32 besteht), **(2) Benachrichtigungen** (nur USER, Server eingerichtet, `anlageAktiv` und `pushErwuenscht`, Gerät „nicht eingerichtet“ mit Berechtigung `default` oder `granted`). Je Schritt „Später“; erledigt oder weggeklickt wird je Gerät in `localStorage` vermerkt und **nicht** wieder angeboten (die Einstellungen bleiben der Weg). | DESIGN.md Ansicht 21 („nach der ersten erfolgreichen Anmeldung“, „vor der Frage nach den Benachrichtigungen, aber als eigener Schritt“, „wegklickbar“). Eine Karte blockiert nichts; die App bleibt ohne Installation voll nutzbar. Installation ist eine Eigenschaft des Geräts, nicht der Person. |

### 1.3 Abweichungen von DESIGN.md (verbindlich ist der Vertrag)

- **Ansicht 20:** Für den **Admin** entfällt der Personenschalter (E25, P12); dafür steht dort der Probeversand.
- **Ansicht 20:** „`503` ⇒ Bereich ausblenden“ (P2) wird als **Bereich ohne Bedienelemente mit einem Satz** umgesetzt
  („Benachrichtigungen sind auf diesem Server nicht eingerichtet.“). Ganz ohne Satz sucht der Spieler den Schalter.
- **Ansicht 21:** Gäste bekommen kein Onboarding (E33) – ihre Sitzung ist vorübergehend, Push gibt es für sie nicht.
- Dem Entwickler zur Übernahme in `DESIGN.md` vorlegen (die Datei gehört nicht zum Client-Repository).

### 1.4 Offen für Server und Handprüfung

- **HTTPS für die Handprüfung auf Telefonen:** Push und Service Worker verlangen einen sicheren Ursprung. `localhost` gilt als
  sicher (Desktop), eine LAN-Adresse (`http://192.168…`) **nicht**. Bis C10 (`app.<domain>`) braucht die Prüfung auf Android
  und iPhone einen HTTPS-Zugang zur Vorschau, etwa einen Cloudflare-Schnelltunnel auf `vite preview` (der Proxy `/api` gilt
  laut Vite auch für `preview`; vor der Prüfung nachsehen, dass Sitzungscookie und `credentials` durch den Tunnel tragen).
  Gelingt das nicht, wandert die Telefonprüfung (9, Nr. 4 und 5) nach C10.
- **Echte Push-Dienste** erreicht nur die Handprüfung; jede automatische Prüfung läuft gegen Attrappen (wie serverseitig).
- **Server-Track (Hinweis, kein Blocker):** Titel der `PROBE`-Nutzlast ohne „FuBo“ (P13). Der Worker überschreibt ihn ohnehin;
  ein Worker, der `PROBE` nicht kennt, gibt es nicht, weil der Wert mit C9 eingeführt wird.
- **Serverseitige Handprüfliste** `S8_PUSH_UMSETZUNG.md` 13.1 wird mit C9 erstmals mit echtem Client möglich; die Abnahme (9)
  führt sie mit.

---

## 2. Voraussetzungen aus C0 bis C8

Vor Beginn prüfen, dass alles vorhanden und **grün** ist (`lint`, `typecheck`, `test`, `build`, E2E):

- **PWA (C0):** `vite.config.ts` mit `injectManifest`, `registerType: 'prompt'`, `injectRegister: false`; `src/sw.ts`
  (Precache, Navigations-Rückfall mit Denylist `/api/`, `SKIP_WAITING`); `AktualisierungsHinweis` mit `useRegisterSW`;
  `tsconfig.worker.json` (nur `src/sw.ts`, `lib: WebWorker`; `tsconfig.app.json` schliesst `src/sw.ts` aus);
  `e2e/pwa.spec.ts` (nur Chromium, Muster `NUR_CHROMIUM`); `npm run dev:pwa` für den Worker in der Entwicklung.
- **Rahmen:** `AppLayout` (Kopfzeile mit „Zurück“ und „Abmelden“, `SitzungsWaechter`), Route `einstellungen` mit
  `<Platzhalter titel="Einstellungen" paket="C9" />` und `ZUM_DASHBOARD`, `useSitzung` (`angemeldet`, `istAdmin`, `istGast`,
  dazu `sitzung.rolle` und `sitzung.anzeigeName`), `useSitzungswechsel` (entfernt alle Abfragen ausser der Sitzung).
- **Datenzugriff:** `aufrufen` (einziges `fetch`, Option `keinRefresh`), `ApiFehler` mit `code`, `fehlertextBilden`,
  `TEXT_NICHT_ERREICHBAR`, `schluessel.pushStatus` (`['push', 'status']`, schon angelegt), `queryClient` (Wiederholung einmal
  bei `5xx`, Mutationen nie).
- **Bausteine:** `Schalter` (`beschriftung`, `an`, `beiUmschalten`, `beschaeftigt`, `erklaerung`, `ref`), `CustomButton`
  (`art` inkl. `akzent`, `symbol`, `laedt`), `Hinweis`, `Fehlermeldung`, `Leerzustand`, `Verwaltungsliste`.
- **Typen:** `src/api/common/types/schema.d.ts` enthält die sechs Push-Operationen und `PUSH_NICHT_KONFIGURIERT`
  (`npm run api:typen` nur bei Vertragsänderung).

---

## 3. Datenzugriff und Mocks

### 3.1 API-Funktionen (`src/api/push/push.ts`)

Typen ausschliesslich aus `schema.d.ts`. Keine Funktion setzt Standardwerte oder bearbeitet die Werte des Browsers.

```ts
import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

type S = components['schemas']
export type PushStatus = S['PushStatus']
export type AboAnlegen = S['AboAnlegenRequest']
export type Probeversand = S['Probeversand']

export const pushSchluesselLesen = () => aufrufen<S['VapidSchluesselInfo']>('GET', '/push/schluessel/lesen')
export const pushStatusLesen = () => aufrufen<PushStatus>('GET', '/push/status/lesen')
export const pushEinstellungAendern = (pushErwuenscht: boolean) =>
  aufrufen<S['PushEinstellung']>('POST', '/push/einstellung/aendern', { body: { pushErwuenscht } })
/** `keinRefresh` nur für den Start-Abgleich (E29). */
export const pushAboAnlegen = (abo: AboAnlegen, keinRefresh = false) =>
  aufrufen<S['AboZustand']>('POST', '/push/abo/anlegen', { body: abo, keinRefresh })
export const pushAboEntfernen = (endpoint: string) =>
  aufrufen<S['AboZustand']>('POST', '/push/abo/entfernen', { body: { endpoint } })
/** Ohne Körper (P6): `body` fehlt, damit auch kein `Content-Type` hinausgeht. */
export const pushProbeversand = () => aufrufen<Probeversand>('POST', '/admin/push/test')
```

### 3.2 Schlüssel (`schluessel.ts`)

| Schlüssel | Inhalt | Optionen |
|---|---|---|
| `pushStatus` (vorhanden) | `GET /push/status/lesen` | `staleTime: 0`, `refetchOnWindowFocus: false` (Lesen ohne Kopf, AGENT_CLIENT.md) |
| `pushSchluessel: ['push', 'schluessel']` | VAPID-Schlüssel | `staleTime: Infinity`, **`retry: false`** (P2) |
| `pushGeraet: ['push', 'geraet']` | **lokaler** Gerätezustand aus dem Adapter (4.2), kein Netz | `networkMode: 'always'`, `staleTime: 0`, **`refetchOnWindowFocus: true`** |

Der Gerätezustand als Abfrage hat zwei Vorteile: Nach Einrichten und Entfernen genügt `invalidateQueries(pushGeraet)`, und
wer in den Browsereinstellungen die Berechtigung ändert und zurückkehrt, sieht beim Fokus sofort den neuen Stand – ohne
Serveraufruf und ohne Sitzungsverlängerung. Alle drei liegen unter der Wurzel `push`; `useSitzungswechsel` entfernt sie
beim Personenwechsel mit.

### 3.3 Fehlercodes der Aufrufe (Reaktion der Oberfläche)

| Aufruf | Antwort | Reaktion |
|---|---|---|
| Schlüssel lesen | `503 PUSH_NICHT_KONFIGURIERT` | Gerätebereich und Personenschalter ausblenden, Satz aus 1.3; **kein** Fehlerbild, kein zweiter Versuch |
| alle | `403` (ohne `code` oder `KEINE_BERECHTIGUNG`) | darf nicht vorkommen (GAST erreicht die Aufrufe nicht); `Fehlermeldung` mit `detail` |
| alle | `401` | globale Sitzungsbehandlung (`pruefeSitzung`), nichts Eigenes |
| alle | Netzfehler | `TEXT_NICHT_ERREICHBAR` („Server nicht erreichbar“); Gerät bleibt unverändert, bei Einrichten mit Rücknahme (E26) |
| `abo/anlegen` | `400 EINGABE_UNGUELTIG` | Rücknahme (E26), `detail` zeigen; deutet auf einen Fehler im Adapter (Gegenprobe G7) |
| `einstellung/aendern`, `status/lesen` | `404 INHALT_NICHT_GEFUNDEN` | `detail` zeigen (bei gültiger Sitzung laut Vertrag unerreichbar) |
| Probeversand | `503 PUSH_NICHT_KONFIGURIERT` | Satz „Push ist auf diesem Server nicht eingerichtet (VAPID-Schlüssel fehlen).“, Knopf deaktiviert |
| Probeversand | `200`, `empfaenger: 0` | „Auf deinem Konto ist kein Gerät eingerichtet.“ – **kein Fehler** |

Anzeigetext ist wie überall das `detail` des Servers; verzweigt wird nur über `code`.

### 3.4 Mocks

- **MSW** `src/test/mocks/push.ts`: zustandsbehaftete `PushWelt` (`eingerichtet: boolean` für VAPID, `anlageAktiv`,
  `pushErwuenscht`, Menge der Endpunkte, Zähler je Aufruf, zuletzt gesendete Körper), `pushHandler(welt)`. GAST ⇒ `403`,
  Probeversand zählt die Endpunkte der Welt. In `handlers.ts` **vor** allgemeinere Handler (MSW nimmt den ersten Treffer).
- **Geräte-Attrappe** `src/test/pushGeraetAttrappe.ts`: ersetzt den Adapter aus 4.2 (`vi.mock('@/pwa/pushGeraet')`) mit
  steuerbarer Fähigkeit, Berechtigung, vorhandenem Abonnement (inkl. Schlüssel) und Fehlern. jsdom kennt weder
  `Notification` noch `PushManager` noch `navigator.serviceWorker` – die Tests sprechen deshalb **nie** die Browser-API an,
  sondern nur den Adapter.
- **Playwright** `e2e/hilfen/push.ts`: `pushNachbilden(page, welt)` (Routen der sechs Endpunkte) und
  `pushGeraetNachbilden(page, { berechtigung, abonnement })` per `addInitScript`: ersetzt `Notification.requestPermission`,
  `Notification.permission`, `PushManager.prototype.subscribe/getSubscription` und `PushSubscription.prototype.unsubscribe`.
  Ein echtes `subscribe()` scheitert in Headless-Chromium mangels Push-Dienst.
- **Onboarding in allen bestehenden E2E-Specs abschalten:** Die Karte (E33) erschiene sonst auf jeder Startseite und
  verschöbe Layout- und Fokusprüfungen. Die gemeinsamen Helfer (`sitzungNachbilden` in `e2e/hilfen/sitzung.ts`, `adminStart` in `admin.ts`) setzen den Vermerk
  per `addInitScript` (`localStorage`); nur `onboarding.pwa.spec.ts` lässt ihn weg.

---

## 4. Gerätebene (`src/pwa/`)

Alles, was den Browser betrifft, liegt in `src/pwa/` und ist **ohne React** testbar. Seiten und Hooks kennen nur diese
Module.

### 4.1 Umgebung (`umgebung.ts`, reine Funktionen mit übergebenen Werten)

```ts
export type Umgebung = { ios: boolean; standalone: boolean; sicher: boolean; pushMoeglich: boolean }

/** iPadOS meldet sich als „Macintosh“; erkennbar am Touch. */
export function istIos(ua: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1)
}

export function umgebungLesen(w: Window = window): Umgebung {
  const standalone =
    w.matchMedia('(display-mode: standalone)').matches ||
    (w.navigator as Navigator & { standalone?: boolean }).standalone === true
  return {
    ios: istIos(w.navigator.userAgent, w.navigator.maxTouchPoints),
    standalone,
    sicher: w.isSecureContext,
    // Auf iOS gibt es `PushManager` erst in der abgelegten App (P11).
    pushMoeglich: 'serviceWorker' in w.navigator && 'PushManager' in w && 'Notification' in w,
  }
}
```

### 4.2 Adapter (`pushGeraet.ts`)

Die einzige Datei, die `Notification`, `pushManager` und `serviceWorker.ready` anfasst (Abnahme 1 prüft das per `grep`).

```ts
export type Berechtigung = 'default' | 'granted' | 'denied'
export type GeraetStand = {
  berechtigung: Berechtigung
  abo: { endpoint: string; schluessel: Uint8Array | null } | null
}

/** base64url (mit oder ohne Polsterung) → Bytes, für `applicationServerKey`. */
export function base64urlZuBytes(wert: string): Uint8Array<ArrayBuffer> {
  const b64 = wert.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(wert.length / 4) * 4, '=')
  return Uint8Array.from(atob(b64), (z) => z.charCodeAt(0))
}

export function gleicheBytes(a: Uint8Array | null, b: Uint8Array): boolean {
  return a !== null && a.length === b.length && a.every((x, i) => x === b[i])
}

/** `ready` löst ohne registrierten Worker nie auf (`npm run dev` ohne `dev:pwa`). */
async function registrierung(ms = 10_000): Promise<ServiceWorkerRegistration> { /* Promise.race mit Zeitlimit */ }

export async function standLesen(): Promise<GeraetStand> { /* permission + getSubscription() */ }

/** Muss **synchron** aus dem Klick heraus beginnen (E26): kein `await` davor. */
export function berechtigungErfragen(): Promise<Berechtigung> {
  return Notification.requestPermission()
}

export async function abonnieren(vapid: string): Promise<AboAnlegen> {
  const reg = await registrierung()
  const schluessel = base64urlZuBytes(vapid)
  const alt = await reg.pushManager.getSubscription()
  // Anderer Schlüssel ⇒ `subscribe` wirft `InvalidStateError`; erst kündigen (P7).
  if (alt && !gleicheBytes(new Uint8Array(alt.options.applicationServerKey ?? new ArrayBuffer(0)), schluessel)) {
    await alt.unsubscribe()
  }
  const abo = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluessel })
  const json = abo.toJSON()
  // Unverändert übernehmen (P8): kein Trimmen, kein Kleinschreiben.
  return { endpoint: abo.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' }
}

export async function kuendigen(): Promise<string | null> { /* getSubscription → unsubscribe, liefert endpoint */ }
```

### 4.3 Lage (`pushLage.ts`, reine Funktion)

Aus Umgebung, Gerätestand, Schlüsselabfrage und Status entsteht die Anzeige (E24). Die Reihenfolge der Prüfungen ist
fachlich: Was der Nutzer **nicht** ändern kann, kommt zuerst.

| Gerätelage | Bedingung | Text (Vorschlag) | Handlung |
|---|---|---|---|
| `server` | Schlüssel `503` | „Benachrichtigungen sind auf diesem Server nicht eingerichtet.“ | keine (ganzer Bereich ohne Bedienelemente) |
| `unsicher` | `!sicher` | „Nur über eine sichere Verbindung (https) möglich.“ | keine |
| `iosAblegen` | `ios && !standalone` | „Auf dem iPhone erst, wenn die App auf dem Home-Bildschirm liegt.“ | Anleitung (7.1) |
| `nichtMoeglich` | `!pushMoeglich` | „Dieser Browser unterstützt keine Benachrichtigungen.“ | keine |
| `blockiert` | `berechtigung === 'denied'` | „Im Browser blockiert. Erlaube Benachrichtigungen in den Einstellungen des Browsers für diese Seite.“ | keine (ein neuer Dialog ist nicht möglich) |
| `eingerichtet` | Abonnement vorhanden | „Auf diesem Gerät eingerichtet.“ | „Auf diesem Gerät entfernen“ |
| `nichtEingerichtet` | sonst | „Auf diesem Gerät nicht eingerichtet.“ | „Auf diesem Gerät einrichten“ |

Anlage: „Vom Admin eingeschaltet“ / „**Vom Admin abgeschaltet** – zurzeit gehen an niemanden Benachrichtigungen.“
Person: „Für dich eingeschaltet (alle deine Geräte)“ / „**Von dir abgeschaltet**“. Gesamtsatz nur, wenn alle drei passen:
„Du bekommst Erinnerungen und Absagen auf diesem Gerät.“; sonst nennt er die **erste** hindernde Ebene.

---

## 5. Hooks (`src/hooks/push/`)

| Hook | Art | Verhalten |
|---|---|---|
| `usePushSchluessel(aktiv)` | Abfrage | nur für USER/ADMIN (`enabled`), `retry: false`; liefert `verfuegbar: boolean` (false bei `503`) und den Schlüssel |
| `usePushStatus(aktiv)` | Abfrage | `pushStatusLesen`, einmal beim Öffnen |
| `usePushGeraet()` | Abfrage | `standLesen()` über den Adapter, mit `umgebungLesen()` |
| `usePushEinrichten()` | Mutation | E26: `berechtigungErfragen()` **im Klick** (die Seite ruft `mutate` direkt aus `onClick`), dann `abonnieren`, `pushAboAnlegen`; bei Fehler `kuendigen()`; danach `pushGeraet` neu lesen |
| `usePushEntfernen()` | Mutation | E27: `kuendigen()`, dann `pushAboEntfernen(endpoint)`; danach `pushGeraet` neu lesen |
| `usePushEinstellungAendern()` | Mutation | `setQueryData(pushStatus, …)` mit dem **gespeicherten** Stand aus der Antwort (P5) |
| `usePushProbeversand()` | Mutation | Ergebnis im Zustand der Seite, kein Cache; `retry: 0` (Standard) |
| `usePushAbgleich()` | Wirkung | E29; Schutz gegen den Doppelaufruf von `StrictMode` über eine Modulvariable `zuletztAbgeglichen` (Schlüssel `rolle:anzeigeName`) statt `useRef` |

**Achtung `mutate` und Nutzergeste:** `requestPermission` muss im selben Aufrufstapel wie der Klick beginnen. In
`mutationFn` ist es der erste Befehl, und `mutate` wird synchron im `onClick` gerufen – kein `await`, kein `setTimeout`,
keine Bestätigung dazwischen. Ein Test prüft, dass `berechtigungErfragen` **vor** jedem Netzaufruf läuft (G2).

---

## 6. Stufe 1 – Push (9,5 h)

### 6.1 Datenzugriff, Adapter, Mocks (ca. 2,5 h)

3.1 bis 3.4, 4.1 bis 4.3. Unit-Tests der reinen Funktionen zuerst (`base64urlZuBytes` gegen einen bekannten 65-Byte-Punkt,
`gleicheBytes`, `istIos` mit iPhone-, iPad- und Android-Kennungen, jede Zeile der Tabelle in 4.3).

### 6.2 Einstellungen `/einstellungen` (`Einstellungen`, ca. 2,0 h)

Neue Seite `src/pages/Einstellungen/` (nicht im Admin-Paket: Sie gehört allen Angemeldeten). Ersetzt den `Platzhalter`;
`handle: ZUM_DASHBOARD` bleibt (für den Admin leitet `/` auf `/admin` weiter). Ist `Platzhalter` danach nirgends mehr
eingebunden, wird er samt Test entfernt (vorher `grep`).

```
Einstellungen
├── Benachrichtigungen            (USER, ADMIN)
│   ├── Zustand: Anlage · Für dich · Dieses Gerät, Gesamtsatz   (4.3)
│   ├── Personenschalter          (nur USER, E25/E28)
│   └── Dieses Gerät              (Knopf nach Lage, Hinweis zum geteilten Gerät E30)
├── Probeversand                  (nur ADMIN, 6.3)
└── App installieren              (Stufe 2, 7.3; nur wenn nicht standalone)
```

- **Lesen:** Schlüssel, Status und Gerät parallel; Ladezustand je Abschnitt, damit ein langsamer Status das Gerät nicht
  verdeckt. Kein Polling.
- **Kopfzeile:** Symbolschaltfläche „Einstellungen“ (E23) im `AppLayout`; 360 px ohne waagerechte Bildlaufleiste, Tap-Ziel
  44 px (die Layout-Schleife aus C7/C8 prüft das mit).
- **Fokus:** nach Einrichten/Entfernen auf die Gerätezeile (sonst landet er auf `body`, C8 14).
- **Texte** wie 4.3 und E25/E28; Knöpfe „Auf diesem Gerät einrichten“ (`art="akzent"`), „Auf diesem Gerät entfernen“
  (`art="sekundaer"`, keine Gefahrfarbe: umkehrbar).

### 6.3 Probeversand (nur ADMIN, ca. 0,75 h)

Abschnitt „Probeversand“ mit Knopf „Testbenachrichtigung senden“. Daneben **immer** die Zeile „Versand an Spieler: vom
Admin eingeschaltet/abgeschaltet“ aus `anlageAktiv` mit Verweis auf `/admin/konfiguration` (P6). Nach dem Versand:
„An {empfaenger} Gerät(e) gesendet, {zugestellt} vom Push-Dienst angenommen.“ und dauerhaft: „Das zeigt, dass der Versand
technisch funktioniert – nicht, dass Spieler etwas bekommen.“ `empfaenger: 0` ⇒ Satz aus 3.3.

### 6.4 Start-Abgleich (`PushAbgleich`, ca. 0,75 h)

E29. Im `AppLayout` neben `SitzungsWaechter`, gesteuert über `useSitzung`; für GAST und ohne Anmeldung **kein** Aufruf.
Ablauf: Gerätestand lesen ⇒ nur bei `granted` **und** vorhandenem Abonnement weiter ⇒ Schlüssel lesen (`503` ⇒ Ende) ⇒
bei abweichendem Schlüssel `abonnieren` ⇒ `pushAboAnlegen(abo, true)`. Kein Polling, keine Anzeige.

### 6.5 Service Worker (ca. 1,25 h)

Die Logik liegt in `src/pwa/benachrichtigung.ts` – **ohne Imports aus der Anwendung und ohne DOM-Typen**, damit sie in
`tsconfig.worker.json` (über den Import aus `sw.ts`) und in Vitest gleichermassen übersetzt. `sw.ts` verdrahtet nur.

```ts
// src/pwa/benachrichtigung.ts
export type Nutzlast = {
  typ?: string; titel?: string; text?: string; terminId?: number | null
  datum?: string | null; uhrzeit?: string | null; ort?: string | null; url?: string | null
}
export type Anzeige = { titel: string; text: string; tag?: string; renotify: boolean; url: string }

const ERSATZ = { titel: 'Neue Nachricht', text: 'Öffne die App für Einzelheiten.' }

/** Nur Pfade des eigenen Ursprungs; `//fremd.example` wäre eine fremde Adresse. */
export function zielPfad(url: unknown): string {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/'
}

function wochentag(datum: string): string {
  const [j, m, t] = datum.split('-').map(Number)
  // Aus Teilen gebaut, nicht `new Date('YYYY-MM-DD')` (UTC-Falle, C5).
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(new Date(j, m - 1, t, 12))
}

export function benachrichtigungBauen(n: Nutzlast | null): Anzeige {
  const tag = n?.terminId != null ? `termin-${n.terminId}` : n?.typ === 'PROBE' ? 'probe' : undefined
  const url = zielPfad(n?.url)
  const zeit = n?.uhrzeit ? n.uhrzeit.slice(0, 5) : null
  if (n?.typ === 'ERINNERUNG' && n.datum && zeit)
    return { titel: `Kicken am ${wochentag(n.datum)}, ${zeit} Uhr`,
             text: n.ort ? `Bitte gib Bescheid, ob du dabei bist. Ort: ${n.ort}` : 'Bitte gib Bescheid, ob du dabei bist.',
             tag, renotify: false, url }
  if (n?.typ === 'TERMIN_ABGESAGT' && n.datum)
    return { titel: `Kicken am ${wochentag(n.datum)} fällt aus`, text: 'Der Termin wurde abgesagt.', tag, renotify: true, url }
  if (n?.typ === 'PROBE')
    return { titel: 'Testbenachrichtigung', text: n.text || 'Der Versand funktioniert auf diesem Gerät.', tag, renotify: false, url }
  // Unbekannter `typ` (älterer Worker) oder fehlende Felder: Rückfalltext des Servers (P9).
  return { titel: n?.titel || ERSATZ.titel, text: n?.text || ERSATZ.text, tag, renotify: false, url }
}
```

```ts
// src/sw.ts (Ergänzung)
const NACHRICHT_NAVIGIEREN = 'NAVIGIEREN'

self.addEventListener('push', (event: PushEvent) => {
  let nutzlast: Nutzlast | null = null
  try { nutzlast = (event.data?.json() as Nutzlast | undefined) ?? null } catch { /* Rückfall */ }
  const a = benachrichtigungBauen(nutzlast)
  // Immer anzeigen: `userVisibleOnly: true` ist eine Zusage (E31).
  event.waitUntil(self.registration.showNotification(a.titel, {
    body: a.text, tag: a.tag, renotify: a.renotify, lang: 'de',
    icon: '/icons/pwa/app-icon-192.png', data: { url: a.url },
  }))
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const ziel = zielPfad((event.notification.data as { url?: unknown } | null)?.url)
  event.waitUntil((async () => {
    const fenster = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const offen = fenster.find((f) => new URL(f.url).origin === self.location.origin)
    if (offen) {
      await offen.focus()
      offen.postMessage({ type: NACHRICHT_NAVIGIEREN, url: ziel })
      return
    }
    await self.clients.openWindow(ziel)
  })())
})
```

- **Empfang in der Seite:** `useWorkerNavigation()` im `AppLayout` hört auf `navigator.serviceWorker` (`message`), prüft
  `type` und `zielPfad`, ruft `navigate(url)` und **muss `navigator.serviceWorker.startMessages()` aufrufen** (mit
  `addEventListener` statt `onmessage` bleiben Nachrichten sonst in der Warteschlange). Die Navigation in der SPA spart das
  Neuladen; ist die Sitzung abgelaufen, führt `GeschuetzteRoute` über die Anmeldung zum Ziel zurück (C3).
- **`renotify`** fehlt in `NotificationOptions` der TypeScript-Bibliothek (mit der Projektfassung geprüft: `TS2353`); den
  Typ lokal erweitern (`NotificationOptions & { renotify?: boolean }`), nicht `as any`. Die übrigen Beispiele dieser
  Anleitung übersetzen mit `strict`.
- Das Symbol liegt nicht im Precache (`includeManifestIcons: false`); ohne Netz erscheint die Benachrichtigung ohne Symbol.
  Das ist hinnehmbar und kein Grund, den Precache zu vergrössern.
- `NACHRICHT_NAVIGIEREN` und `zielPfad` stehen einmal (in `benachrichtigung.ts`) und werden von Worker und Seite importiert.

### 6.6 Tests und Abnahme der Stufe 1 (ca. 2,25 h)

Unit, E2E und Gegenproben nach 8; Abnahme 9 Nr. 1–3 und 6–12.

---

## 7. Stufe 2 – Installation und Onboarding (4,5 h)

### 7.1 Installationsangebot (`src/pwa/installation.ts`, ca. 1,25 h)

```ts
type InstallEreignis = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let zurueckgehalten: InstallEreignis | null = null
const beobachter = new Set<() => void>()
const melden = () => beobachter.forEach((f) => f())

/** In `main.tsx` **vor** `createRoot` aufrufen: Das Ereignis kommt oft vor dem ersten Rendern. */
export function installationBeobachten(w: Window = window): void {
  w.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keine Mini-Infoleiste; das Angebot macht die Karte
    zurueckgehalten = e as InstallEreignis
    melden()
  })
  w.addEventListener('appinstalled', () => {
    zurueckgehalten = null
    hinweisErledigt('installation')
    melden()
  })
}

/** `prompt()` geht je Ereignis genau einmal. */
export async function installieren(): Promise<'angenommen' | 'abgelehnt' | 'nichtMoeglich'> {
  const e = zurueckgehalten
  if (!e) return 'nichtMoeglich'
  zurueckgehalten = null
  melden()
  await e.prompt()
  return (await e.userChoice).outcome === 'accepted' ? 'angenommen' : 'abgelehnt'
}

export const installationAbonnieren = (f: () => void) => (beobachter.add(f), () => beobachter.delete(f))
export const installationMoeglich = () => zurueckgehalten !== null
```

`useInstallation()` liest das über `useSyncExternalStore` und ergänzt `umgebungLesen()`: `weg` = `'knopf'` (Ereignis da),
`'ios'` (iOS, nicht `standalone`), `'menue'` (sonst, nicht `standalone`) oder `null` (`standalone`).

**iOS-Anleitung** (Text, ohne fremde Markensymbole): „Tippe in Safari auf ‚Teilen‘ und dann auf ‚Zum Home-Bildschirm‘.
Danach startest du die App vom Home-Bildschirm – erst dort gibt es Benachrichtigungen.“

### 7.2 Onboarding-Karte (`Onboarding`, ca. 1,25 h)

- **Speicher** `src/pwa/hinweisSpeicher.ts`: ein Schlüssel `fubo.hinweise` mit `{ installation?: true, benachrichtigungen?: true }`.
  **Jeder Zugriff in `try/catch`** (Safari im privaten Modus wirft); scheitert er, gilt der Hinweis für diesen Seitenaufruf
  als erledigt, sobald er weggeklickt ist (Zustand im Speicher des Moduls). Kein Token, keine Personendaten
  (AGENT_CLIENT.md: „Kein Token im `localStorage`“ bleibt unberührt).
- **Schritt 1 – Installation:** `weg === 'knopf'` ⇒ „Installieren“ (`akzent`) und „Später“; `weg === 'ios'` ⇒ Anleitung und
  „Verstanden“. Ergebnis `angenommen` oder Klick ⇒ `installation` erledigt.
- **Schritt 2 – Benachrichtigungen** (nur USER): Bedingungen aus E33. Die **lokalen** Bedingungen (Rolle, Umgebung,
  Berechtigung, Vermerk) werden zuerst geprüft; erst dann sind Schlüssel- und Statusabfrage `enabled` – so kostet die Karte
  nach dem Wegklicken keinen Aufruf mehr. „Benachrichtigungen einrichten“ ruft `usePushEinrichten` **direkt im Klick**;
  „Nicht jetzt“ vermerkt. Text: „Wir erinnern dich, wenn du dich zu einem Termin noch nicht gemeldet hast, und sagen
  Bescheid, wenn ein Termin ausfällt. Abschalten kannst du das jederzeit in den Einstellungen.“
- **Ort:** oberhalb des Termininhalts im `Dashboard` bzw. der Verwaltungsliste im `AdminDashboard`; `role="region"` mit
  Überschrift. Kein Dialog, kein Fokusraub beim Erscheinen.

### 7.3 Einstellungen: Abschnitt „App installieren“ (ca. 0,25 h)

Nur wenn nicht `standalone`: je nach `weg` Knopf, iOS-Anleitung oder Menü-Satz (E32). Unabhängig vom Vermerk – hier ist das
Angebot immer erreichbar.

### 7.4 Tests, Abnahme, Doku (ca. 1,75 h)

Unit und E2E nach 8 (Onboarding-Teile); Abnahme 9 Nr. 4, 5, 13; Nachdokumentation 10.

---

## 8. Tests

### 8.1 Unit (Vitest, MSW, echter `queryClient`, Geräte-Attrappe)

- **API:** Pfad, Methode, Körper je Funktion; `pushProbeversand` sendet **keinen** Körper und keinen `Content-Type`;
  `pushAboAnlegen(abo, true)` setzt `X-FuBo-Kein-Refresh`, ohne zweites Argument nicht; `endpoint` wird unverändert gesendet
  (Prüfwert mit Grossbuchstaben und abschliessendem Zeichen ohne Schrägstrich).
- **Reine Funktionen:** `base64urlZuBytes` (mit und ohne Polsterung, `-`/`_`), `gleicheBytes`, `istIos`, `umgebungLesen` mit
  nachgebildetem `window`, `pushLage` (jede Zeile aus 4.3, Reihenfolge der Prüfungen), `zielPfad` (`/termine/7`, `//x`,
  `https://x`, `undefined`), `benachrichtigungBauen` (drei `typ`, unbekannter `typ`, fehlende Felder, `null`, `uhrzeit` mit
  und ohne Sekunden, `ort` `null` und fehlend, `tag` und `renotify`).
- **Hooks:** Schlüssel bei `503` genau **ein** Abruf und `verfuegbar: false`; Einrichten ruft `berechtigungErfragen` vor jedem
  Netzaufruf, bei `denied` kein `subscribe`, bei Fehler von `anlegen` `kuendigen()`; Entfernen kündigt erst lokal;
  Einstellung schreibt den **Antwort**stand in `pushStatus`; Abgleich: kein Aufruf ohne Abo, ohne `granted`, für GAST, bei
  `503`; ein Aufruf mit Kopf bei vorhandenem Abo; neu abonniert bei anderem Schlüssel; **ein** Aufruf trotz doppelter Wirkung.
- **Seiten und Bausteine:** `Einstellungen` je Rolle (USER mit Schalter, ADMIN ohne Schalter mit Probeversand, GAST nur Satz),
  je Gerätelage der richtige Text und Knopf, Hinweis beim Abschalten erscheint einmal und verschwindet beim Einschalten,
  Probeversand mit `empfaenger` 0 und > 0 sowie `503`, `anlageAktiv` steht daneben; Kopfzeilen-Symbol nur für USER/ADMIN;
  `Onboarding` je Schritt, Reihenfolge, Vermerk, kein Erscheinen nach dem Wegklicken, keine Status-/Schlüsselabfrage bei
  gesetztem Vermerk, `localStorage` wirft ⇒ Karte trotzdem bedienbar.
- **Installation:** `installationBeobachten` mit synthetischem Ereignis (`preventDefault` gerufen, `prompt` nur einmal,
  `appinstalled` vermerkt).
- **Routen:** `/einstellungen` zeigt die Seite statt des Platzhalters, ohne Sitzung ⇒ Anmeldung.

### 8.2 E2E (Playwright, drei Chromium-Projekte)

| Spezifikation | Inhalt |
|---|---|
| `push.pwa.spec.ts` | Einstellungen als USER: Lagen „nicht eingerichtet“ → Einrichten (gesendeter Körper abfangen) → „eingerichtet“ → Entfernen (Reihenfolge: lokal, dann Server); Berechtigung `denied` ⇒ Text ohne Knopf; Personenschalter mit Hinweis; Server `503` ⇒ Bereich ohne Bedienelemente; Start-Abgleich: Neuladen mit vorhandenem Abo ⇒ genau ein `anlegen` mit `X-FuBo-Kein-Refresh`; als ADMIN Probeversand; als GAST kein Symbol, kein Push-Aufruf |
| `onboarding.pwa.spec.ts` | Nach der Anmeldung Karte mit Schritt 2 (Schritt 1 entfällt ohne Ereignis); synthetisches `beforeinstallprompt` ⇒ Schritt 1 zuerst; „Später“ ⇒ nach Neuladen keine Karte; GAST ⇒ keine Karte |
| `pwa.spec.ts` (Ergänzung) | **Machbarkeit zuerst prüfen (Zeitkasten 30 min):** Push über CDP (`ServiceWorker.deliverPushMessage`) mit `grantPermissions(['notifications'])`, danach `registration.getNotifications()` auf Titel und `tag`. Gelingt es nicht, tragen der Unit-Test von `benachrichtigungBauen` und die Handprüfung den Inhalt |

Beide neuen Specs enden auf `.pwa.spec.ts` und laufen damit nur in Chromium (`NUR_CHROMIUM`). Die Layout-Schleife umfasst
`/einstellungen` (USER und ADMIN, 360 px, Höhen 780 und 640, Tap-Ziele 44 px).

### 8.3 Gegenproben (Test rot ohne Absicherung)

Wie in C5, C7 und C8: Skript mit Ergebnisprüfung auf „failed“; gleichwertige Mutanten benennen, nicht zählen.

| Nr. | Mutation | Erwartung |
|---|---|---|
| G1 | `PushAbgleich` entfernt bzw. ohne `keinRefresh` | Hook- und E2E-Test rot |
| G2 | `berechtigungErfragen` erst nach `pushSchluesselLesen` oder beim Laden | Reihenfolgetest rot |
| G3 | Worker zeigt bei unbekanntem `typ` nichts | `benachrichtigungBauen`-Test rot |
| G4 | `tag` fehlt oder ist für Erinnerung und Absage verschieden | Test rot |
| G5 | Entfernen ruft nur den Server, nicht `unsubscribe()` | Hook- und E2E-Test rot |
| G6 | GAST sieht Symbol, Bereich oder Karte | Seiten-/E2E-Test rot |
| G7 | `endpoint` getrimmt oder kleingeschrieben | API-Test rot |
| G8 | Schlüsselabfrage mit Wiederholung bei `503` | Zähltest rot |
| G9 | Karte erscheint nach „Später“ wieder | Onboarding-Test rot |
| G10 | `zielPfad` lässt `//fremd` oder `https://…` durch | Test rot |
| G11 | Abgleich erkennt den Schlüsselwechsel nicht | Hook-Test rot |
| G12 | Probeversand ohne `anlageAktiv` daneben | Seitentest rot |

---

## 9. Abnahme von C9

1. `npm run lint`, `typecheck`, `test`, `build`; **ein** `fetch(` (`httpService.ts`), keines in `sw.ts` und `src/pwa/`;
   `Notification.`, `pushManager` und `serviceWorker.ready` nur in `src/pwa/pushGeraet.ts`; kein VAPID-Schlüssel im Code;
   kein Hexwert ausserhalb der Tokendatei; kein `Platzhalter` mehr für `einstellungen`; kein „FuBo“ in sichtbaren Texten.
2. E2E in den drei Chromium-Projekten (Cloud-Kopie wie bisher), Layout-Schleife mit `/einstellungen`.
3. **Desktop-Chrome gegen echten Server mit VAPID** (`localhost` ist sicher): einrichten ⇒ Probeversand erscheint **lesbar**
   (Server 13.1 Nr. 1), Umlaute korrekt (Nr. 2), Antippen öffnet bzw. fokussiert die App auf `/` bzw. `/admin`.
4. **Android (HTTPS, 1.4):** Onboarding erscheint nach der ersten Anmeldung; „Installieren“ ⇒ Startbildschirm,
   `standalone`; Schritt 2 aus dem Klick; zweites Gerät ⇒ beide bekommen den Probeversand (Nr. 3).
5. **iPhone ab iOS 16.4 (HTTPS):** in Safari Anleitung statt Schalter; nach „Zum Home-Bildschirm“ einrichten aus dem Klick
   ⇒ Probeversand kommt an (**Nr. 1a**, der einzige Beleg für den `sub`-Anspruch).
6. **Personenschalter aus** ⇒ Hinweis einmal; Probeversand geht trotzdem (Nr. 4), eine echte Erinnerung nicht; wieder an.
7. **Berechtigung im Browser entziehen** ⇒ beim Zurückkehren „im Browser blockiert“; Versand ⇒ `410`, Abo deaktiviert
   (Nr. 5); Server-Nr. 6 (Neuladen heilt ein serverseitig deaktiviertes, im Browser noch geführtes Abo) mit dem
   Start-Abgleich nachstellen.
8. **Erinnerung:** `pushErinnerungStunden` auf 1, Termin in 30 Minuten, Spieler ohne Rückmeldung ⇒ binnen fünf Minuten
   **eine** Nachricht, Titel mit Wochentag und Uhrzeit, Antippen ⇒ `/termine/{id}` (bei abgelaufener Sitzung über die
   Anmeldung) (Nr. 7). **Werte danach zurücksetzen.**
9. **Absage** über alle drei Wege (Absagen, Ändern nach `ABGESAGT`, Hallenabsage – nur mit Testpostfach, C8 1.4) ⇒ Zusager
   bekommen sie; eine vorhandene Erinnerung desselben Termins wird **ersetzt** (`tag`) (Nr. 10).
10. **Gast:** kein Symbol, keine Karte, `/einstellungen` nur mit Satz; `GET /push/status/lesen` von Hand ⇒ `403` (Nr. 12).
11. **Geteiltes Gerät:** Spieler A richtet ein, meldet sich ab, Spieler B meldet sich an ⇒ der Start-Abgleich übergibt das
    Abo an B (Probe über eine Erinnerung an B oder Serverprotokoll).
12. **Server ohne VAPID** (Variablen entfernen, neu starten) ⇒ Bereich ohne Bedienelemente, Admin-Probeversand mit Satz
    aus 3.3 (Nr. 11).
13. **Aktualisierung:** Fassung mit geändertem `sw.ts` ausliefern ⇒ Aktualisierungshinweis; Push funktioniert vor und nach
    „Jetzt aktualisieren“. Sichtprüfung bei 360 px: Einstellungen (alle Lagen), Onboarding-Karte, Kopfzeile mit drei
    Schaltflächen.

---

## 10. Nachdokumentation und Commit

- `CONTEXT_HANDOFF_CLIENT.md` (Vorfassung ins Archiv): E23–E33 (bestätigte Fassung), neue Module (`src/pwa/*`,
  `src/api/push/push.ts`, `src/hooks/push/*`, `Einstellungen`, `Onboarding`, `PushAbgleich`), Testzahlen, Stand der
  Handprüfung (welche Geräte geprüft, ob HTTPS-Zugang gelang); Meilensteintabelle C9 auf abgeschlossen; Platzhalter-Satz in
  der Strukturbeschreibung streichen.
- `AGENT_CLIENT.md`: Regeln „Browser-Push-API nur über `src/pwa/pushGeraet.ts`“, „`requestPermission` als erster Schritt im
  Klick“, „Worker ohne `fetch`, immer eine Benachrichtigung“, „`tag` = `termin-{id}`“, „Start-Abgleich mit `keinRefresh`“,
  „Abmelden kündigt kein Abo“; neue Bausteine unter „Basis-Komponenten“.
- **DESIGN.md:** Abweichungen aus 1.3 dem Entwickler vorlegen.
- **Server-Track:** Hinweis P13 (Titel der Probe-Nutzlast) und Ergebnis der Handprüfliste 13.1.
- `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`: Abschnitt 6 „Offen (Paket C9)“ als erledigt fortschreiben.
- Commit auf `dev_client`, **je Stufe auf Aufforderung**; nichts nach `main`; Git im verbundenen Ordner nur mit
  `--no-optional-locks`; für den Commit die Löschfreigabe (Sperrdateien in `.git`).

---

## 11. Fallen

Die Fallen aus C7 14 und C8 14 gelten weiter. Zusätzlich:

- **Nutzergeste:** `Notification.requestPermission()` ist der **erste** Befehl im Klick. Ein `await` davor (Schlüssel
  laden, Bestätigungsdialog) kostet auf Safari die Geste – die Anfrage scheitert ohne Dialog.
- **`serviceWorker.ready` löst ohne Worker nie auf** (`npm run dev` ohne `dev:pwa`, Firefox im privaten Modus): Zeitlimit
  und verständlicher Fehler statt ewigem Laden.
- **`503` wird sonst wiederholt:** Der `queryClient` wiederholt `5xx` einmal; für den Schlüssel `retry: false`.
- **Schlüsselwechsel:** `subscribe` mit anderem `applicationServerKey` wirft `InvalidStateError` – erst kündigen.
- **`endpoint` ist opak:** nie bearbeiten; `p256dh`/`auth` aus `toJSON().keys`, nicht selbst aus `getKey()` kodieren.
- **`userVisibleOnly: true`** verpflichtet zu einer Anzeige je Push. Kein frühes `return` im `push`-Handler, auch nicht bei
  kaputter Nutzlast – sonst blendet Chrome eine eigene Meldung ein und kann das Abonnement einschränken.
- **Kein API-Aufruf im Worker** (P10) – auch nicht „nur zum Ergänzen“.
- **Nachrichten vom Worker** an die Seite bleiben ohne `startMessages()` in der Warteschlange.
- **`sw.ts` ist aus `tsconfig.app.json` ausgeschlossen:** gemeinsamer Code (`benachrichtigung.ts`) darf weder DOM- noch
  WebWorker-spezifische Typen nutzen und importiert nichts aus der Anwendung.
- **`beforeinstallprompt`** kommt früh und nur in Chromium-Browsern; `preventDefault()` und `prompt()` genau einmal je
  Ereignis. iOS kennt es nicht; dort ist `navigator.standalone` die Erkennung.
- **`isSecureContext`:** Über eine LAN-Adresse fehlt `PushManager` – das ist die Lage `unsicher`, kein Browserfehler.
- **`localStorage` kann werfen** (Safari privat, gesperrte Speicher): immer `try/catch`.
- **E2E:** Ohne Vermerk erscheint die Karte in jeder Spec (3.4); ein echtes `subscribe()` scheitert headless (Attrappe).
- **`StrictMode`** ruft Wirkungen doppelt: Der Start-Abgleich schützt sich über eine Modulvariable.
- **Personenschalter und Admin-Profil:** Schaltet ein Spieler um, während der Admin sein Profil offen hat, bekommt der Admin
  beim Speichern `409 DATEN_VERALTET` – gewollt (Vertrag), E5 fängt es ab.
- **`denied` ist endgültig** für die Seite: kein zweiter Dialog möglich, nur die Browsereinstellung hilft – deshalb kein Knopf.
- **Abschalten löscht kein Abonnement** (P5) – die Gerätezeile bleibt „eingerichtet“, wenn die Person abschaltet. Das ist
  richtig und kein Anzeigefehler.

---

## 12. Zeitplan (14,0 h in zwei Stufen)

Jede Stufe endet **grün** (`lint`, `tsc`, `test`, `build`, E2E in drei Chromium-Projekten) und wird einzeln committet (auf
Aufforderung). **Voraussetzung: C8 ist abgeschlossen** (2).

| Stufe | Schritt | Abschnitt | h |
|---|---|---|---|
| **1 – Push** | API, Schlüssel, Mocks, Umgebung, Adapter, Lage | 3, 4, 6.1 | 2,5 |
| | Einstellungsseite, Kopfzeilen-Symbol | 6.2 | 2,0 |
| | Probeversand | 6.3 | 0,75 |
| | Start-Abgleich | 6.4 | 0,75 |
| | Service Worker, Navigation aus der Benachrichtigung | 6.5 | 1,25 |
| | Tests, E2E, Gegenproben, Abnahme der Stufe | 8, 9 (Nr. 1–3, 6–12) | 2,25 |
| | *Zwischensumme* | | *9,5* |
| **2 – Installation, Onboarding** | Installationsangebot, iOS-Anleitung | 7.1 | 1,25 |
| | Onboarding-Karte, Speicher | 7.2 | 1,25 |
| | Abschnitt „App installieren“ | 7.3 | 0,25 |
| | Tests, E2E, Abnahme (Nr. 4, 5, 13), Doku | 8, 9, 10 | 1,75 |
| | *Zwischensumme* | | *4,5* |
| **Summe C9** | | | **14,0** |

**Reihenfolge:** Stufe 2 nutzt `usePushEinrichten`, `usePushSchluessel` und `usePushStatus` aus Stufe 1 für den zweiten
Schritt der Karte. **Die Reihenfolge ist zwingend.**

**Risiken:** (1) **HTTPS für Telefone** fehlt bis C10 (1.4) – ohne Tunnel wandern Nr. 4 und 5 nach C10, und damit der
einzige iPhone-Beleg. (2) **Push im Headless-Chromium** (8.2) ist ungewiss; der Zeitkasten begrenzt den Aufwand. (3)
**Browserunterschiede** (Safari, Firefox, Samsung Internet) bei `renotify`, Symbol und `beforeinstallprompt` zeigen sich
erst auf Geräten – vor Stufe 2 die Geräte bereitlegen. (4) Die **Handprüfung der Erinnerung** ändert die gemeinsame
Konfiguration (`pushErinnerungStunden`) – Werte notieren und zurücksetzen. (5) **Kopfzeile bei 360 px** mit drei
Schaltflächen: Reicht der Platz nicht, „Zurück“ als Symbol mit Beschriftung für Screenreader (vorher mit dem Entwickler
klären, E23).
