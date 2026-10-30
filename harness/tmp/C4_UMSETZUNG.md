# C4 – Admin-Zugang, Passwort-Reset und -wechsel (Umsetzungsanleitung)

> Arbeitspaket **C4** (geschätzt 8 h). Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (A22),
> `client/harness/AGENT_CLIENT.md`, `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Screens 1, 17),
> Vertrag `client/harness/assets/fubo-api.json` (am 04.10.2026 byteweise gleich mit `server/fubo-api.json`).
> Referenz: `FuBo_Design_Prototypen.html`, Screens 03, 15, 15b, 15c – Abweichungen zulässig (Abschnitt 1.3).
>
> **Fassung vom 04.10.2026 (abends)**, Stand Commit `3d69127` auf `dev_client` (C3 abgeschlossen).
> Enthält die Entscheidungen des Entwicklers vom selben Abend (Abschnitt 1.2).

---

## 0. Ziel und Abgrenzung

Nach C4 kann sich der Admin anmelden, ein vergessenes Passwort über die Bestätigungs-PIN aus der
E-Mail zurücksetzen und sein Passwort im angemeldeten Zustand ändern.

| Endpunkt | Stufe/Rolle | Ansicht |
|---|---|---|
| `POST /auth/admin/anmelden` | `PIN_VERIFIED` | Admin-Anmeldung |
| `POST /auth/passwort/zuruecksetzen` | `PIN_VERIFIED` | Passwort vergessen, Schritt 1 |
| `POST /auth/passwort/bestaetigen` | `PIN_VERIFIED` | Passwort vergessen, Schritt 2 |
| `POST /admin/passwort/aendern` | `ADMIN` | Passwort ändern |

**Nicht Teil von C4:** Admin-Dashboard mit Verwaltungsbereichen (C7; `/admin` bleibt Platzhalter),
Anmeldename ändern (`/admin/name/aendern`) und zentrale PIN ändern (`/admin/pin/aendern`) – beide
Verwaltungsaufgaben, gehören zu C7. Keine neuen Abhängigkeiten.

---

## 1. Vorab: Befunde und Entscheidungen

### 1.1 Der Admin-Login liegt hinter der zentralen PIN

Laut Vertrag sind alle drei `/auth/…`-Endpunkte **nur in `PIN_VERIFIED`** erreichbar („Auch der Admin
braucht zuerst die zentrale PIN"). Bis C3 ist `/admin/anmelden` eine **öffentliche** Route ohne Guard,
und der Link „Als Admin anmelden" sitzt auf der PIN-Eingabe. Der erste Anmeldeversuch bekäme
`401 SESSION_UNGUELTIG`, und die globale Behandlung schickte den Admin zur PIN zurück.

**Lösung (Entscheidung E5):** Der Einstieg wandert in die **Namensauswahl**. Dort steht die Sitzung
immer in `PIN_VERIFIED` – der Link führt also stets in der richtigen Stufe zur Admin-Anmeldung. Die
PIN-Seite verliert den Link ersatzlos. Die Admin-Login-Routen kommen zusätzlich hinter den Guard der
Stufe `PIN_VERIFIED` (Abschnitt 4), damit Neuladen und Direktaufruf ebenfalls funktionieren.

### 1.2 Entscheidungen (getroffen am 04.10.2026)

| # | Frage | Entscheidung | Begründung |
|---|---|---|---|
| E1 | Wohin führt die Anmeldung des Admins? | **`/admin`** (Admin-Dashboard, bis C7 Platzhalter) | A9: getrennte Dashboards. Das User-Dashboard `/` bleibt für den Admin erreichbar. |
| E2 | Passwort vergessen: zwei oder drei Ansichten? | **Zwei:** „PIN anfordern" und „PIN und neues Passwort" | Der Server prüft PIN und Passwort in **einem** Aufruf. Bei drei Ansichten käme eine falsche PIN erst im letzten Schritt ans Licht. |
| E3 | Passwortwiederholung? | **Nein.** Reset: PIN und neues Passwort. Wechsel: altes und neues Passwort. | Weniger Felder auf dem Telefon. Folge: Die Schaltfläche „zeigen" am Passwortfeld ist die einzige Kontrolle gegen Tippfehler und wird Pflicht (5.3). |
| E4 | Hinweis nach Passwortwechsel und Reset | **Neutraler Hinweis auf der Zielseite** (PIN-Eingabe bzw. Admin-Anmeldung) | Nach dem Passwortwechsel ist die Adminsitzung sofort weg; eine Bestätigung auf der Admin-Seite räumte der nächste Frist-Abruf (spätestens 30 s) weg. |
| E5 | Wo steht „Als Admin anmelden"? | **Nur in der Namensauswahl**, auf der PIN-Seite entfernt | Siehe 1.1. Die Option soll auf der PIN-Seite nicht mehr verfügbar sein. |

### 1.3 Abweichungen von DESIGN.md und Prototyp (verbindlich ist der Vertrag)

| Vorgabe | Umsetzung | Grund |
|---|---|---|
| DESIGN.md Screen 1: PIN-Login „alternativ Einstieg in den Admin-Login" | Einstieg in der **Namensauswahl** (E5) | Der Admin-Login verlangt `PIN_VERIFIED`; vor der PIN ist er nicht nutzbar. |
| Screen 03: „Zurück zum PIN-Zutritt" | „Zurück" zur Namensauswahl | Die Sitzung steht in `PIN_VERIFIED`; die PIN-Seite leitete sofort weiter. |
| Screen 15: Feld „E-Mail-Adresse" | **entfällt** | `zuruecksetzen` hat **keinen Anfragekörper**; es gibt genau eine hinterlegte Adresse. |
| Screen 15b: „Versuch 1 von 3" | „Höchstens **fünf** Versuche" | Vertrag: fünf Versuche, danach `409`. Den Zähler kennt nur der Server, der Client zeigt keine Zahl „x von 5". |
| Screen 15b: „PIN erneut senden (in 1:20 möglich)" | „Neue PIN anfordern" ohne Countdown | Der Server drosselt auf drei Anforderungen je Stunde (`429 RESET_GEDROSSELT` mit `wartesekunden`); eine feste Wartezeit gibt es nicht. |
| Screens 15b/15c getrennt | ein Formular (E2) | Ein Serveraufruf für beides. |
| Screen 15c: Feld „Wiederholen" | **entfällt** (E3) | Entscheidung des Entwicklers. |
| Screen 15c: Regel „Ziffer enthalten" | **entfällt** | Vertrag: mindestens 10, höchstens 72 Zeichen, **keine** Zeichenklassen. |
| Screen 03: Beispielname | keine realen Personennamen | `AGENT_CLIENT.md`; in Tests „Beispieladmin". |

---

## 2. Was bereits steht und wiederverwendet wird

- **Stufenwechsel:** `useSitzungswechsel` (andere Daten entfernen, Sitzungsabruf abbrechen, neu lesen).
  Die Admin-Anmeldung ist ein Stufenwechsel wie PIN und Namenswahl.
- **Sitzungsende:** `istSitzungsende` behandelt `ADMIN_PASSWORT_FALSCH` und `RESET_PIN_FALSCH` bereits
  als **Eingabefehler** (getestet in `queryClient.test.ts`). Nichts zu ändern – aber nicht kaputtmachen.
- **Sperre bei `429`:** `PinEingabe` hält „Zutritt" für `wartesekunden` gesperrt. Dieselbe Logik
  braucht die Admin-Anmeldung → herauslösen (5.1).
- **PIN-Kästchen:** `PinEingabe` hat vier Kästchen über einem nativen Zahlenfeld im festen CSS-Raster.
  Die Bestätigungs-PIN hat fünf → herauslösen (5.2).
- **Guard der Stufe `PIN_VERIFIED`:** `LoginSchrittRoute schritt="name"` vergleicht nicht den Pfad,
  sondern die **Stufe** (`zielFuerStufe` ergibt für `PIN_VERIFIED` immer `/anmelden`). Jede Kindroute
  dieser Gruppe ist damit an `PIN_VERIFIED` gebunden – **ohne Änderung am Guard**.
- **Basis-Komponenten:** `Feld`, `CustomButton`, `Fehlermeldung`, `Aktionsleiste`, `Fortschrittsbalken`,
  `Erklaerung`, `Ladespinner`.
- **Fehlertexte:** immer `fehlertextBilden(fehler, ersatz)`; Verzweigung nur über `code`.

---

## 3. Datenzugriff und Mocks (ca. 0,75 h)

### 3.1 API-Funktionen

Domänenregel: `/auth/*` → `src/api/auth/auth.ts`, `/admin/*` → **neu** `src/api/admin/admin.ts`.

```ts
// src/api/auth/auth.ts
export type AdminAnmeldung = components['schemas']['AdminLoginRequest']
export type PasswortBestaetigung = components['schemas']['PasswortResetBestaetigenRequest']

export async function adminAnmelden(anfrage: AdminAnmeldung): Promise<void> {
  await aufrufen<void>('POST', '/auth/admin/anmelden', { body: anfrage })
}

/** Kein Anfragekörper: genau ein Admin, genau eine hinterlegte Adresse (Vertrag). */
export async function passwortZuruecksetzen(): Promise<void> {
  await aufrufen<void>('POST', '/auth/passwort/zuruecksetzen')
}

