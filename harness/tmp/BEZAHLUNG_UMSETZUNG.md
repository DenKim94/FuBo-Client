# Bezahlstatus je Teilnahme (Umsetzungsanleitung Client)

> Stand: **08.11.2026**. Status: **wartet auf den Server-Vertrag** (`server/harness/tmp/BEZAHLUNG_UMSETZUNG.md`). Die
> Paketnummer vergibt der Entwickler. Die Entscheidungen B1–B10 stehen dort in Abschnitt 1 und sind vom Entwickler
> bestätigt; hier stehen nur die clientseitigen Folgen. **Vor Beginn:** Kontrakt-Kopie gegen den tatsächlich
> gelieferten Vertrag prüfen – Feld- und Pfadnamen unten sind der Vorschlag, nicht der Stand.
>
> Massgeblich: `client/harness/AGENT_CLIENT.md`, `CONTEXT_HANDOFF_CLIENT.md`, `/PRJ_FuBo/harness/assets/Design/DESIGN.md`
> (die neue Box ist dort nachzutragen).

---

## 0. Ziel und Abgrenzung

Wer zugesagt hat und nicht wartet, sieht zu jedem geplanten und abgeschlossenen Termin eine Box mit seinem Bezahlstatus
und kann ihn selbst setzen und zurücksetzen. Der Admin sieht in der Einzelansicht eines Termins „Bereits bezahlt (n)“
über den Zusagen und korrigiert den Status. Betrag und bis zu drei Zahlungslinks pflegt er in der Konfiguration.

**Nicht dazu:** Zahlungsabwicklung, Nachweise, Push-Erinnerungen, eine eigene Liste offener Zahlungen auf dem
Dashboard. Die Anwendung verlinkt nur nach außen.

## 1. Wo die Box erscheint

| Ansicht | Termin | Komponente |
|---|---|---|
| Dashboard „Nächster Termin“, Termin-Ansicht `/termine/:id` | `GEPLANT` | `TerminAnsicht`, direkt **unter dem Kopfbereich** (`termin-kopf`), über „Teilnehmer“ |
| Ergebnisse (letzter Termin) und Verlauf → `/ergebnisse/:id` | `ABGESCHLOSSEN` | `ErgebnisSeite`, unter der `TerminKarte`, über der Einteilung |

- **Befund 08.11.2026:** Der Verlauf verlinkt vergangene Termine auf `/ergebnisse/:id` (`VerlaufListe`), nicht auf
  `/termine/:id`. Ohne die Box auf der Ergebnisseite wäre ein abgeschlossener Termin nur über eine direkt eingegebene
  Adresse erreichbar. Nach dem Spiel ist die Ergebnisseite ohnehin der Ort, den Mitspielende öffnen.
- **Bedingung überall:** `termin.eigeneBezahlung !== null`. Der Server entscheidet die Zahlungspflicht (zugesagt, nicht
  wartend, Termin nicht abgesagt, nicht Admin); der Client rechnet sie **nicht** nach.
- Admin-Dashboard und Admin-Termin zeigen die Box nie (`nurLesen`; der Server liefert für den Admin ohnehin `null`).

## 2. Die Komponente `BezahlBox`

### 2.1 Zustände und Texte

**Nicht bezahlt** (Fläche `--farbe-fehler-flaeche`, Randstreifen `--farbe-fehler`, Symbol „Hinweis“):

```
┌──────────────────────────────────────────────────┐
│ ! Du hast für diesen Termin noch nicht bezahlt.  │
│                                     [Bezahlen ⌄] │
│ ──────────────────────────────────────────────── │  ← aufgeklappt
│ Die Teilnahme kostet 7,00 € pro Person.          │
│ Du kannst so bezahlen (öffnet eine externe Seite):│
│   PayPal ↗                                       │
│   WERO ↗                                         │
│ [            Ich habe bezahlt            ]       │
└──────────────────────────────────────────────────┘
```

**Bezahlt** (Fläche `--farbe-primaer-flaeche`, Randstreifen `--farbe-erfolg`, Symbol „Haken“):

```
┌──────────────────────────────────────────────────┐
│ ✓ Du hast für diesen Termin bezahlt.   [Ändern ⌄]│
│ ──────────────────────────────────────────────── │  ← aufgeklappt
│ Versehentlich angegeben? Dann setze es zurück.   │
│ [          Doch nicht bezahlt          ]         │
└──────────────────────────────────────────────────┘
```

- „Bezahlen“ bzw. „Ändern“ ist ein **Umschalter** (`aria-expanded`, `aria-controls`, Inhalt mit `hidden` im Baum) –
  Muster wie `Teamstaerken`. Beschriftung „Bezahlen“ in Rot, „Ändern“ in Grün (Antwort 8 des Entwicklers).