export async function passwortBestaetigen(anfrage: PasswortBestaetigung): Promise<void> {
  await aufrufen<void>('POST', '/auth/passwort/bestaetigen', { body: anfrage })
}
```

```ts
// src/api/admin/admin.ts
export type PasswortAenderung = components['schemas']['PasswortAendernRequest']

export async function passwortAendern(anfrage: PasswortAenderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/passwort/aendern', { body: anfrage })
}
```

Alle vier antworten mit `204` → `undefined`. Keiner trägt `X-FuBo-Kein-Refresh`: Es sind Bedienungen.
JSDoc wie in `auth.ts`: Stufe, Fehlercodes, Folgen (Token rotiert, Sitzungen widerrufen).

### 3.2 Mocks (`src/test/mocks/handlers.ts`)

- Standard-Handler für die vier Endpunkte mit `204`.
- `beispielAdminSitzung` (`rolle: 'ADMIN'`) und `beispielPinSitzung` (`stage: 'PIN_VERIFIED'`,
  `rolle: null`), Datum im Jahr 2099 (Falle aus C3).
- Fehlerfälle werden im Test per `mockServer.use(...)` gesetzt, nicht im Standard.

---

## 4. Routing und Einstieg (ca. 0,5 h)

### 4.1 Pfade

In `zielpfad.ts` ergänzen; die Literale stehen nur dort:

```ts
export const ADMIN_PFADE = {
  /** Stufe PIN_VERIFIED */
  anmelden: '/admin/anmelden',
  passwortVergessen: '/admin/passwort/vergessen',
  passwortNeu: '/admin/passwort/neu',
  /** Rolle ADMIN */
  start: '/admin',
  passwortAendern: '/admin/passwort/aendern',
} as const
```

### 4.2 Einordnung in den Routenbaum

Die drei Admin-Login-Ansichten werden Geschwister der Namensauswahl in der Gruppe
`LoginSchrittRoute schritt="name"`:

```tsx
{
  element: <LoginSchrittRoute schritt="name" />,
  children: [
    { path: 'anmelden', element: <Namensauswahl />, handle: LOGIN_SCHRITT },
    { path: 'admin/anmelden', element: <AdminAnmeldung />, handle: { zurueck: LOGIN_PFADE.name } },
    { path: 'admin/passwort/vergessen', element: <PasswortVergessen />, handle: { zurueck: ADMIN_PFADE.anmelden } },
    { path: 'admin/passwort/neu', element: <PasswortNeu />, handle: { zurueck: ADMIN_PFADE.passwortVergessen } },
  ],
},
```

Die bisherige öffentliche Route `admin/anmelden` (Platzhalter) entfällt. Unter `AdminRoute` kommt
`admin/passwort/aendern` hinzu (`handle: { zurueck: ADMIN_PFADE.start }`).

**Verhalten danach:**
- Ohne Sitzung führt `/admin/anmelden` zur PIN, nach der PIN zur Namensauswahl. Von dort ist die
  Admin-Anmeldung ein Tipp. Ein Merken des Ziels über `state.von` ist **nicht** nötig (E5).
- In `PROFILE_AUTHENTICATED` leitet der Guard weiter. Ein Spieler, der Admin werden will, meldet sich
  erst ab (der Server antwortete sonst `403`).

### 4.3 Link umziehen (E5)

- **PIN-Eingabe:** Link „Als Admin anmelden" (`pin-admin-link`), die Klasse `.adminLink` und den Test in
  `PinEingabe.test.tsx` (Zeile ~151) entfernen. Kein Ersatztext.
- **Namensauswahl:** Link „Als Admin anmelden" (`namensauswahl-admin-link`) auf `ADMIN_PFADE.anmelden`,
  kompakt als Textlink unter der Aktionsleiste (wie bisher auf der PIN-Seite; die Linkfarbe
  `--farbe-link` stammt aus genau diesem Prototyp-Link, Kommentar in `_globalVars.scss` anpassen).
- **Platz prüfen:** Die Namensauswahl füllt 360 × 780 mit Gastbereich bereits; der E2E-Test
  „meldet einen Verbindungsverlust …" prüft „kein Scrollen" ab 740 px Fensterhöhe. Nach dem Einbau
  diesen Test laufen lassen. Scrollt die Ansicht, zuerst Abstände der Aktionsleiste prüfen, nicht die
  Grenze von 740 px verschieben.

### 4.4 Ziel nach der Anmeldung (E1)

`zielFuerStufe` bekommt `istAdmin` dazu und liefert für `angemeldet && istAdmin`
**`ADMIN_PFADE.start`**. Betroffen sind:
- `LoginSchrittRoute`: leitet nach der Admin-Anmeldung dorthin (ein gesetztes `state.von` hat wie
  bisher Vorrang).
- `AppLayout`: Auf `/admin` keine Zurück-Schaltfläche (`handle.ohneZurueck` an der Indexroute von
  `admin`), sonst schickte „Zurück" den Admin ins User-Dashboard.

### 4.5 Bestehende Tests, die an der alten Route hängen

`e2e/layout.spec.ts` benutzt `/admin/anmelden` in sieben Tests als **öffentliche Route mit
Zurück-Schaltfläche** und springt im Tab-Test auf `pin-admin-link`. Beides gibt es danach nicht mehr:

| Test | Neue Grundlage |
|---|---|
| „laesst die Admin-Anmeldung offen" | umdeuten: ohne Sitzung → PIN; mit `PIN_VERIFIED` (per `page.route`) → Admin-Anmeldung sichtbar |
| „zeigt die Zurueck-Navigation …", „haelt das Mindestmass fuer Tap-Ziele ein", „legt den Offline-Hinweis …" | `/admin/anmelden` mit nachgebildeter `PIN_VERIFIED`-Sitzung |
| „fuehrt beim Direkteinstieg mit Zurueck zur Startseite …" | braucht eine Route **ohne** `handle.zurueck`, z. B. `/teams/1` mit nachgebildeter Spielersitzung (sonst greift die Zielangabe statt der Direkteinstiegs-Regel) |
| „geht nach einem Schritt … mit Zurueck dorthin zurueck" | Namensauswahl → `namensauswahl-admin-link` → Zurück → Namensauswahl |
| „zeigt den Fokusring bei Tastaturbedienung" | auf der PIN-Seite gibt es nach Tab kein Ziel mehr („Absenden" ist leer gesperrt) → auf die Namensauswahl verlegen |

Die Sitzungsnachbildung aus `sitzung-ablauf.spec.ts` (`sitzungNachbilden`) nach `e2e/hilfen/`
herauslösen und um `stage` erweitern, statt sie zu kopieren. Kommentare, die `/admin/anmelden` als
öffentliche Route nennen, ebenfalls nachziehen: `routen.tsx`, `queryClient.ts`, `useVerbindung.ts`.

---

## 5. Gemeinsame Bausteine (ca. 1,5 h)

### 5.1 `useSperre` (aus `PinEingabe` herauslösen)

`src/hooks/useSperre.ts`: hält `sperreBis`, setzt ihn aus einem `ApiFehler` mit `wartesekunden`, hebt
ihn nach Ablauf auf und ruft dann einen Rückruf (Mutation zurücksetzen). Verbraucher: `PinEingabe`,
`AdminAnmeldung`, `PasswortNeu`, `PasswortAendern` (alle `PIN_GESPERRT`), `PasswortVergessen`
(`RESET_GEDROSSELT`).

```ts
const sperre = useSperre({ beimEnde: anmeldung.reset })
// im onError der Mutation:
sperre.ausFehler(fehler) // setzt die Sperre nur bei 429 mit wartesekunden
// in der Ansicht:
<CustomButton type="submit" disabled={sperre.aktiv}>Anmelden</CustomButton>
```

**Erst umbauen, dann verwenden:** Die bestehenden Tests von `PinEingabe` müssen nach dem Herauslösen
unverändert grün sein.

### 5.2 `PinFeld` (aus `PinEingabe` herauslösen)

`src/components/PinFeld/`: natives `<input inputMode="numeric">` über `stellen` Kästchen im **festen
CSS-Raster** (Safari-Falle aus C3), `maxLength={stellen}`, nur Ziffern übernehmen. Props: `stellen`,
`wert`, `beiAenderung`, `fehlerhaft`, `beschriftung`, `hinweisId`, `autoComplete`, `data-testid`.
`PinEingabe` nutzt danach `PinFeld stellen={4} autoComplete="off"`.

Für die Bestätigungs-PIN **`autoComplete="one-time-code"`**: Systeme mit Code-Autofill (etwa iOS ab
Version 17 für Codes aus Mail) bieten den Code dann über der Tastatur an. Ohne diese Unterstützung
schadet die Angabe nicht; in der Handprüfung nachsehen, ob es greift.

### 5.3 Passwortfeld mit „zeigen" (Pflicht wegen E3)

`Feld` reicht `type="password"` durch, hat aber keinen Platz für eine Schaltfläche im Feld. Vorschlag:
`Feld` um eine optionale Eigenschaft `aktion?: ReactNode` erweitern (rechts im Feld), darauf
`src/components/PasswortFeld/` aufbauen:

- Umschalter als `<button type="button" aria-pressed={sichtbar}>` mit Text „zeigen"/„verbergen",
  Tap-Ziel mindestens `--tapziel-min`. Ohne Wiederholungsfeld ist das die einzige Möglichkeit, das
  neue Passwort vor dem Speichern zu kontrollieren.
- `autoComplete`: `current-password` (Login, bisheriges Passwort) bzw. `new-password` (neues Passwort).
  Damit funktionieren Passwortmanager und deren Vorschläge – ein vorgeschlagenes Passwort ist auch ohne
  Wiederholung sicher gespeichert.
- `maxLength={72}`, **kein** Trimmen (Leerzeichen im Passwort sind gültig).
- `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`.
- Beim Absenden wieder auf verborgen schalten (das Passwort bleibt nicht sichtbar auf dem Bildschirm
  stehen, falls ein Fehler zurückkommt).

### 5.4 Regel-Checkliste für das neue Passwort

`src/components/PasswortRegeln/`: Liste mit **Icon und Text** je Regel (nicht nur Farbe, DESIGN.md):
„mindestens 10 Zeichen"; „höchstens 72 Zeichen" erscheint erst, wenn überschritten. Die Grenzen als
Konstanten mit Verweis auf den Vertrag. Absenden erst, wenn die Regeln erfüllt sind – der Server bleibt
die Autorität (`400` mit `felder` wird trotzdem behandelt). Die Liste ist mit dem Feld über
`aria-describedby` verbunden; Änderungen werden **nicht** live vorgelesen (sonst bei jedem Zeichen).

### 5.5 Hinweis auf der Zielseite (E4)

- `sitzungsendeAusloesen(hinweis?: string)` reicht den Text an den Rückruf weiter; der
  `SitzungsWaechter` navigiert mit `state: { hinweis }` zur PIN. Ohne Text verhält sich alles wie bisher.
- Der Reset navigiert selbst zur Admin-Anmeldung mit `state: { hinweis }` (die Sitzung bleibt bestehen).
- Die Zielansicht (PIN-Eingabe, Admin-Anmeldung) zeigt `state.hinweis` als **neutralen** Hinweis mit
  `role="status"` über dem Formular, nicht als `Fehlermeldung` (kein Fehler, kein `role="alert"`).
  Er verschwindet mit der nächsten Eingabe oder dem nächsten Absenden.

---

## 6. Admin-Anmeldung (ca. 1 h)

`src/pages/AdminAnmeldung/`, Hook `src/hooks/useAdminAnmelden.ts` (Muster `usePinPruefen`:
`onSuccess: () => stufeGewechselt()`).

**Aufbau:** Überschrift „Administration – Anmelden", `Feld` „Name" (`autoComplete="username"`,
`maxLength={60}`, `autoCapitalize="none"`, Hinweis „Gross- und Kleinschreibung beachten"),
`PasswortFeld` „Passwort", Primäraktion „Anmelden" in der `Aktionsleiste`, Link „Passwort vergessen?".
Ggf. der Hinweis aus 5.5 über dem Formular.

**Warum `autoCapitalize="none"` hier wichtig ist:** Der Server vergleicht den Namen **zeichengenau**.
iOS schreibt das erste Zeichen sonst gross – ein Admin namens „admin" könnte sich auf dem iPhone nie
anmelden. Randleerzeichen entfernt der Server selbst; der Client trimmt nicht zusätzlich.

**Fehler:**

| Antwort | Verhalten |
|---|---|
| `400 EINGABE_UNGUELTIG` | `felder.anmeldename`/`felder.passwort` am jeweiligen Feld, sonst im Kasten |
| `401 ADMIN_PASSWORT_FALSCH` | Text im Kasten (**nicht** am Feld: Name und Passwort sind laut Vertrag nicht unterscheidbar), Passwort leeren, Name behalten, Fokus ins Passwortfeld |
| `401 SESSION_UNGUELTIG` | globale Behandlung → PIN (die `PIN_VERIFIED`-Sitzung ist abgelaufen) |
| `429 PIN_GESPERRT` | `useSperre`; derselbe Zähler wie an der PIN, daher derselbe Code |
| Netzfehler, `≥ 500` | `Fehlermeldung`; neuer Versuch über den Knopf |

Nach Erfolg navigiert die Ansicht **nicht selbst** – der Guard leitet nach `zielFuerStufe` zu `/admin`
(wie bei PIN und Namenswahl).

---

## 7. Passwort vergessen (ca. 1,5 h)

### 7.1 Schritt 1: `PasswortVergessen`

Text: „Wir senden eine 5-stellige Bestätigungs-PIN an die hinterlegte E-Mail-Adresse des Admin-Kontos."
Fortschritt „Schritt 1 von 2". Primäraktion „PIN anfordern"; Link „Ich habe bereits eine PIN" →
Schritt 2 (siehe 7.3).

| Antwort | Verhalten |
|---|---|
| `204` | `navigate(ADMIN_PFADE.passwortNeu, { state: { angefordertUm: Date.now() } })` |
| `429 RESET_GEDROSSELT` | `useSperre`, Text vom Server (enthält die Wartezeit) |
| `503 VERSAND_FEHLGESCHLAGEN` | `Fehlermeldung`; `istWiederholbar` ist wahr, „Erneut versuchen" anbieten. Laut Vertrag bleibt kein Vorgang zurück. |

### 7.2 Schritt 2: `PasswortNeu`

Ein Formular, „Schritt 2 von 2": `PinFeld stellen={5}` („Bestätigungs-PIN"), `PasswortFeld` „Neues
Passwort" (`new-password`), `PasswortRegeln`, Primäraktion „Passwort speichern".

**Restgültigkeit (DESIGN.md 17):** Der Vertrag nennt 15 Minuten ab Anforderung
(`RESET_GUELTIG_MS = 15 * 60_000`). Aus `state.angefordertUm` ergibt sich das Ende; angezeigt als
`Fortschrittsbalken` plus Text. Für Screenreader **keine tickende Zahl** (Entscheidung aus C3), sondern
ein fester Satz: „Gültig bis 20:58 Uhr." Die Geräteuhr ist nur Darstellung – ob die PIN noch gilt,
entscheidet der Server (`409`).

`navigate`-State liegt in `history.state` und **übersteht ein Neuladen** im selben Tab; kein
`sessionStorage`. Fehlt `angefordertUm` (Einstieg über „Ich habe bereits eine PIN"), entfällt der
Balken und der Text lautet „Die PIN ist 15 Minuten ab Anforderung gültig."

**Versuche:** fester Hinweis „Höchstens fünf Versuche, danach muss eine neue PIN angefordert werden."
Keine eigene Zählung im Client: Den Stand kennt nur der Server (er überlebt abgebrochene Anfragen und
andere Geräte).

| Antwort | Verhalten |
|---|---|
| `204` | `navigate(ADMIN_PFADE.anmelden, { replace: true, state: { hinweis: 'Passwort gesetzt. Melde dich mit dem neuen Passwort an.' } })` – die Sitzung bleibt `PIN_VERIFIED` (Vertrag) |
| `400 EINGABE_UNGUELTIG` | `felder.bestaetigungsPin`/`felder.neuesPasswort` am Feld |
| `401 RESET_PIN_FALSCH` | Text am PIN-Feld, PIN leeren, Passwort **behalten**, Fokus ins PIN-Feld |
| `409 RESET_UNGUELTIG` | Text im Kasten plus Aktion „Neue PIN anfordern" (→ Schritt 1). Das ist laut Vertrag genau der Unterschied zu `401`: neu anfordern statt nochmal versuchen. |
| `429 PIN_GESPERRT` | `useSperre` |

**Reihenfolge der Prüfung im Server beachten:** Ein Passwort, das an der Regel scheitert (`400`), kostet
keinen Versuch. Die Client-Regeln (5.4) verhindern diesen Fall ohnehin; die Behandlung bleibt trotzdem.

### 7.3 Falle: Sitzung läuft während des Wartens auf die E-Mail ab

Die `PIN_VERIFIED`-Sitzung hat das normale Leerlauf-Fenster (Vorgabe 15 Minuten). Wer auf die E-Mail
wartet, bedient nichts. Läuft sie ab, führt die globale Behandlung zur PIN – der `navigate`-State ist
dann weg, der Reset-Vorgang auf dem Server aber **noch gültig** (er hängt am Admin-Konto, nicht an der
Sitzung). Weg zurück: PIN → Namensauswahl → „Als Admin anmelden" → „Passwort vergessen?" → „Ich habe
bereits eine PIN". Eine neue Anforderung würde die alte PIN entwerten.

---

## 8. Passwort ändern (ca. 0,75 h)

`src/pages/PasswortAendern/` unter `AdminRoute`, Hook `usePasswortAendern` (Domäne `admin`).
Felder: `PasswortFeld` „Bisheriges Passwort" (`current-password`) und „Neues Passwort"
(`new-password`), `PasswortRegeln`. Einstieg vorerst über einen Link auf dem Platzhalter `/admin`; das
eigentliche Dashboard folgt in C7.

| Antwort | Verhalten |
|---|---|
| `204` | **`sitzungsendeAusloesen('Passwort geändert. Bitte melde dich mit dem neuen Passwort an.')`** – der Server hat alle Adminsitzungen widerrufen und das Cookie gelöscht |
| `400 EINGABE_UNGUELTIG` | `felder.altesPasswort`/`felder.neuesPasswort` am Feld |
| `401 ADMIN_PASSWORT_FALSCH` | Text am Feld „Bisheriges Passwort", nur dieses leeren. **Kein Sitzungsende** – `istSitzungsende` unterscheidet über `code` |
| `401 SESSION_UNGUELTIG` | globale Behandlung |
| `429 PIN_GESPERRT` | `useSperre` (ein falsches altes Passwort zählt auf den Brute-Force-Zähler) |

Warum der Client nach `204` selbst aufräumt, statt auf den nächsten `401` zu warten: Sonst stünde die
Admin-Ansicht bis zum nächsten Frist-Abruf (bis zu 30 s) mit einer Sitzung da, die es nicht mehr gibt,
und der Cache hielte Admin-Daten. `sitzungsendeAusloesen` ist dieselbe Funktion wie beim Ablauf.

---

## 9. Tests (im Paket, ca. 1,25 h ohne die Komponententests der Schritte)

### 9.1 Unit (Vitest, MSW, echter `queryClient`)

- API: Pfad, Methode, Körper; `zuruecksetzen` **ohne** Körper und ohne `Content-Type`; kein
  `X-FuBo-Kein-Refresh` an allen vier.
- `useAdminAnmelden`: nach Erfolg kennt `useSitzung` die Rolle `ADMIN` (mit beobachteter Sitzung, sonst
  lädt `invalidateQueries` nicht neu – Falle aus C1).
- `usePasswortAendern`: nach `204` ist der Cache leer und der Rückruf mit Hinweis gerufen; nach
  `401 ADMIN_PASSWORT_FALSCH` **nicht**.
- Routing: `/admin/anmelden` ohne Sitzung → PIN; mit `PIN_VERIFIED` → Admin-Anmeldung; mit Spielersitzung
  → `/`; mit Adminsitzung → `/admin`.
- `zielFuerStufe`: Admin → `/admin`, Spieler → `/`.
- `PinEingabe`: **kein** Link „Als Admin anmelden" mehr. `Namensauswahl`: Link vorhanden, Ziel
  `/admin/anmelden`.
- `useSperre`, `PinFeld` (5 Stellen, nur Ziffern), `PasswortFeld` (`aria-pressed`, `type` wechselt,
  nach Absenden verborgen), `PasswortRegeln`.
- Seiten: je Fehlerzeile der Tabellen in 6, 7.1, 7.2 und 8 ein Fall (Text am Feld oder im Kasten,
  welches Feld geleert wird, wohin der Fokus geht); Hinweis aus `state.hinweis` mit `role="status"`.

### 9.2 E2E

- `e2e/layout.spec.ts` umbauen (4.5).
- Neu `e2e/admin.spec.ts` (API über `page.route`):
  1. PIN → Namensauswahl → „Als Admin anmelden" → Admin-Anmeldung → `/admin`.
  2. Falsches Passwort: Kasten, Passwort leer, Name bleibt; Sperre bei `429` (Knopf deaktiviert).
  3. Reset: anfordern → Schritt 2 mit Balken → falsche PIN (Text am Feld) → `409` (Aktion „Neue PIN
     anfordern") → Erfolg → Admin-Anmeldung mit Hinweis.
  4. Passwort ändern → PIN-Eingabe mit Hinweis.
  5. Passwortfeld „zeigen": `type` wechselt, `aria-pressed` stimmt.
- Die Nachbildung zählt verlängernde Abrufe wie in `sitzung-ablauf.spec.ts` (Falle aus C3).
- `namensauswahl.spec.ts`: „kein Scrollen" ab 740 px mit dem neuen Link (4.3).

### 9.3 Gegenproben (Test rot ohne Absicherung)

Admin-Login-Route hinter dem Guard (ohne Guard bleibt `/admin/anmelden` ohne Sitzung offen);
`ADMIN_PASSWORT_FALSCH` beim Passwortwechsel kein Sitzungsende; Aufräumen nach `204` beim
Passwortwechsel; `409` bietet „Neue PIN anfordern"; Sperre deaktiviert den Knopf;
`autoCapitalize="none"` am Namen; Ziel `/admin` nach der Admin-Anmeldung.

---

## 10. Abnahme von C4

1. `npm run lint`, `typecheck`, `test`, `build`; ein `fetch(`; kein Hexwert ausserhalb der Tokendatei;
   Suche nach verwaisten Pfaden (`AGENT_CLIENT.md`).
2. E2E in den drei Chromium-Projekten lokal, alle sieben im CI.
3. **Handprüfung gegen den echten Server** (`ADMIN_NAME`, `ADMIN_PASSWORD` aus `server/.env`):
   - PIN-Seite ohne Admin-Link; Weg über die Namensauswahl.
   - Anmeldung richtig, falsch, falsche Schreibweise des Namens, Sperre nach fünf Fehlversuchen.
   - Reset mit echter E-Mail (SMTP muss im Server konfiguriert sein, sonst `503`): Restgültigkeit,
     falsche PIN, Erfolg, Hinweis auf der Admin-Anmeldung, Anmeldung mit neuem Passwort.
   - Passwort ändern, Hinweis auf der PIN-Seite, Anmeldung mit dem neuen Passwort; das alte gilt nicht mehr.
   - iPhone: Name mit Kleinbuchstaben eingeben (Grossschreibung bleibt aus), Code aus der E-Mail über
     `one-time-code` einfügen, Passwortmanager schlägt beim neuen Passwort ein starkes vor.
   - **Danach das Passwort im Passwortmanager nachziehen.** `ADMIN_PASSWORD` in `server/.env` liest der
     Server nur beim ersten Start (Bootstrap); der Wert ist nach einer Änderung veraltet.
4. Sichtprüfung bei 360 px: alle vier Ansichten und die Namensauswahl mit Link ohne Scrollen bei
   780 px Höhe, auch mit Fehlermeldung.

---

## 11. Nachdokumentation und Commit

- `CONTEXT_HANDOFF_CLIENT.md` (Vorfassung ins Archiv): Entscheidungen E1–E5, Routing-Änderung,
  neue Bausteine, Testzahlen; Abschnitt 6.4 „`/admin/anmelden` … liest beim Direkteinstieg keine
  Sitzung" streichen – die Route steht dann hinter dem Guard.
- `AGENT_CLIENT.md`: Admin-Login nur über die Namensauswahl, hinter `PIN_VERIFIED`; `useSperre`,
  `PinFeld`, `PasswortFeld`, `PasswortRegeln` unter „Basis-Komponenten"; Regel zu
  `autoComplete`/`autoCapitalize` an Anmeldefeldern.
- **DESIGN.md** gehört nicht zum Client-Repository: die Abweichung von Screen 1 (E5) im Handoff
  festhalten und dem Entwickler zur Übernahme in DESIGN.md vorlegen.
- `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`: Client-Stand.
- Commit auf `dev_client`; nichts nach `main`.

---

## 12. Fallen

- **Admin-Endpunkte unter `/auth/` verlangen `PIN_VERIFIED`, die unter `/admin/` die Rolle `ADMIN`.**
  Der Name ist kein Hinweis auf die Stufe.
- **`/admin/anmelden` war bisher die bequeme öffentliche Route der Layout-Tests** (4.5). Wer die Route
  hinter den Guard legt und nur die neuen Tests laufen lässt, bemerkt den Bruch erst im CI.
- **`429` am Admin-Login heisst `PIN_GESPERRT`**, nicht etwa „Passwort gesperrt": derselbe Zähler wie
  an der PIN. Der Anzeigetext kommt vom Server.
- **Passwort niemals loggen** – auch nicht in Testausgaben oder `console.debug` während der Entwicklung.
  In Tests nur offensichtliche Platzhalter (`'beispiel-passwort-01'`).
- **Kein `trim()` auf Passwörtern**, auch nicht „zur Sicherheit".
- **Ein neuer Reset entwertet den alten.** „Neue PIN anfordern" nur auf ausdrückliche Aktion, nie
  automatisch beim Betreten von Schritt 1.
- **Ablauf-Dialog gilt auch für den Admin** (er hängt in `GeschuetzteRoute`). Die Login- und Reset-
  Ansichten liegen davor und zeigen ihn nicht.

---

## 13. Zeitplan (8 h)

| Schritt | Abschnitt | h |
|---|---|---|
| Datenzugriff und Mocks | 3 | 0,75 |
| Routing, Link-Umzug, Ziel `/admin` | 4.1–4.4 | 0,5 |
| Gemeinsame Bausteine | 5 | 1,5 |
| Admin-Anmeldung | 6 | 1,0 |
| Passwort vergessen | 7 | 1,5 |
| Passwort ändern | 8 | 0,75 |
| Layout-Tests umbauen, E2E, Gegenproben | 4.5, 9 | 1,25 |
| Abnahme und Doku | 10, 11 | 0,75 |
| **Summe** | | **8,0** |

Grösstes Risiko für die Schätzung ist das Herauslösen von `PinFeld` und `useSperre` aus `PinEingabe`
(5.1/5.2): Es berührt eine abgenommene Ansicht. Deshalb zuerst umbauen und die bestehenden Tests grün
sehen, dann erst die neuen Ansichten bauen. Zweites Risiko ist der Platz auf der Namensauswahl (4.3).