- **Die Aussage hängt nie an der Farbe:** Symbol und Satz tragen sie; Rot und Grün wiederholen nur.
- **Kein `role="status"`** (anders als `Hinweis`): Die Box ist dauerhaft, ein Screenreader soll sie nicht bei jedem
  Abruf vorlesen. Nach einer Änderung geht der Fokus auf den Satz der Box (`tabIndex={-1}`), damit der neue Zustand
  angesagt wird.
- Betrag aus `betragCent` mit `Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`; bei abgeschlossenen
  Terminen ist es der festgehaltene Betrag (Server).
- **Die Texte „Doch nicht bezahlt“ und „Versehentlich angegeben? …“ sind Vorschläge** – vor der Umsetzung mit dem
  Entwickler abstimmen.

### 2.2 Externe Links

```tsx
<a href={option.url} target="_blank" rel="noopener noreferrer" className={style.link}>
  {option.bezeichnung}
  <span className={style.extern} aria-hidden="true" />
  <span className="sr-only"> (öffnet eine externe Seite)</span>
</a>
```

- Nur Links mit `https:` anzeigen (`new URL(url).protocol === 'https:'`), auch wenn der Server prüft: Ein Link aus
  einer Antwort ist Daten, kein Vertrauen.
- `Textlink` ist für interne Ziele (React Router) und bleibt dafür; der externe Link ist ein eigenes Element mit
  Tap-Ziel ≥ 44 px.
- Keine Optionen geladen (Fehler oder leer): Satz „Die Zahlungswege nennt dir der Admin.“ statt einer leeren Liste;
  „Ich habe bezahlt“ bleibt bedienbar.

### 2.3 Daten und Hooks

| Hook | Art | Einzelheiten |
|---|---|---|
| `useZahlungsoptionen()` | `useQuery` | `GET /bezahlung/optionen/lesen`, eigener Schlüssel `schluessel.zahlungsoptionen`, `staleTime` 5 min, kein Polling, `X-FuBo-Kein-Refresh` nicht nötig (Abruf nur beim Öffnen der Box: `enabled: offen`) |
| `useBezahlungMelden(terminId)` | `useMutation` | `POST /termine/bezahlung/melden`, danach Termin, Terminliste und Verlauf neu lesen (wie `useRueckmeldung`); `409 KEINE_ZAHLUNGSPFLICHT` → Termin neu lesen und Box ausblenden lassen (jemand ist z. B. auf die Warteschlange gerutscht), keine Fehlermeldung |

- Während der Mutation: Schaltfläche `laedt`, Doppelklick sperren. Fehler über `Fehlermeldung` in der Box.
- **Optimistisches Umschalten nicht** – der Server ist die Wahrheit, die Rückmeldung kommt in unter einer Sekunde.

## 3. Admin: „Bereits bezahlt“ und Korrektur (nur Admin-Termin `/admin/termine/:id`)

```
┌ Bereits bezahlt (3)                          ⌄ ┐
│ Denis                          [Zurücksetzen]  │
│ Beispielgast 1 (Gast)          [Zurücksetzen]  │
┌ Teilnehmer (5)                               ⌄ ┐
│ 1  Denis                             bezahlt   │
│ 4  Tim                        [Als bezahlt]    │
┌ Absagen (2)                                  ⌄ ┐
```

- Neue Komponente `Bezahltliste` im Muster `Absagenliste` (`_klappliste.scss`), **über** der `Teilnehmerliste`;
  Einträge = `teilnehmer.filter((e) => e.bezahlt === true)`, alphabetisch; leer: „Bisher hat niemand bezahlt.“
- `TerminAnsicht` bekommt die Eigenschaft `bezahlVerwaltung` (nur `AdminTerminDetail` setzt sie). Das Admin-Dashboard
  zeigt die Liste **nicht** (Vorgabe: Einzelansicht).
- In der `Teilnehmerliste` (nur mit `bezahlVerwaltung`): Mitspielende tragen „bezahlt“ als Text oder die Aktion
  „Als bezahlt“; **Wartende tragen nichts** (keine Zahlungspflicht).
- `useBezahlungSetzen()` → `POST /admin/teilnahme/bezahlung` mit `{ terminId, anzeigeName, gast, bezahlt }`; danach
  Termin neu lesen (`termineNeuLesen`). Keine Rückfrage: Jede Aktion ist mit einem Klick umkehrbar.
- Die Admin-Ansicht liest ohne Polling (`ohneAktualisierung`); eine Selbstmeldung eines Spielers erscheint beim nächsten
  Öffnen oder nach einer eigenen Aktion. Das genügt (keine Echtzeitanforderung).

## 4. Konfiguration

- `KonfigurationFormular`: neuer Abschnitt „Bezahlung“ mit
  - **Betrag** als Textfeld in Euro (`7`, `7,5`, `7,50`), umgerechnet in Cent in `konfigurationEingabe.ts`; leer,
    negativ, mehr als zwei Nachkommastellen oder über 1000,00 € → Feldfehler vor dem Senden.
  - **Zahlungsoptionen**: 1 bis 3 Zeilen mit „Bezeichnung“ und „Link“, „Option hinzufügen“ (ab drei gesperrt, mit Grund)
    und „Entfernen“ (bei einer Zeile gesperrt). Link nur `https://`; Fehler je Feld; doppelte Bezeichnung → Fehler.
- **Voll-Update:** Die beiden Felder gehören in die Anfrage (`KONFIGURATION_PFLICHTFELDER` in den Mocks, Formular,
  Tests). Server und Client werden gemeinsam ausgeliefert.

## 5. Vertrag nachziehen

1. Kontrakt-Kopie byteweise übernehmen, `npm run api:typen`.
2. Typen exportieren: `Zahlungsoption`, Felder `eigeneBezahlung`, `betragCent`, `TeilnehmerEintrag.bezahlt` (optional).
3. Nachbildungen (`src/test/mocks/termine.ts`, `admin.ts`, `e2e/hilfen/termine.ts`, `admin.ts`):
   - Modellfeld `bezahlt` je Zusage; `eigeneBezahlung` wie am Server ableiten (zugesagt, nicht wartend, nicht abgesagt,
     nicht Admin), `bezahlt` nur in der Admin-Antwort.
   - Melden und Admin-Korrektur nachbilden, inklusive `409 KEINE_ZAHLUNGSPFLICHT`; Absage setzt `bezahlt` zurück.
   - **`teilnehmerVersion` bei Meldungen nicht erhöhen** (sonst prüfen die Tests ein Verhalten, das der Server nicht hat,
     und „veraltet“ käme ins Spiel).
4. Testfabriken mit `TerminUebersicht`-Literalen ergänzen (wie am 06.11.2026 `absagen`: `terminZeit.test.ts`,
   `AdminTerminZeile.test.tsx`).

## 6. Tests

**Unit:**
- `BezahlBox`: beide Zustände (Text, Symbol, Farbe als Klasse), Umschalter, Links nur `https`, Betrag formatiert, Leerfall
  der Optionen, Fokus nach Änderung, Fehler, Laden.
- Ansichten: Box nur bei `eigeneBezahlung !== null`; nicht für Admin; Dashboard, Termin-Ansicht und Ergebnisseite.
- `Bezahltliste` und Teilnehmerzeilen im Admin-Modus: „bezahlt“, „Als bezahlt“, nichts bei Wartenden.
- Konfiguration: Betragseingabe (Komma, Punkt, Grenzen), Optionen hinzufügen/entfernen/prüfen, Voll-Update enthält
  beide Felder.
- `einteilungVeraltet`: eine Bezahlmeldung ändert nichts (Absicherung gegen den Fehler vom 07.11.2026).

**E2E** (alle drei Chromium-Projekte, 360 × 780, hell und dunkel):
- Spieler: rot → „Bezahlen“ → Links sichtbar, extern (`target`, `rel`) → „Ich habe bezahlt“ → grün → „Ändern“ →
  „Doch nicht bezahlt“ → rot.
- Gast: dieselbe Abfolge.
- Abgeschlossener Termin über Verlauf → Ergebnisseite mit Box.
- Admin: Liste „Bereits bezahlt“ über „Teilnehmer“, „Als bezahlt“ und „Zurücksetzen“; Admin-Dashboard ohne Liste.
- Konfiguration: Betrag und drei Optionen speichern; vierte Option gesperrt; `http://` abgelehnt.
- Layout: Box ohne seitlichen Überhang, Tap-Ziele ≥ 44 px, Links und Schaltflächen im Sichtfeld.

**Gegenproben** (vor jeder einen Zwischen-Commit in der Cloud-Kopie, siehe Fallstrick 06.11.2026): Box ohne Bedingung,
Link ohne `rel`, `http`-Link angezeigt, Liste auch auf dem Admin-Dashboard, Meldung erhöht `teilnehmerVersion`.

## 7. Stufen und Aufwand (Schätzung)

| Stufe | Inhalt | Stunden |
|---|---|---|
| 1 | Vertrag, Typen, Nachbildungen, Testfabriken | 2,0 |
| 2 | `BezahlBox`, Hooks, Einbau in `TerminAnsicht` und `ErgebnisSeite` | 4,0 |
| 3 | Admin: `Bezahltliste`, Aktionen in der Teilnehmerliste | 3,0 |
| 4 | Konfiguration: Betrag und Optionen | 3,0 |
| 5 | E2E, Sichtprüfung, Gegenproben, Harness | 3,0 |
| | **Summe** | **15,0** |

## 8. Offene Punkte

1. Texte der grünen Box („Versehentlich angegeben? …“, „Doch nicht bezahlt“) bestätigen.
2. DESIGN.md: neue Ansicht „Bezahlstatus“ und Abschnitt in der Konfiguration nachtragen.
3. Feld- und Pfadnamen nach dem gelieferten Server-Vertrag angleichen.
