# C5 – User-Dashboard: Termine, Teams, Ergebnisse und Verlauf (Umsetzungsanleitung)

> Arbeitspaket **C5** (geschätzt **31,5 h**, vorher 14 h; Umsetzung in vier Stufen, siehe 15). Massgeblich:
> `/PRJ_FuBo/harness/AGENT.md` (A7, A8, A10, A11, A18, A20, A21), `client/harness/AGENT_CLIENT.md`,
> `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Ansichten 3 bis 8, Abschnitt „Besonderheit: Teams generieren“),
> Vertrag `client/harness/assets/fubo-api.json` (45 Operationen, Stand 17.10.2026).
> Referenz: `FuBo_Design_Prototypen.html`, Screens 04, 04b, 04c, 05, 06, 06b, 07, 07b, 12 – Abweichungen zulässig (Abschnitt 1.3).
>
> **Fassung vom 17.10.2026, überarbeitet nach der Ergänzung 1.5** (Tabs, Teams, Ergebnisse, Verlauf), Stand
> Commit `c5e43f4` auf `dev_client` (C4 committet). E1–E10 sind bestätigt (soweit in 1.2 vermerkt); die
> **neuen Entscheidungen E11–E19 sind Vorschläge** und vor Beginn der jeweiligen Stufe vom Entwickler zu
> bestätigen oder zu ändern; abweichende Antworten ändern nur die jeweils genannten Abschnitte.
> Das frühere Arbeitspaket **C6** (Teams und Ergebnis, 12 h) geht in C5 auf (Meilensteinplan: 13).

---

## 0. Ziel und Abgrenzung

Nach C5 hat jede angemeldete Person (USER, GAST) ein **Dashboard mit vier Tabs**. Auf dem Tab „Termine“ sieht
sie den nächsten Termin mit Ort und Zeit, ihren eigenen Zusagestatus (dreiwertig), die Zusagen gegen die
Mindestanzahl und die Teilnehmerliste samt Warteschlange, und sie kann mit einem Tipp zu- oder absagen. Die
übrigen Tabs zeigen die Teameinteilung (mit Generierung), erfassen und zeigen das Ergebnis samt eigener
Bilanz und listen die vergangenen Termine.

| Tab | Routen | Inhalt | Endpunkte |
|---|---|---|---|
| Termine | `/`, Detail `termine/:terminId` | nächster Termin, Zu-/Absage, Teilnehmerliste, weitere Termine | `GET /termine/lesen`, `GET /termine/{terminId}/lesen`, `POST /termine/rueckmeldung` |
| Teams | `/teams`, Detail `teams/:terminId` | Einteilung des nächsten Termins, Auswechselspieler, „veraltet“, Generieren | `GET /termine/{terminId}/lesen` (Feld `teams`), `POST /teams/generieren` |
| Ergebnisse | `/ergebnisse`, Detail `ergebnisse/:terminId` | Ergebnis des zuletzt abgeschlossenen Termins (erfassen oder anzeigen), eigene Bilanz | `GET /termine/{terminId}/lesen` (Feld `ergebnis`), `POST /ergebnis/erfassen`, `GET /bilanz/lesen` |
| Verlauf | `/verlauf` | vergangene Termine, Zugang zu ihrem Ergebnis | `GET /termine/lesen?ab=…` |

Alle genannten Endpunkte verlangen `PROFILE_AUTHENTICATED` und stehen auch dem GAST offen (A12/A15); die
Rückmeldung ist für ADMIN gesperrt (`409 PROFIL_GESCHUETZT`).

**Nicht Teil von C5:**

- Admin-Oberflächen: Ergebnis korrigieren (`POST /admin/ergebnis/korrigieren`), manuelle Teamgenerierung,
  Termine anlegen, ändern, absagen, entfernen, Serien, Hallenabsage, Skill-Stufe eines Gastes → **C7**. Von
  der Korrektur entsteht in C5 nur die **API-Funktion** samt Test (3.4), keine Maske (E18).
- Der **Admin sieht diese Tabs nicht** (E7): Die Tab-Routen leiten ihn nach `/admin` um (9.2).
- Einstellungen, Push, Installationshinweis → **C8**.
- Keine neuen Abhängigkeiten.

---

## 1. Vorab: Befunde und Entscheidungen

### 1.1 Befunde aus dem Vertrag

1. **Die Mindest- und Höchstzahl steht nur in `TerminDetails.teilnehmerliste`**, nicht in der Liste und
   nicht in `/admin/config/lesen` (Adminendpunkt). Der Fortschrittsbalken (A10) braucht `minTeilnehmer`;
   das Dashboard braucht deshalb **zwei** Abrufe: Liste, dann Einzeltermin des nächsten Termins. Ein
   dritter Abruf (Konfiguration) entfällt.
2. **Absagen erscheinen nirgends.** Die Teilnehmerliste enthält nur Zusagen; „3 Absagen“ aus dem
   Prototyp lässt sich nicht anzeigen (1.3).
3. **`eigeneRueckmeldung` ist dreiwertig** (`true`, `false`, `null`). Ein `if (eigeneRueckmeldung)`
   behandelt „noch nicht gemeldet“ wie eine Absage – das ist der häufigste Fall und der Kern von A7.
4. **Die Warteschlange ist ein Kennzeichen, keine zweite Liste.** `teilnehmer[]` ist bereits in
   Meldereihenfolge sortiert, `wartet` markiert die Einträge ab `maxTeilnehmer + 1`.
   **Nicht umsortieren, nicht in zwei Listen zerlegen.**
5. **`mindestzahlErreicht` kommt vom Server** und zählt **alle** Zusagen, auch die wartenden. Der Client
   rechnet nicht nach (`Fortschrittsbalken` verlangt `erreicht` ausdrücklich als Eingabe).
6. **Rückmeldung bis Terminbeginn und nur bei `GEPLANT`.** Zwischen Beginn und `ABGESCHLOSSEN` liegen
   30 bis 35 Minuten, in denen der Status noch `GEPLANT` ist und trotzdem `409 TERMIN_GESCHLOSSEN`
   kommt. Der Status allein genügt also nicht, um die Aktionen anzubieten.
7. **`204` ohne Rumpf:** Die Antwort enthält keine neue Liste. Wer sie anzeigen will, liest neu
   (`invalidateQueries`); der Rückgabewert ist keine Wahrheit.
8. **Eine erneute Zusage stellt hinten an** (`gemeldet_am` wird bei jeder Zusage neu gesetzt). Der
   Vertrag sagt zugleich, eine Absage lasse die Zeit unberührt, „wer versehentlich absagt und sofort
   korrigiert, verliert seinen Platz nicht“. Beides zusammen ist nicht eindeutig lesbar (Zusage nach
   Absage ist ebenfalls eine Zusage). **Verhalten in der Handprüfung am echten Server klären (12, Nr. 4)**,
   erst danach den Hinweistext zur Warteschlange festschreiben (E5).
9. **Abgesagte Termine bleiben in der Liste** (`status = ABGESAGT`), vergangene fehlen (`ab` = heute).
   `ab` sendet nur der Tab „Verlauf“ (E14); Dashboard und Polling lassen es weg.
10. **`uhrzeit` ist `HH:MM:SS` in Ortszeit ohne Zone**, `datum` `YYYY-MM-DD`. Der Vertrag setzt Client
    und Server in dieselbe Zeitzone (`Europe/Berlin`).
11. **Termine entstehen im Client erst mit C7.** Für die Handprüfung müssen sie am Server angelegt
    werden (Abnahme 12, Nr. 3).
12. **Teams und Ergebnis reisen im Einzeltermin.** `TerminDetails.teams` und `.ergebnis` sind im
    Normalzustand `null` („noch nicht generiert“, „noch nicht erfasst“) – kein Fehler und nicht dasselbe
    wie „leer“. Eigene Lese-Endpunkte gibt es nicht. `POST /teams/generieren` liefert die neue
    `Teameinteilung`, `POST /ergebnis/erfassen` das `Ergebnis` (je `201` mit Körper); die Wahrheit bleibt
    der Einzeltermin (E4 gilt auch hier).
13. **Kein Feld für das verbleibende Generierungskontingent.** DESIGN.md („Besonderheit: Teams
    generieren“) verlangt „noch 1 von 2 Generierungen“ und eine deaktivierte Aktion samt Grund. Die Zahl
    `anzTeamGenerator` liefert nur `/admin/config/lesen`. Der Client erfährt die Erschöpfung erst aus
    `409 KONTINGENT_ERSCHOEPFT` (E15, 1.4). Das Kontingent gilt **je Nutzer, je Termin und je
    `teilnehmerVersion`**; sie steht im Detail (`TerminDetails` erweitert `TerminUebersicht`).
14. **Ergebnis erfassen setzt voraus:** Status `ABGESCHLOSSEN` (30 bis 35 Minuten nach Beginn) **und** eine
    Einteilung. Der erste Eintrag gilt, ein Löschen gibt es nicht, korrigieren darf nur der Admin. GAST darf
    erfassen. `deutlich` ist bei `sieger = U` auf `true` unzulässig (`400 deutlichNurBeiSieg`): der Client
    sendet dann immer `false`.
15. **`ab` ist eine untere Grenze ohne Obergrenze und ohne Limit.** Wer vergangene Termine will, bekommt auch
    alle künftigen. Der Verlauf filtert im Client (E14).
16. **`TeamEintrag` trägt genau drei Felder** (`anzeigeName`, `gast`, `auswechselspieler`): keine Skillwerte,
    keine Gast-Stufe, keine Teamstärke. Die Reihenfolge in `teamA`/`teamB` ist **keine** Rangfolge – anders
    als bei der Teilnehmerliste (1.1 Nr. 4).
17. **Die Einteilung ist ab Terminbeginn fix.** Der Server setzt `TEAMS_FIXIERT` spätestens fünf Minuten nach
    Anpfiff; bis dahin kann ein Lauf noch gelingen. Der Client bietet die Aktion ab Beginn nicht mehr an
    (E8) und behandelt `409 TEAMS_FIXIERT` trotzdem.
18. **Die Bilanz zählt den Auswechselspieler in allen drei Zählern.** Für GAST ist das Verhalten von
    `GET /bilanz/lesen` nicht beschrieben (1.4).

### 1.2 Entscheidungen (Vorschläge vom 17.10.2026)

| # | Frage | Vorschlag | Begründung |
|---|---|---|---|
| E1 | Wie viele Ansichten? | **Zwei Routen, ein Baustein.** `/` zeigt den nächsten geplanten Termin, `termine/:terminId` denselben Baustein (`TerminAnsicht`) für einen gewählten Termin. Das Dashboard ergänzt die Liste weiterer Termine. (Bestätigt durch Haupt-Entwickler) | Die Route `termine/:terminId` steht schon im Baum (Platzhalter C5). Ein Baustein vermeidet zwei Fassungen derselben Logik. |
| E2 | Welcher Termin ist der „nächste“? | **Der erste Termin der Liste mit `status = GEPLANT`.** Liegt davor ein `ABGESAGT`, steht darüber ein Hinweis („Der Termin am Di, 29. Juli fällt aus.“). `ABGESCHLOSSEN` zählt nicht. Gibt es keinen, zeigt das Dashboard einen Leerzustand. (Bestätigt durch Haupt-Entwickler) | Der Vertrag lässt abgesagte Termine ausdrücklich in der Liste, damit niemand ins Leere läuft. Ein begonnener, noch `GEPLANT`er Termin bleibt bis zum Statuswechsel der „nächste“ (30–35 min). |
| E3 | Eigene Ansicht für Zu-/Absage (Prototyp 05)? | **Nein.** Die Aktionsleiste sitzt unten auf der Termin-Ansicht. (Bestätigt durch Haupt-Entwickler) | DESIGN.md: wenige Schritte, primäre Aktion in Daumenreichweite. Eine Zwischenseite kostet einen Tipp bei der häufigsten Aktion. |
| E4 | Optimistische Aktualisierung? | **Nein.** Schaltfläche zeigt `laedt`, nach `204` werden Liste und Einzeltermin neu gelesen. (Bestätigt durch Haupt-Entwickler) | Position und Warteschlange hängen am Server; eine vorweggenommene Anzeige könnte „zugesagt, Platz 3“ zeigen, wo der Server „wartet“ meldet. |
| E5 | Welche Aktionen je Zustand? | `null`: **„Ich kann nicht“** (sekundär) und **„Ich bin dabei“** (primär). `true`: Status plus **„Absagen“** (sekundär). `false`: Status plus **„Doch zusagen“** (primär). Beim Wechsel `false → true` ein Hinweis zur Reihenfolge, **Wortlaut nach Handprüfung (1.1 Nr. 8)**. Keine Rückfrage vor der Absage. (Bestätigt durch Haupt-Entwickler) | Zwei Aktionen nur, wenn nichts gemeldet ist. Eine Absage ist umkehrbar; die Rückfrage kostet mehr, als sie schützt. |
| E6 | Aktualisierung während die Ansicht offen ist? | **Polling alle 20 s** für Liste und Einzeltermin, jeder Lesezugriff mit `X-FuBo-Kein-Refresh: true`. (Bestätigt durch Haupt-Entwickler) | Zusagen und Nachrücken anderer sollen ohne Neuladen erscheinen. Weniger dringend als der Namenskonflikt (5 s), die Antworten sind klein. Das Polling hält die Sitzung nicht offen; als Aktivität zählen weiter Navigation (`useSitzung`) und die Rückmeldung selbst. |
| E7 | Admin auf `/`? | **nein** | Adminanzeige hat in diesem Arbeitspaket nichts zu suchen. Terminanzeigen für den Admin sind im Admindashboard (C7); Angemeldet sind ohnehin entweder User oder Gast. **Umsetzung:** `DashboardLayout` leitet ADMIN von den Tab-Routen nach `/admin` um (9.2); keine Admin-Zweige in den Seiten. Zu klären: `zielpfad.ts` nennt das User-Dashboard für den Admin „erreichbar (A9)“ (1.4). |
| E8 | „Termin hat begonnen“ | **Aus der Geräteuhr abgeleitet, nur Darstellung.** Ab Beginn verschwindet die Aktionsleiste und ein Satz sagt „Der Termin hat begonnen. Rückmeldungen sind nicht mehr möglich.“. Der Server entscheidet weiter (`409`). | Wie beim Ablauf-Dialog: Die Uhr ordnet die Anzeige, nicht die Berechtigung. |
| E9 | Teilnehmerliste auf dem Dashboard | **Eingeklappt** (`<details>`, Summary „Teilnehmer (14)“), auf `termine/:terminId` **offen**. (Bestätigt durch Haupt-Entwickler) | 15–22 Zeilen schieben die Aktionen und weitere Termine weit nach unten; der Balken trägt die Kernaussage. |
| E10 | Eigener Eintrag in der Liste | **Markiert mit „(du)“**, gefunden über `anzeigeName` und `gast` gegen die Sitzung. (Bestätigt durch Haupt-Entwickler) | Hilft beim Auffinden der eigenen Position; schlägt der Abgleich fehl, fehlt nur die Marke. |
| E11 | Form und Platz der Menüleiste? | **`<nav>` mit vier Links** (`NavLink`, `aria-current`), **oben** unter der Kopfzeile, Text statt Symbolen. Kein ARIA-Tab-Muster. DESIGN.md beschreibt keine Tab-Leiste; die Gestaltung folgt dem Prototyp 12 und den Tokens (1.3). | Jede Ansicht ist eine eigene Route (Lesezeichen, Zurück-Taste, Push-Link in C8). Unten sitzt die `Aktionsleiste` mit der Primäraktion; zwei Leisten übereinander verkleinern die Daumenzone. |
| E12 | Welche Routen tragen die Leiste? | **Nur die vier Hubs** (`/`, `/teams`, `/ergebnisse`, `/verlauf`). Detailrouten (`termine/:terminId`, `teams/:terminId`, `ergebnisse/:terminId`) ohne Leiste, mit „Zurück“. | Vermeidet die Frage, welcher Tab bei einem Termin aus dem Verlauf aktiv ist, und hält die Leiste ein Navigationsmittel statt einer Daueranzeige. |
| E13 | Auf welchen Termin beziehen sich die Tabs? | **Teams:** nächster geplanter Termin (E2). **Ergebnisse:** zuletzt `ABGESCHLOSSEN`er Termin. **Verlauf:** alle vergangenen Termine, Zeile → `ergebnisse/:terminId`. Ohne Treffer ein Leerzustand mit Grund. | Teams entstehen vor, Ergebnisse nach dem Spiel; ältere Ergebnisse sind über den Verlauf erreichbar, ohne den Tab zu überladen. |
| E14 | Wie weit reicht der Verlauf? | **60 Tage** (Default; Konstante `VERLAUF_TAGE`): `GET /termine/lesen?ab=<heute − 60 Tage>`, im Client auf vergangene Termine gefiltert, neueste zuerst, **ohne** Polling und ohne „Mehr laden“. | Der Vertrag hat weder Obergrenze noch Limit (1.1 Nr. 15); ein festes Fenster hält die Antwort klein. Ein „Mehr laden“ braucht ein `bis` oder einen Limit-Parameter am Server (1.4). |
| E15 | Kontingent der Teamgenerierung anzeigen („noch 1 von 2“)? | **Nicht in C5 anzeigbar**, weil der Server die Zahl nicht liefert (1.1 Nr. 13). Umsetzung: Aktion bleibt bedienbar; nach `409 KONTINGENT_ERSCHOEPFT` ist sie bis zur nächsten Änderung von `teilnehmerVersion` gesperrt, mit Grund und Hinweis „Eine Änderung der Teilnehmerliste setzt das Kontingent zurück.“. Die Anzeige „noch x von y“ ist als optionale Eingabe vorbereitet (10.2). | DESIGN.md verlangt die Anzeige, die Konfiguration (`anzTeamGenerator`) liest nur der Admin. Eine Anfrage an den Server (Feld im Detail) löst das sauber; bis dahin keine geratenen Zahlen. |
| E16 | Rückfrage vor „Teams neu generieren“? | **Nur, wenn die vorhandene Einteilung nicht `veraltet` ist.** Dann Bestätigungsdialog: „Die aktuelle Einteilung von {erzeugtVon} wird ersetzt.“ Ist sie veraltet oder gibt es keine, ohne Rückfrage. | Ein Lauf löst den bisherigen ab und verbraucht Kontingent; ersetzt wird eine Einteilung nur ungern, solange sie noch stimmt. |
| E17 | Ergebnis erfassen: wie vorsichtig? | **Formular, dauerhafter Hinweis „Der erste Eintrag gilt“ und Bestätigungsdialog** vor dem Senden. `409 ERGEBNIS_VORHANDEN` ist **kein Fehler**, sondern ein Hinweis („Jemand war schneller.“) und zeigt danach das vorhandene Ergebnis. | Vertrag: Ein Ergebnis lässt sich nicht löschen; DESIGN.md Ansicht 7 verlangt den Hinweis. Mehrere tippen nach dem Abpfiff gleichzeitig. |
| E18 | „Bearbeitung der Ergebnisse“ (1.5): was gehört zu C5? | **Erfassen (alle) in C5.** Die **Korrektur** ist Adminsache: in C5 nur die API-Funktion `ergebnisKorrigieren` mit Unit-Test, die Maske folgt mit C7. | `POST /admin/ergebnis/korrigieren` verlangt ADMIN, und der Admin sieht diese Tabs nicht (E7). |
| E19 | Eigene Bilanz | **Karte oben im Tab „Ergebnisse“**, nicht für GAST (Gäste führen keine Bilanz). | DESIGN.md Ansicht 8: „sinnvoll auf dem User-Dashboard oder als eigene Ansicht“; der Vertrag beschreibt die Bilanz für „den angemeldeten Spieler“. |

Die Zeilen E11 bis E19 sind neu (Ergänzung 1.5) und **durch den Haupt-Entwickler bestätigt**.

### 1.3 Abweichungen von DESIGN.md und Prototyp (verbindlich ist der Vertrag)

| Vorgabe | Umsetzung | Grund |
|---|---|---|
| Prototyp 04/12: „14 Zusagen · 3 Absagen“ | Nur Zusagen. | Absagen liefert der Server nicht (1.1 Nr. 2). |
| Prototyp 05: „Änderung bis 17:00 möglich“ | „Rückmeldung bis zum Beginn um 19:00 Uhr möglich.“ | Der Server schliesst zum Terminbeginn (1.1 Nr. 6), nicht zwei Stunden vorher. |
| Prototyp 05: eigener Screen für Zu-/Absage | Aktionsleiste auf der Termin-Ansicht (E3). | Siehe E3. |
| Prototyp 04/12: „Jonas, Lukas, Marco und 11 weitere ›“ | Eingeklappte Liste mit Anzahl (E9). | Kürzel-Zusammenfassungen verdecken die Reihenfolge, die der Vertrag als Information führt. |
| Prototyp 04b: „Letzte Termine“ auf dem Dashboard | Eigener Tab „Verlauf“ (E13, E14). | Ergänzung 1.5. |
| DESIGN.md Screen 5: Warteschlange als **eine** Liste | Umgesetzt wie verlangt; wartende Einträge tragen den Text „wartet · Platz n“. | Die Aussage darf nicht an der Farbe hängen. |
| DESIGN.md: Tab-Leiste (1.5 verlangt sie „gemäß `DESIGN.md`“) | Vier Links nach E11/E12. | DESIGN.md beschreibt Ansichten (3 bis 8), keine Tab-Leiste; Inhalte der Tabs: Termine = 3, 4, 5; Teams = 6; Ergebnisse = 7, 8; Verlauf = vergangene Termine (A9) ohne eigene Ansicht in DESIGN.md. |
| Prototyp: Bereich heisst „Ergebnis“ | Tab „Ergebnisse“ (Wortlaut 1.5). | Vorgabe des Entwicklers. |
| DESIGN.md „Teams generieren“: Anzeige „noch 1 von 2“ | Nicht in C5 (E15). | Kein Vertragsfeld (1.1 Nr. 13). |
| DESIGN.md Ansicht 7: Hinweis „erster Eintrag gilt“ vor dem Absenden | Dauerhafter Hinweis **und** Bestätigungsdialog (E17). | Der Vertrag nennt die Endgültigkeit ausdrücklich als Fall für die Bestätigungsabfrage. |

### 1.4 Offen für Server und Handprüfung

- Reihenfolge nach Absage und erneuter Zusage (1.1 Nr. 8).
- Der Vertrag liefert die Gast-Skill-Stufe nirgends in der Teilnehmerliste – das ist gewollt (keine
  Skillwerte für USER/GAST) und braucht keine Anzeige.
- **Kontingent der Teamgenerierung** (1.1 Nr. 13): Anfrage an den Server, ein Feld in `TerminDetails` oder
  `Teameinteilung` aufzunehmen (z. B. verbleibende und erlaubte Läufe des Aufrufers für die aktuelle
  `teilnehmerVersion`). Bis dahin gilt E15; beim Einbau entfällt nur die Sperre nach `409`.
- **Bilanz für GAST:** Liefert `GET /bilanz/lesen` für einen Gast `200` mit Nullen, `403` oder Fehler?
  C5 zeigt die Karte für GAST nicht (E19); in der Handprüfung beobachten.
- **Historie ohne Obergrenze:** Für „Mehr laden“ im Verlauf fehlt `bis` oder ein Limit (E14).
- **A9 gegen E7:** `zielpfad.ts` nennt das User-Dashboard für den Admin „erreichbar (A9)“, E7 schliesst
  es aus. Vor Beginn von Stufe 1 klären, welche Aussage gilt (9.2).
- **Dauer der Handprüfung für Ergebnisse:** Ein Termin wird erst 30 bis 35 Minuten nach Beginn
  `ABGESCHLOSSEN`; die Testdaten sind nicht beliebig herstellbar (Abnahme 12, Nr. 6).

### 1.5 Ergänzungen
Die Menüleiste auf dem `User-Dashboard` soll gemäß `DESIGN.md` mit den Tabs `Termine`, `Teams`, `Ergebnisse` und `Verlauf` eingebaut werden.
Die API-Aufrufe zur Team-Generierung, Abruf und Bearbeitung der Ergebnisse sowie der Abruf vergangener Termine sollen ebenfalls eingebaut werden. Die entsprechenden UI-Elemente bzw. Pages sollen ebenfalls angelegt bzw. vorbereitet werden - auch wenn noch keine entsprechenden Test-Daten vorliegen.

**Umsetzung der Ergänzung in diesem Dokument:**

| Anforderung aus 1.5 | Umsetzung |
|---|---|
| Menüleiste mit `Termine`, `Teams`, `Ergebnisse`, `Verlauf` | 9.1 bis 9.3, E11, E12 |
| API: Team-Generierung | 3.4, 5, 10.2 (`POST /teams/generieren`) |
| API: Abruf der Ergebnisse | 3.4, 10.3 (Feld `ergebnis` des Einzeltermins, `GET /bilanz/lesen`) |
| API: Bearbeitung der Ergebnisse | 3.4, 10.3 (`POST /ergebnis/erfassen`); Korrektur nur als API-Funktion (E18) |
| API: Abruf vergangener Termine | 3.4, 4, 10.4 (`GET /termine/lesen?ab=…`) |
| UI-Elemente bzw. Pages, auch ohne Testdaten | 10; Normalzustände ohne Daten: 10.5 |

---

## 2. Was bereits steht und wiederverwendet wird

- **Route** `termine/:terminId` (Platzhalter, `handle: ZUM_DASHBOARD`) und Index-Route `/` (Platzhalter
  „Start“, `paket="C5"`) in `src/app/routen.tsx`; beide hinter `GeschuetzteRoute`.
- **Query-Schlüssel** `schluessel.termine` und `schluessel.termin(terminId: string)` existieren bereits
  (`src/api/common/schluessel.ts`); ein Präfix-Schlüssel für „alle Einzeltermine“ kommt dazu (3.3).
- **Basis-Komponenten:** `Fortschrittsbalken` (Eingaben `wert`, `ziel`, `erreicht`), `Aktionsleiste`
  (zwei Aktionen: die wichtigere zuletzt), `CustomButton` (`art`, `breit`, `laedt`), `Leerzustand`
  (`titel` und `text` Pflicht), `Fehlerzustand`/`Fehlermeldung`, `Hinweis` (`role="status"`),
  `Ladespinner`, `Icon`, `Textlink`.
- **Datenzugriff:** `aufrufen` mit `keinRefresh`; `fehlertextBilden`, `istWiederholbar`.
- **Sitzung:** `useSitzung()` liefert `istAdmin`, `istGast` und `sitzung.anzeigeName`.
- **Mocks:** `src/test/mocks/handlers.ts` hat einen Platzhalter-Handler für `POST */termine/rueckmeldung`
  (antwortet `409 TERMIN_GESCHLOSSEN`). Er wird ersetzt (3.2). `httpService.test.ts` ruft die Route nur
  als Beispiel für den Fehlerpfad auf und bleibt unberührt.
- **Layout:** `AppLayout` (Kopfzeile, Safe-Area, Flex-Spalte), `NichtGefunden`.
- **Weiteres für die neuen Tabs:** `Dialog` (Bestätigungen, 10.2/10.3), `Feld` (Formularbausteine),
  `Hinweis`, `Leerzustand`; `src/api/admin/admin.ts` kennt bisher nur `passwortAendern` (wird um
  `ergebnisKorrigieren` erweitert, 3.4). Query-Schlüssel `schluessel.bilanz` und `schluessel.teams(id)`
  existieren; Letzterer bleibt ungenutzt (die Einteilung reist in `termin(id)`) und wird entfernt, sofern
  `grep` keine Verwendung findet (3.5).

---

## 3. Datenzugriff und Mocks (Termine ca. 1 h; 3.4 bis 3.7 stufenweise)

### 3.1 API-Funktionen (`src/api/termine/termine.ts`, neu)

Domänenregel: `/termine/*` → `src/api/termine/termine.ts`.

```ts
export type TerminUebersicht = components['schemas']['TerminUebersicht']
export type TerminDetails = components['schemas']['TerminDetails']
export type Teilnehmerliste = components['schemas']['Teilnehmerliste']
export type TeilnehmerEintrag = components['schemas']['TeilnehmerEintrag']
export type TerminStatus = components['schemas']['TerminStatus']

/**
 * Ohne `ab`: Vorgabe des Servers ist heute (Ortszeit der Anwendung). Mit `ab` (`YYYY-MM-DD`) auch
 * vergangene Termine (Verlauf, 10.4); eine Obergrenze gibt es nicht (1.1 Nr. 15).
 */
export async function termineLesen(
  optionen: { ab?: string; keinRefresh?: boolean } = {},
): Promise<TerminUebersicht[]> {
  const pfad = optionen.ab ? `/termine/lesen?ab=${optionen.ab}` : '/termine/lesen'
  return aufrufen<TerminUebersicht[]>('GET', pfad, { keinRefresh: optionen.keinRefresh })
}

export async function terminLesen(terminId: number, keinRefresh = false): Promise<TerminDetails> {
  return aufrufen<TerminDetails>('GET', `/termine/${terminId}/lesen`, { keinRefresh })
}

/** `204`, kein Rumpf. Eine Bedienung: **ohne** `X-FuBo-Kein-Refresh`. */
export async function rueckmeldungSenden(terminId: number, zusage: boolean): Promise<void> {
  await aufrufen<void>('POST', '/termine/rueckmeldung', { body: { terminId, zusage } })
}
```

- JSDoc wie in `auth.ts`: Stufe, Fehlercodes (`TERMIN_GESCHLOSSEN`, `PROFIL_GESCHUETZT`,
  `INHALT_NICHT_GEFUNDEN`), Folge der Zusage (hinten anstellen).
- `terminId` im Pfad ist eine Zahl; die Prüfung der URL-Angabe steht in Abschnitt 9.
- Die Lesefunktionen tragen den Kopf **nur auf Wunsch** (`keinRefresh`), die Hooks setzen ihn (E6).
  Der Schalter heisst wie bei `namenslisteLesen`.

### 3.2 Mocks (`src/test/mocks/handlers.ts`)

- Beispieldaten **ohne reale Namen** (`Beispielspieler 1`, …), Datum im Jahr 2099:
  `beispielTermine` (ein `GEPLANT`, ein `ABGESAGT` davor, ein weiterer `GEPLANT`),
  `beispielTerminDetails` (`teilnehmerliste` mit Mindest 6, Höchst 22, `mindestzahlErreicht`,
  `teilnehmer[]` mit `wartet` und `gast`), Hilfsfunktion `terminDetailsMit({ ... })`.
- Standard-Handler: `GET */termine/lesen` → `beispielTermine`, `GET */termine/:terminId/lesen` →
  passendes Detail, `POST */termine/rueckmeldung` → `204` (ersetzt den `409`-Platzhalter).
- Fehlerfälle im Test per `mockServer.use(...)`.
- **Erfolg ist der Normalfall; ein Mock, der unabhängig von der Anfrage antwortet, zeigt keine
  Änderung.** Für die Hook- und Seitentests einen kleinen Zustand führen (Zu-/Absage ändert Liste und
  Detail), siehe 11.1.

### 3.3 Schlüssel (`schluessel.ts`)

```ts
termine: ['termine'] as const,
termin: (terminId: string) => ['termin', terminId] as const,
/** Präfix aller Einzeltermine, für `invalidateQueries` nach einer Rückmeldung. */
terminAlle: ['termin'] as const,
```

Schlüssel nur dort ändern; die Hooks importieren sie. Weitere Schlüssel: 3.5.

### 3.4 Weitere API-Funktionen (Stufen 2 bis 4)

Domänenregel: `/teams/*` → `src/api/teams/teams.ts`, `/ergebnis/*` → `src/api/ergebnis/ergebnis.ts`,
`/bilanz/*` → `src/api/bilanz/bilanz.ts`, `/admin/*` → `src/api/admin/admin.ts`. Typen aus dem Generat.

```ts
// src/api/teams/teams.ts
export type Teameinteilung = components['schemas']['Teameinteilung']
export type TeamEintrag = components['schemas']['TeamEintrag']

/** `201` mit Körper. Eine Bedienung: **ohne** `X-FuBo-Kein-Refresh`. */
export async function teamsGenerieren(terminId: number): Promise<Teameinteilung> {
  return aufrufen<Teameinteilung>('POST', '/teams/generieren', { body: { terminId } })
}

// src/api/ergebnis/ergebnis.ts
export type Ergebnis = components['schemas']['Ergebnis']
export type Sieger = components['schemas']['Sieger']   // 'A' | 'B' | 'U'

/** `201` mit Körper. Bei `U` geht `deutlich` immer als `false` hinaus (1.1 Nr. 14). */
export async function ergebnisErfassen(terminId: number, sieger: Sieger, deutlich: boolean): Promise<Ergebnis> {
  return aufrufen<Ergebnis>('POST', '/ergebnis/erfassen', {
    body: { terminId, sieger, deutlich: sieger === 'U' ? false : deutlich },
  })
}

// src/api/bilanz/bilanz.ts
export type Bilanz = components['schemas']['Bilanz']
export async function bilanzLesen(keinRefresh = false): Promise<Bilanz> {
  return aufrufen<Bilanz>('GET', '/bilanz/lesen', { keinRefresh })
}

// src/api/admin/admin.ts (erweitern) – nur Funktion, keine Maske (E18)
export type ErgebnisKorrektur = components['schemas']['ErgebnisKorrigierenRequest']
/** `204`. Voll-Update: `sieger`, `deutlich` und `version` sind Pflicht; veraltete `version` → `409 DATEN_VERALTET`. */
export async function ergebnisKorrigieren(anfrage: ErgebnisKorrektur): Promise<void> {
  await aufrufen<void>('POST', '/admin/ergebnis/korrigieren', { body: anfrage })
}
```

- JSDoc wie in `auth.ts`: Stufe, Fehlercodes (3.6), Folge des Aufrufs.
- `teamsGenerieren` und `ergebnisErfassen` sind Bedienungen und tragen **nicht** den Kopf `X-FuBo-Kein-Refresh`.
  `bilanzLesen` trägt ihn nur auf Wunsch; der Hook setzt ihn (5).
- Der Query `?ab=` steht im Pfad (`aufrufen` kennt keine Query-Optionen; ISO-Datum braucht kein Escaping).

### 3.5 Schlüssel (Ergänzung zu 3.3)

```ts
/** Verlaufsabruf (E14). Eigener Wurzelschlüssel: `invalidateQueries(termine)` trifft ihn nicht. */
termineVerlauf: ['termineVerlauf'] as const,
```

`schluessel.teams(id)` entfällt, wenn `grep -rn "schluessel.teams" src` nichts findet. Bilanz, Termin und
Verlauf werden nach dem Erfassen eines Ergebnisses gezielt invalidiert (5).

### 3.6 Fehlercodes der neuen Aufrufe

| Aufruf | Status / `code` | Verhalten im Client |
|---|---|---|
| `teamsGenerieren` | `409 TERMIN_GESCHLOSSEN` | Meldung (Server-`detail`), Einzeltermin neu lesen |
| | `409 TEAMS_FIXIERT` | Meldung, Aktion verschwindet (Termin hat begonnen), neu lesen |
| | `409 ZU_WENIG_TEILNEHMER` | Meldung mit Ist und Soll aus `detail`; die Aktion ist vorab gesperrt, wenn `mindestzahlErreicht = false` (Server-Wert, nicht nachrechnen) |
| | `409 SKILLWERTE_UNVOLLSTAENDIG` | Meldung (`detail` nennt Kategorien); für USER/GAST nicht behebbar, kein Wert wird angezeigt |
| | `409 KONTINGENT_ERSCHOEPFT` | Aktion sperren bis `teilnehmerVersion` wechselt (E15); **kein** `Retry-After`, kein Zeitablauf |
| | `409 TEILNEHMER_GEAENDERT` | wiederholbar: Meldung, Einzeltermin neu lesen, zweiter Tipp |
| | `404 INHALT_NICHT_GEFUNDEN` | Leerzustand mit Rückweg |
| `ergebnisErfassen` | `409 ERGEBNIS_VORHANDEN` | **Hinweis statt Fehler**, Einzeltermin neu lesen, vorhandenes Ergebnis anzeigen (E17) |
| | `409 TERMIN_NICHT_ABGESCHLOSSEN` | Meldung (`detail` nennt den Status); neu lesen |
| | `409 KEINE_EINTEILUNG` | Meldung; neu lesen (die Ansicht zeigt dann den Leerzustand) |
| | `400 EINGABE_UNGUELTIG` | durch die Oberfläche ausgeschlossen (`deutlich` bei `U`), nur als Meldung |
| | `404 INHALT_NICHT_GEFUNDEN` | Leerzustand mit Rückweg |
| `bilanzLesen` | `401` | Sitzungsende nur bei `SESSION_UNGUELTIG` (globale Regel) |
| `ergebnisKorrigieren` | `409 DATEN_VERALTET` | nur Funktion; die Maske (C7) lädt neu und lässt erneut speichern |

Alle Texte über `fehlertextBilden` (Server-`detail`), Verzweigung nur über `code`.

### 3.7 Mocks für die neuen Aufrufe (`src/test/mocks/handlers.ts`)

**Ohne Testdaten am Server entwickeln:** Beispieldaten sind fiktiv, ohne reale Namen (`Beispielspieler 1` …).

- `beispielTeams` (zwei Teams, ungerade Gesamtzahl mit genau einem `auswechselspieler`, ein Gast),
  `beispielErgebnis`, `beispielBilanz`, `beispielVerlauf` (vergangene Termine, Datum fest in der
  Vergangenheit, z. B. 2020; ein `ABGESCHLOSSEN`, ein `ABGESAGT`).
- Zustandsbehaftet wie die Rückmeldung (E4, Falle aus C3): `POST */teams/generieren` setzt `teams` im
  Detail (und zählt die Läufe je `teilnehmerVersion`, damit `409 KONTINGENT_ERSCHOEPFT` testbar ist);
  `POST */ergebnis/erfassen` setzt `ergebnis`, ein zweiter Aufruf antwortet `409 ERGEBNIS_VORHANDEN`;
  `GET */termine/lesen` respektiert `?ab=`.
- Detail-Hilfe `terminDetailsMit({ teams, ergebnis, status, … })` deckt alle Zeilen der Zustandsmatrix
  (10.3) ab.

---

## 4. Zeit und Auswahl (ca. 0,75 h)

Reine Funktionen in `src/api/termine/terminZeit.ts`, mit Tests:

```ts
/** Beginn des Termins als Date in der Zeitzone des Geräts (Datum und Uhrzeit sind Ortszeit). */
export function beginnVon(termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit'>): Date

/** „Di, 29. Juli“ */
export function datumKurz(datum: string): string

/** „19:00“ (Sekunden entfallen) */
export function uhrzeitKurz(uhrzeit: string): string

/** Erster Termin mit Status GEPLANT; dazu abgesagte Termine, die davor liegen. */
export function naechsterTermin(liste: readonly TerminUebersicht[]): {
  termin: TerminUebersicht | undefined
  abgesagtDavor: TerminUebersicht[]
}
```

- **Kein `new Date('2026-09-01')`:** Das liest als UTC und kann den Tag verschieben. Aus den Teilen
  bauen: `new Date(j, m - 1, t, h, min)`.
- Formatierung mit `Intl.DateTimeFormat('de-DE', …)`; kein Datumspaket.
- `naechsterTermin` sortiert **nicht** (die Liste kommt sortiert); Test mit Eingabe in Serverreihenfolge.
- Tests: Monats- und Jahreswechsel, Sekunden in `uhrzeit`, leere Liste, nur abgesagte Termine.

**Weitere reine Funktionen** (Stufe 3 und 4), ebenfalls in `terminZeit.ts`:

```ts
export const VERLAUF_TAGE = 90

/** Heute als `YYYY-MM-DD` in der Ortszeit des Geräts (nicht `toISOString`: das ist UTC). */
export function heuteIso(jetzt: Date): string

/** Stichtag für den Verlaufsabruf: heute minus `tage`. */
export function verlaufAb(jetzt: Date, tage = VERLAUF_TAGE): string

/** Vergangene Termine, neueste zuerst: `ABGESCHLOSSEN`, sowie `ABGESAGT` mit Beginn vor `jetzt`. */
export function vergangeneTermine(liste: readonly TerminUebersicht[], jetzt: Date): TerminUebersicht[]

/** Zuletzt abgeschlossener Termin (Grundlage des Tabs „Ergebnisse“, E13). */
export function letzterAbgeschlossener(liste: readonly TerminUebersicht[]): TerminUebersicht | undefined
```

- `vergangeneTermine` **kehrt die sortierte Eingabe um** (Kopie, kein erneutes Sortieren); die
  künftigen Termine in der Antwort (1.1 Nr. 15) fallen heraus.
- Tests: Monats- und Jahreswechsel in `verlaufAb`, Mitternacht in `heuteIso`, abgesagter künftiger Termin
  gehört nicht in den Verlauf, leere Liste.

---

## 5. Hooks (Termine ca. 1,5 h; weitere Hooks stufenweise)

Flach in `src/hooks/`, Muster wie `useNamensliste` (Polling mit `X-FuBo-Kein-Refresh`).

| Hook | Aufgabe |
|---|---|
| `useTermine()` | `useQuery` mit `schluessel.termine`, `refetchInterval: 20_000`, `staleTime: 0`, Abruf mit `keinRefresh: true` |
| `useTermin(terminId: number \| undefined)` | `schluessel.termin(String(id))`, `enabled: id !== undefined`, gleiches Polling und Kopf |
| `useRueckmeldung(terminId)` | `useMutation` auf `rueckmeldungSenden`; bei Erfolg **und** bei `409`/`404` `schluessel.termine` und `schluessel.terminAlle` invalidieren (die Antwort ändert die Anzeige: Status, Aktionen) |
| `useBegonnen(termin)` | Boolean „Beginn liegt zurück“; plant einen `setTimeout` bis zum Beginn, damit die Aktionsleiste ohne Neuladen verschwindet; räumt auf |
| `useVerlauf()` | `useQuery` mit `schluessel.termineVerlauf`, `termineLesen({ ab: verlaufAb(jetzt), keinRefresh: true })`, **kein** `refetchInterval`, `staleTime: 60_000`; liefert die Liste durch `vergangeneTermine` (in `useMemo`) und `letzterAbgeschlossener` |
| `useTeamsGenerieren(terminId)` | `useMutation` auf `teamsGenerieren`; bei Erfolg **und** bei `409`/`404` `schluessel.termin(String(id))` und `schluessel.termine` invalidieren. Ohne Kopf. Die Erschöpfung (E15) hält die Seite (10.2) |
| `useErgebnisErfassen(terminId)` | `useMutation` auf `ergebnisErfassen`; bei Erfolg **und** bei `409` (`ERGEBNIS_VORHANDEN`, `TERMIN_NICHT_ABGESCHLOSSEN`, `KEINE_EINTEILUNG`) `schluessel.termin(String(id))` und `schluessel.bilanz` invalidieren |
| `useBilanz()` | `useQuery` mit `schluessel.bilanz`, `staleTime: 60_000`, Abruf mit `keinRefresh: true`, `enabled: !istGast` (E19) |

- **Mutationen werden nie wiederholt** (Vorgabe in `queryClient.ts`); „neu versuchen“ ist ein zweiter
  Tipp auf dieselbe Schaltfläche.
- `useRueckmeldung` setzt **keinen** Cache von Hand (E4), nur Invalidierung. Hook-Tests brauchen
  `useTermin`/`useTermine` daneben, sonst lädt `invalidateQueries` nichts neu (Falle aus C1).
- Alle Fehlertexte über `fehlertextBilden`; Verzweigung nur über `code`.
- Teams- und Ergebnis-Tab lesen den Einzeltermin über **denselben** `useTermin` (Polling 20 s, E6): So
  erscheinen eine fremde Generierung, „veraltet“ und ein fremd erfasstes Ergebnis ohne Neuladen.
- Der Verlauf pollt nicht (vergangene Termine ändern sich nur durch Ergebnis und Korrektur).

---

## 6. Gemeinsame Bausteine (ca. 4,5 h)

Je Baustein Ordner, `.tsx`, `.module.scss`, `.test.tsx`; Importname `style`; keine Hexwerte;
Tap-Ziele ≥ `--tapziel-min`, Primäraktionen `--tapziel-primaer`; jedes bedienbare Element `data-testid`.

### 6.1 `TerminKarte` (ca. 1 h)

Datum (`datumKurz`), Uhrzeit (`uhrzeitKurz`), Ort (nur wenn vorhanden – kein leerer Platzhalter),
Statuszeile. Eingaben: `termin`. Der Titel ist eine Überschrift (`h1` auf dem Dashboard und der
Termin-Ansicht, `h2` in Listen).

- `ABGESAGT`: Text „Abgesagt“ mit Symbol (`block_icon_red`), nicht nur Farbe. `ABGESCHLOSSEN`:
  „Abgeschlossen“.
- Zeit und Datum in **einem** Block, damit ein Screenreader „Dienstag, 29. Juli, 19 Uhr“ liest
  (`<time dateTime="…">`).

### 6.2 `Zusagestatus` (ca. 0,75 h)

Dreiwertig, mit Symbol **und** Text; `role="status"` (Live-Region), damit die Änderung nach dem Tippen
angesagt wird:

| `eigeneRueckmeldung` | Text | Symbol |
|---|---|---|
| `true` | „Du hast zugesagt.“ (wartet der eigene Eintrag: „Du hast zugesagt und stehst auf der Warteschlange (Platz n).“) | `check_circle_icon` |
| `false` | „Du hast abgesagt.“ | `cancel_circle_icon_dark` |
| `null` | „Noch nicht gemeldet.“ Zusatz: „Bitte melde dich bis zum Beginn.“ | `info_circle_icon` (neutral) |

Der Fall `null` darf nicht aussehen wie eine Absage: kein rotes Symbol, kein Fehlerton.

### 6.3 `Teilnehmerliste` (ca. 1,5 h)

Eingaben: `liste: Teilnehmerliste`, `eigenerName`, `eigenerGast`, `eingeklappt`.

- Geordnete Liste (`<ol aria-label="Teilnehmer">`), Reihenfolge **wie geliefert**; ein Test sperrt
  Umsortieren (z. B. Server-Reihenfolge `[Z, A, M]` bleibt `[Z, A, M]`).
- Eintrag: `position`, Name, „(Gast)“ bei `gast`, „(du)“ beim eigenen Eintrag (E10).
- `wartet`: Text „wartet · Platz n“ mit `n = position − maxTeilnehmer`; zusätzlich ein Satz über dem
  ersten wartenden Eintrag: „Warteschlange – bei einer Absage rückt Platz 1 nach.“ (nur wenn es
  wartende gibt; als Text innerhalb des ersten wartenden `<li>`, nicht als `role="presentation"`-Zeile
  in der Liste).
- Aufklappen mit `<details open={!eingeklappt}>`, Summary „Teilnehmer (n)“ (Anzahl = Länge der Liste,
  also alle Zusagen). Das Summary-Ziel mindestens 44 px hoch.
- Leere Liste: Leerzustand „Noch keine Zusagen“ mit nächstem Schritt („Sag zu, wenn du dabei bist.“,
  entfällt bei beendeten Terminen – dort nur der Grund).
- Keine Skillwerte, keine Kürzel, keine Zusammenfassung „und 11 weitere“.

### 6.4 `RueckmeldungLeiste` (ca. 1,25 h)

`Aktionsleiste` mit den Aktionen aus E5. Eingaben: `eigeneRueckmeldung`, `terminId`.

- Beide Schaltflächen `breit`, Höhe `--tapziel-primaer`; während des Aufrufs `laedt` auf der
  gedrückten, die andere gesperrt (`aria-disabled`, nicht `disabled`, damit der Fokus bleibt).
- **Fokus nach Erfolg:** Entfällt die gedrückte Schaltfläche (Zustand `null` → eine Aktion), wandert
  der Fokus auf die verbleibende Aktion (Ref), nie auf `body`. Test.
- Fehler als `Fehlermeldung` über der Leiste (`rueckmeldung-fehler`): Text `fehlertextBilden`. Bei
  Netzfehler und `≥ 500` bleibt der Zustand, der zweite Tipp wiederholt.
- Wird die Leiste nicht gebraucht (begonnen, `ABGESAGT`/`ABGESCHLOSSEN`), rendert die
  Ansicht **keine** Leiste, sondern den passenden Satz (E8). Der Satz ist ein `Hinweis`.
- Den Hinweis zur Reihenfolge bei `false → true` erst nach der Handprüfung schreiben (1.1 Nr. 8).

### 6.5 `TerminAnsicht` (zusammenfassender Baustein, in 7 und 8 mitgerechnet)

Eingaben: `terminId`, `eingeklappt`. Holt `useTermin`, setzt Karte, Zusagestatus, `Fortschrittsbalken`,
Platzsatz, Teilnehmerliste und Leiste zusammen und verteilt Lade-, Fehler- und Leerzustände. Die
Seiten `Dashboard` und `TerminDetail` sind dünn.

- **Balken:** `wert = termin.zusagen` (aus dem Detail, derselben Antwort wie die Liste),
  `ziel = minTeilnehmer`, `erreicht = mindestzahlErreicht`.
- **Platzsatz** unter dem Balken, aus `maxTeilnehmer` und der Zahl der `wartet`-Einträge:
  „18 von 22 Plätzen belegt.“ bzw. „Alle 22 Plätze belegt, 3 auf der Warteschlange.“
- Lade-, Leer- und Fehlerzustand: `Ladespinner`; `Fehlerzustand` ohne Daten, `Fehlermeldung` bei
  vorhandenen Daten (`failureReason`), keine Meldung doppelt (Regel „immer nur eine Meldung“).

---

## 7. Tab „Termine“: Dashboard `/` (ca. 1,5 h)

`src/pages/Dashboard/Dashboard.{tsx,module.scss,test.tsx}`, ersetzt den Platzhalter der Index-Route.

1. `useTermine()` → `naechsterTermin(liste)`.
2. Lädt: Spinner. Fehler ohne Daten: `Fehlerzustand` mit „Erneut versuchen“.
3. Kein geplanter Termin: `Leerzustand` „Kein Termin geplant“, Text „Sobald der Admin einen Termin
   anlegt, erscheint er hier.“ (Test-ID `dashboard-leer`). Liegen abgesagte Termine in der Liste, steht
   darüber der Hinweis aus 4.
4. Abgesagte Termine **vor** dem nächsten geplanten: ein `Hinweis` je Termin („Der Termin am Di,
   29. Juli fällt aus.“), maximal zwei, danach „… und weitere abgesagte Termine“. Sie stehen dann
   **nicht** zusätzlich in der Liste aus Punkt 6.
5. `TerminAnsicht` für den nächsten Termin, `eingeklappt` (E9).
6. **Weitere Termine** (alle Termine nach dem nächsten geplanten, `GEPLANT` und `ABGESAGT`, ohne Details): Liste mit Datum, Uhrzeit, Ort,
   Zusagen und eigener Rückmeldung (Text und Symbol wie 6.2, kompakt); jede Zeile ein Link auf
   `termine/:terminId` (Test-ID `termin-link-<id>`), Zeilenhöhe ≥ 44 px. Abgesagte Termine tragen
   dort „Abgesagt“ statt der Rückmeldung. Maximal fünf Zeilen, darunter ohne
   Mehr-Anzeigen-Schaltfläche (vergangene Termine: Tab „Verlauf“, 10.4).
7. Admin (E7): nicht zuständig – `DashboardLayout` leitet nach `/admin` um (9.2); keine Admin-Zweige in dieser Seite.

**Layout 360 × 780:** Die Aktionsleiste ist ohne Scrollen sichtbar; der Inhalt darf scrollen
(variable Länge), die Leiste bleibt unten (Safe-Area über `Aktionsleiste`). Prüfen mit einem Termin,
zusammengeklappter Liste und zwei weiteren Terminen, **jetzt mit Tab-Leiste (9.1) darüber**.

---

## 8. Termin-Ansicht `termine/:terminId` (ca. 1 h)

`src/pages/TerminDetail/TerminDetail.{tsx,module.scss,test.tsx}`.

- Parameter prüfen: nur `^[1-9]\d*$`; sonst `NichtGefunden` rendern, **kein** Abruf. (`termine/abc` würde
  sonst `400` liefern, `termine/0` `404`.)
- `TerminAnsicht` mit offener Liste. Zurück: zum Dashboard (`handle: ZUM_DASHBOARD`, schon gesetzt).
- `404 INHALT_NICHT_GEFUNDEN` (Termin inzwischen entfernt): `Leerzustand` mit Grund und Rückweg zum
  Dashboard (`Textlink`), kein „Erneut versuchen“.
- `ABGESAGT`/`ABGESCHLOSSEN`: Karte mit Status, kein Aktionsbereich, kurzer Satz („Dieser Termin wurde
  abgesagt.“). Dazu je ein Textlink: bei `GEPLANT` „Teams ansehen“ → `teams/:terminId` (`termin-teams-link`), bei
  `ABGESCHLOSSEN` „Ergebnis ansehen“ → `ergebnisse/:terminId` (`termin-ergebnis-link`). Die Felder `teams` und
  `ergebnis` zeigt `TerminDetail` nicht selbst (10).
- Direktaufruf (Lesezeichen, Push in C8) funktioniert: Guard und Daten kommen aus Sitzung und Server.

---

## 9. Routing, Tab-Leiste und Dashboard-Rahmen (ca. 1,25 h)

### 9.1 `TabLeiste` (ca. 0,75 h)

`src/components/TabLeiste/TabLeiste.{tsx,module.scss,test.tsx}`. Vier Einträge in fester Reihenfolge:
**Termine** (`/`), **Teams** (`/teams`), **Ergebnisse** (`/ergebnisse`), **Verlauf** (`/verlauf`).

- **Element:** `<nav aria-label="Bereiche">` mit `<ul>` und vier `NavLink`. Der aktive Eintrag trägt
  `aria-current="page"` (setzt `NavLink` selbst), für `/` mit `end`. **Kein `role="tablist"`/`role="tab"`:**
  Das ARIA-Tab-Muster beschreibt das Umschalten von Bereichen *auf derselben Seite*; hier wechselt die
  Route, und der Tastaturvertrag der Tabs (Pfeiltasten, ein Tabstopp) würde die Bedienung nur erschweren.
- **Darstellung:** vier gleich breite Spalten (`grid-template-columns: repeat(4, 1fr)`), Text, kein reines
  Symbol, `white-space: nowrap`; bei 360 px bleiben etwa 90 px je Eintrag – „Ergebnisse“ muss ohne Umbruch
  passen (Sichtprüfung 12, Nr. 7). Höhe mindestens `--tapziel-min`. Der aktive Eintrag ist **nicht nur
  farbig** gekennzeichnet (Unterstreichung/Balken), Fokusring sichtbar. Farben und Abstände ausschliesslich
  aus den Tokens.
- **Platz:** direkt unter der Kopfzeile, oberhalb des Inhalts, und sie steht fest, wenn der Inhalt scrollt.
  Unten bleibt der Platz der `Aktionsleiste` (Primäraktion in Daumenreichweite) frei (E11).
- Test-IDs: `tab-termine`, `tab-teams`, `tab-ergebnisse`, `tab-verlauf`, Container `tab-leiste`.
- Keine Zähler oder Hinweispunkte in C5 (z. B. „Ergebnis offen“); das wäre ein eigener Abruf je Tab.

### 9.2 `DashboardLayout` (ca. 0,25 h)

`src/layouts/DashboardLayout/DashboardLayout.{tsx,module.scss,test.tsx}`: pathlose Layout-Route **innerhalb**
`GeschuetzteRoute`.

- `useSitzung().istAdmin` → `<Navigate to={ADMIN_PFADE.start} replace />` (E7). Das ist Bedienkomfort: Der
  Server bleibt die Instanz (`PROFIL_GESCHUETZT` bei der Rückmeldung).
- Sonst `<TabLeiste />` über `<Outlet />`.
- Den Kommentar in `zielpfad.ts` („Das User-Dashboard bleibt für den Admin erreichbar (A9)“) an E7
  anpassen **oder** E7 überdenken; vor Beginn mit dem Entwickler klären (1.4).

### 9.3 Routenbaum (`src/app/routen.tsx`)

```tsx
const OHNE_ZURUECK: RoutenAngaben = { ohneZurueck: true }

{ element: <GeschuetzteRoute />, children: [
  { element: <DashboardLayout />, children: [        // Tab-Leiste sichtbar
    { index: true,         element: <Dashboard />,      handle: OHNE_ZURUECK },
    { path: 'teams',       element: <TeamsSeite />,     handle: OHNE_ZURUECK },
    { path: 'ergebnisse',  element: <ErgebnisSeite />,  handle: OHNE_ZURUECK },
    { path: 'verlauf',     element: <VerlaufSeite />,   handle: OHNE_ZURUECK },
  ] },
  // Detailansichten: ohne Tab-Leiste, mit „Zurück“ (E12)
  { path: 'termine/:terminId',     element: <TerminDetail />,   handle: ZUM_DASHBOARD },
  { path: 'teams/:terminId',       element: <TeamsSeite /> },       // ein Schritt zurück
  { path: 'ergebnisse/:terminId',  element: <ErgebnisSeite /> },    // ein Schritt zurück
  { path: 'einstellungen', … }                                      // unverändert (C8)
] }
```

- `TeamsSeite` und `ErgebnisSeite` bedienen **beide** Routen (mit und ohne `:terminId`); ohne Parameter
  bestimmen sie den Termin selbst (10.1). `Textlink`-Ziele in Seiten verweisen auf die Detailrouten.
- Der Kommentar „Ziel offen bis C6“ an `teams/:terminId` entfällt (die Ansicht liegt unter den Tabs; ein
  Zurück-Ziel mit Parameter kennt `RoutenAngaben` weiterhin nicht, deshalb ein Schritt im Verlauf).
- Die Detailrouten stehen **ausserhalb** des `DashboardLayout`: Dort wäre sonst für jede Detailroute zu
  entscheiden, welcher Tab aktiv ist (ein Termin aus dem Verlauf gehört weder zu „Termine“ noch zu
  „Ergebnisse“). Ausserhalb gilt „Zurück“ (E12).
- Nach dem Login führt `zielFuerStufe` für USER/GAST weiter nach `/`; nichts zu ändern.
- Bestehende Tests, die den Platzhalter „Start“ (`platzhalter-c5`) erwarten, anpassen: Suche
  `grep -rn "platzhalter-c5\|Start" src e2e`. (`layout.spec.ts` und `AppLayout.test.tsx` sind die
  wahrscheinlichen Stellen; nicht erst im CI bemerken, Falle aus C4.)

### 9.4 `useTerminParameter` (in 7/8 mitgerechnet)

`src/hooks/useTerminParameter.ts`: liest `:terminId` aus der Route, gültig nur nach `^[1-9]\d*$`
(`termine/abc` würde sonst `400` liefern, `termine/0` `404`). Rückgabe `{ vorhanden, gueltig, terminId }`.
Alle drei Detailansichten nutzen ihn: ungültig → `NichtGefunden`, **kein** Abruf.

---

## 10. Tabs „Teams“, „Ergebnisse“ und „Verlauf“ (ca. 8,0 h, Stufen 2 bis 4)

Gleiche Regeln wie bei den Bausteinen aus 6: Ordner mit `.tsx`, `.module.scss`, `.test.tsx`; Importname
`style`; keine Hexwerte; Tap-Ziele ≥ `--tapziel-min`, Primäraktionen `--tapziel-primaer`; jedes bedienbare
Element `data-testid`; Aussagen nie nur über Farbe.

### 10.1 Termin der Seite bestimmen (gemeinsam)

`TeamsSeite` und `ErgebnisSeite` bedienen je zwei Routen (9.3):

1. `useTerminParameter()` (9.4): vorhanden und ungültig → `NichtGefunden`, kein Abruf.
2. Vorhanden und gültig → diese `terminId`.
3. Nicht vorhanden (Hub) → **Teams:** `useTermine()` → `naechsterTermin(liste).termin` (E2/E13);
   **Ergebnisse:** `useVerlauf()` → `letzterAbgeschlossener`.
4. Kein Termin → `Leerzustand` (Teams: „Kein Termin geplant“; Ergebnisse: „Noch kein abgeschlossener
   Termin“, die Bilanz bleibt sichtbar) mit Test-ID `teams-leer` bzw. `ergebnisse-leer`.
5. Sonst `useTermin(terminId)` (Polling) und die Ansicht des Tabs.

Lade- und Fehlerzustände wie in 6.5 (`Ladespinner`, `Fehlerzustand` ohne Daten, `Fehlermeldung` bei
vorhandenen Daten, jede Meldung nur einmal).

### 10.2 Tab „Teams“ (ca. 3 h, Stufe 2)

**`TeamsAnzeige` (ca. 1,25 h)** – Eingaben `teams: Teameinteilung`, `eigenerName`, `eigenerGast`.

- Zwei Abschnitte „Team A (n)“ und „Team B (m)“ (`<section aria-labelledby>`, `h2`), je eine `<ul>`; n und m
  zählen den Auswechselspieler mit. Reihenfolge der Einträge wie geliefert (sie ist keine Rangfolge; ein
  Umsortieren wäre zulässig, hat aber keinen Nutzen).
- Eintrag: Name, „(Gast)“ bei `gast`, „(du)“ beim eigenen Eintrag (Abgleich wie E10), **„Auswechselspieler“**
  als Text mit Symbol bei `auswechselspieler` (A20b). Keine Skillwerte, keine Teamstärke, keine
  Gast-Stufe.
- Kopfzeile: „Einteilung von {erzeugtVon}, {Datum Uhrzeit von erzeugtAm}“ (der Server liefert beides, DESIGN.md).
- `veraltet = true`: `Hinweis` (neutral, nicht alarmierend): „Seit dieser Einteilung hat sich die
  Teilnehmerliste geändert.“ mit dem direkten Weg zur Neugenerierung (die Leiste). **Die Einteilung bleibt
  sichtbar** (Verstecken wäre falsch, Vertrag).

**`TeamsLeiste` (ca. 1,0 h)** – `Aktionsleiste` mit **einer** Aktion: „Teams generieren“ (`teams = null`)
bzw. „Teams neu generieren“. Eingaben: `terminId`, `vorhanden`, `veraltet`, `erzeugtVon`,
`mindestzahlErreicht`, `minTeilnehmer`, `zusagen`, `begonnen`, `gesperrtDurchKontingent`, optional
`kontingent?: { uebrig: number; max: number }`.

| Zustand | Darstellung |
|---|---|
| `GEPLANT`, nicht begonnen, Mindestanzahl erreicht, Kontingent offen | Aktion bedienbar |
| `mindestzahlErreicht = false` | Aktion `aria-disabled`, Grund als Text: „Es braucht mindestens {min} Zusagen, aktuell {n}.“ (Server-Werte) |
| `gesperrtDurchKontingent` (E15) | Aktion `aria-disabled`, Grund: „Das Kontingent für diese Teilnehmerliste ist aufgebraucht. Eine Änderung der Teilnehmerliste setzt es zurück.“ |
| Termin begonnen | Keine Leiste, `Hinweis`: „Die Einteilung steht fest.“ (E8) |
| `ABGESAGT` / `ABGESCHLOSSEN` | Keine Leiste, nur die Anzeige |

- `kontingent` gesetzt → Zeile „noch {uebrig} von {max} Generierungen“ über der Aktion. **Die Seite übergibt
  in C5 nichts** (1.1 Nr. 13); die Eingabe ist vorbereitet, damit das Feld des Servers ohne Umbau
  einzuziehen ist.
- Bestätigungsdialog (`Dialog`) vor dem Ersetzen einer nicht veralteten Einteilung (E16); Test-ID
  `teams-ersetzen-bestaetigen`.
- `laedt` während des Aufrufs; `aria-disabled` statt `disabled` (der Fokus bleibt).
- **Nach Erfolg:** `role="status"`-Meldung „Teams wurden generiert.“; der Fokus geht auf die Überschrift der
  Einteilung (`tabIndex={-1}`, Ref), nicht auf `body`.
- Fehler als `Fehlermeldung` (`teams-fehler`) über der Leiste (3.6); `KONTINGENT_ERSCHOEPFT` ist **keine**
  Fehlermeldung, sondern der gesperrte Zustand mit Grund.
- Test-IDs: `teams-generieren`, `teams-fehler`.

**`TeamsSeite` (ca. 0,75 h)** – `TerminKarte` (kompakt), darunter je nach Zustand:

- `teams = null` → eigener Zustand „Noch keine Einteilung“ (`Leerzustand`, `teams-nicht-generiert`),
  Text „Sobald jemand die Teams generiert, erscheinen sie hier.“ **Nicht** wie eine leere Liste.
- `teams` vorhanden → `TeamsAnzeige`.
- Dazu `TeamsLeiste`. Die Seite hält `kontingentErschoepftBei: number | null` (State, `teilnehmerVersion`
  des Termins zum Zeitpunkt des `409`); gesperrt ist die Aktion, solange `termin.teilnehmerVersion` diesem
  Wert gleicht. Nach einem Neuladen der Seite ist der Merker weg; der erste Tipp liefert dann erneut den
  `409`, ohne Kontingent zu verbrauchen.

### 10.3 Tab „Ergebnisse“ (ca. 3,5 h, Stufe 3)

**`BilanzKarte` (ca. 0,5 h)** – `useBilanz()`; drei Angaben mit Beschriftung (`<dl>`): „Siege“,
„Niederlagen“, „Unentschieden“. Nicht für GAST (E19). Alle drei `0` → „Noch keine Spiele gewertet.“.
Fehler als kleine `Fehlermeldung` (`bilanz-fehler`), blockiert die Seite nicht. Test-ID `bilanz-karte`.

**`ErgebnisAnzeige` (ca. 0,5 h)** – Eingabe `ergebnis: Ergebnis`.

- „Team A hat gewonnen.“ / „Team B hat gewonnen.“ / „Unentschieden.“; „Deutlicher Sieg“ nur bei
  `deutlich = true` (bei `U` immer `false`, kein Haken).
- „Erfasst von {erfasstVon} am {Datum Uhrzeit}“; bei `korrigiertAm` zusätzlich „Zuletzt korrigiert am …“.
- Keine Bearbeitung (E18).

**`ErgebnisFormular` (ca. 1,5 h)** – Eingabe `terminId`.

- `<fieldset>` mit `<legend>` „Wer hat gewonnen?“, drei native Radios „Team A“, „Team B“, „Unentschieden“
  (`ergebnis-sieger-a|b|u`), darunter die Checkbox „Deutlicher Sieg (Tordifferenz ab 3)“
  (`ergebnis-deutlich`). Bei „Unentschieden“ ist sie nicht anwählbar und wird auf `false` zurückgesetzt;
  der Grund steht als Text („nur bei einem Sieg“).
- Dauerhafter Hinweis über der Schaltfläche: „Der erste Eintrag gilt. Ein Ergebnis lässt sich nicht
  löschen, nur der Admin kann es korrigieren.“ (E17)
- „Ergebnis eintragen“ (`ergebnis-absenden`, Höhe `--tapziel-primaer`) ist ohne Auswahl `aria-disabled`
  mit Grund „Bitte wähle den Ausgang.“. Mit Auswahl öffnet sie den **Bestätigungsdialog** mit Zusammenfassung
  („Team A hat deutlich gewonnen.“) und den Aktionen „Eintragen“ / „Zurück“ (`ergebnis-bestaetigen`).
  Die Dialog-API vor Beginn lesen (`src/components/Dialog`).
- `laedt` im Dialog während des Aufrufs. Fehler als `Fehlermeldung` (`ergebnis-fehler`).
- **`409 ERGEBNIS_VORHANDEN`:** der Dialog schliesst, der Einzeltermin wird neu gelesen, das Formular weicht
  der `ErgebnisAnzeige`, davor ein `Hinweis` (`role="status"`): „Das Ergebnis war bereits erfasst; es gilt
  der erste Eintrag.“ Der Fokus geht auf die Überschrift der Anzeige.

**`ErgebnisSeite` (ca. 1,0 h)** – Aufbau: `BilanzKarte`, `TerminKarte` (kompakt), `TeamsAnzeige`
(nur lesend, damit klar ist, wer „Team A“ ist), dann je Zustand:

| Status | `teams` | `ergebnis` | Anzeige |
|---|---|---|---|
| `ABGESCHLOSSEN` | vorhanden | `null` | `ErgebnisFormular` |
| `ABGESCHLOSSEN` | beliebig | vorhanden | `ErgebnisAnzeige` |
| `ABGESCHLOSSEN` | `null` | `null` | `Leerzustand` „Für diesen Termin wurde keine Einteilung erzeugt, ein Ergebnis lässt sich nicht eintragen.“ (kein Formular) |
| `GEPLANT` | beliebig | beliebig | Satz: „Das Ergebnis lässt sich eintragen, sobald der Termin abgeschlossen ist (30 Minuten nach Beginn).“ (nur über die Detailroute erreichbar) |
| `ABGESAGT` | beliebig | beliebig | Satz „Dieser Termin wurde abgesagt.“ |

Der Server entscheidet weiter (`409`); die Tabelle ordnet nur die Anzeige.

### 10.4 Tab „Verlauf“ (ca. 1,5 h, Stufe 4)

**`VerlaufListe`** – Eingabe `termine` (aus `useVerlauf`, neueste zuerst). Je Zeile: Datum
(`datumKurz`), Uhrzeit, Ort (nur wenn vorhanden), Statustext „Abgeschlossen“ oder „Abgesagt“ (Text und
Symbol), Zahl der Zusagen. `ABGESCHLOSSEN` ist ein Link auf `ergebnisse/:terminId` (`verlauf-link-<id>`,
Zeilenhöhe ≥ 44 px), `ABGESAGT` ohne Link.

**`VerlaufSeite`** – Ladespinner, `Fehlerzustand` mit „Erneut versuchen“, Leerzustand „Noch keine
vergangenen Termine“ (`verlauf-leer`), sonst `VerlaufListe` und der Satz „Angezeigt werden die Termine der
letzten 90 Tage.“ (E14). Ein Ergebnis je Zeile zeigt die Liste nicht (kein zweiter Abruf je Termin; es
steht hinter dem Link).

### 10.5 Ohne Testdaten

Alle Ansichten rendern ohne Daten ihre **Normalzustände** und werden gegen die Mocks (3.7) entwickelt und
getestet: „Noch keine Einteilung“, „kein Ergebnis erfasst“, „Noch keine vergangenen Termine“,
„Noch kein abgeschlossener Termin“, Bilanz `0/0/0`. Damit lassen sich alle Seiten bauen, bevor am Server
ein Termin abgeschlossen ist. Die Handprüfung gegen den echten Server folgt in 12, Nr. 6.

---

---

## 11. Tests (Stufe 1 ca. 2,25 h; weitere Tests in 11.4)

### 11.1 Unit (Vitest, MSW, echter `queryClient`)

- API: Pfad, Methode, Körper; `rueckmeldung` **ohne** `X-FuBo-Kein-Refresh`; beide Lesefunktionen
  tragen den Kopf, **wenn** `keinRefresh` gesetzt ist; kein `ab` im Aufruf.
- `terminZeit`: siehe 4.
- `useTermine`/`useTermin`: Abrufe mit Kopf; Polling mit Fake-Timern; `useTermin(undefined)` ruft nicht.
- `useRueckmeldung`: nach `204` laden Liste und Detail neu (mit beobachteter Abfrage daneben); bei
  `409 TERMIN_GESCHLOSSEN` ebenfalls; kein zweiter Versuch bei `500`.
- Bausteine: `Zusagestatus` (drei Zustände, `null` nicht wie `false`), `Teilnehmerliste` (Reihenfolge,
  „(Gast)“, „(du)“, „wartet · Platz n“, eingeklappt/offen), `RueckmeldungLeiste` (Aktionen je Zustand,
  `laedt`, Fokus nach Erfolg, Fehlertext), `TerminKarte`, `TerminAnsicht` (Balken mit Servergrössen).
- Seiten: Dashboard (nächster Termin, abgesagter davor, kein Termin, Fehler,
  begonnen ohne Leiste); Termin-Ansicht (ungültige Id, `404`, abgesagt).

### 11.2 E2E

- Nachbildung der API in `e2e/hilfen/termine.ts` (zustandsbehaftet: Rückmeldung ändert Liste und Detail;
  zählt Abrufe mit und ohne `X-FuBo-Kein-Refresh`), Sitzung über `e2e/hilfen/sitzung.ts`.
  Relative Importe mit Endung `.js`.
- Neu `e2e/termine.spec.ts`:
  1. Dashboard mit nächstem Termin und „Noch nicht gemeldet“; Zusage → Status, Balken, Liste,
     Fokus auf der verbleibenden Aktion.
  2. Absage und „Doch zusagen“.
  3. Warteschlange: Höchstzahl 2, drei Zusagen, der dritte Eintrag trägt „wartet · Platz 1“.
  4. Abgesagter Termin davor: Hinweis, nächster geplanter Termin darunter.
  5. Termin hat begonnen (`page.clock`): keine Aktionsleiste, Satz sichtbar; `409` am Server:
     Fehlermeldung und anschliessend neu gelesener Stand.
  6. Admin auf `/` und `/teams`: Umleitung nach `/admin` (`DashboardLayout`).
  7. Polling: eine fremde Zusage erscheint nach 20 s (`page.clock`), alle Polling-Abrufe tragen den Kopf.
  8. Direktaufruf `termine/<id>`, ungültige Id, `404`.
  9. Layout 360 × 780: Aktionsleiste im Sichtfeld, kein waagerechtes Scrollen, Tap-Ziele ≥ 64 px
     (Primäraktion) und ≥ 44 px (Zeilen, Summary).
- Bestehende E2E-Specs anpassen, die den Platzhalter der Startseite erwarten (9).

### 11.3 Gegenproben (Test rot ohne Absicherung)

`eigeneRueckmeldung === null` wird nicht wie `false` behandelt; Teilnehmerliste nicht umsortiert;
Polling ohne `X-FuBo-Kein-Refresh` (Kopf entfernen → E2E rot); Invalidierung nach der Rückmeldung
(ohne sie zeigt die Ansicht den alten Stand); `mindestzahlErreicht` kommt vom
Server (Mock mit `zusagen ≥ min` und `mindestzahlErreicht=false` zeigt „noch nicht erreicht“);
Aktionsleiste verschwindet bei begonnenem Termin; Fokus nach Erfolg; ungültige Id löst keinen Abruf aus.

### 11.4 Tests der Tabs „Teams“, „Ergebnisse“ und „Verlauf“ (ca. 4,0 h, über die Stufen verteilt)

**Unit (Vitest, MSW, echter `queryClient`)**

- API: `teamsGenerieren` (Pfad, Körper `{ terminId }`, ohne Kopf), `ergebnisErfassen` (Körper; **bei `U`
  geht `deutlich: false` hinaus, auch wenn `true` übergeben wird**), `bilanzLesen` (Kopf nur auf Wunsch),
  `ergebnisKorrigieren` (Voll-Update, `version` im Körper), `termineLesen({ ab })` (Pfad mit `?ab=`).
- `terminZeit`: siehe 4 (Verlaufsfunktionen).
- Hooks: `useVerlauf` (kein Polling, Filter), `useTeamsGenerieren` und `useErgebnisErfassen`
  (Invalidierung bei Erfolg **und** bei `409`, kein zweiter Versuch bei `500`), `useBilanz` (bei GAST kein Abruf).
- `TabLeiste`: vier Links, `aria-current` auf dem aktiven Eintrag, kein `role="tab"`; `DashboardLayout`:
  ADMIN wird nach `/admin` umgeleitet, USER sieht Leiste und Inhalt.
- `TeamsAnzeige`: Auswechselspieler, „(Gast)“, „(du)“, `veraltet` zeigt Einteilung **und** Hinweis;
  `TeamsLeiste`: alle Zeilen der Zustandstabelle (10.2), Bestätigung nur bei nicht veralteter Einteilung,
  Fokus nach Erfolg, Sperre nach `KONTINGENT_ERSCHOEPFT` und Freigabe bei neuer `teilnehmerVersion`.
- `ErgebnisFormular`: „Unentschieden“ sperrt und löscht den Haken, Bestätigungsdialog, `ERGEBNIS_VORHANDEN`
  zeigt Hinweis statt Fehler; `ErgebnisSeite`: alle Zeilen der Zustandsmatrix (10.3), Bilanz nicht bei GAST.
- `VerlaufSeite`: Reihenfolge neueste zuerst, abgesagter Termin ohne Link, Leerzustand, Fehler.
- Seiten mit ungültiger Id (`teams/abc`, `ergebnisse/0`): `NichtGefunden`, kein Abruf.

**E2E** (Helfer erweitern: `e2e/hilfen/teams.ts`, `e2e/hilfen/ergebnisse.ts`, zustandsbehaftet)

1. `e2e/tabs.spec.ts`: Navigation über alle vier Tabs, `aria-current`, Tastaturbedienung, Layout 360 × 780
   (kein waagerechtes Scrollen, „Ergebnisse“ ohne Umbruch, Tap-Ziele ≥ 44 px), ADMIN → `/admin`.
2. `e2e/teams.spec.ts`: kein Termin; „Noch keine Einteilung“ → Generieren → Einteilung samt Auswechselspieler;
   `veraltet` nach fremder Absage (Polling mit `page.clock`); `KONTINGENT_ERSCHOEPFT` sperrt mit Grund;
   Mindestanzahl nicht erreicht; Bestätigung beim Ersetzen; Termin hat begonnen ohne Aktion.
3. `e2e/ergebnisse.spec.ts`: Formular → Bestätigung → Anzeige und Bilanz; „Unentschieden“ ohne Haken;
   `ERGEBNIS_VORHANDEN` zeigt Hinweis und Anzeige; abgeschlossener Termin ohne Einteilung; GAST ohne Bilanz.
4. `e2e/verlauf.spec.ts`: Liste neueste zuerst, Link auf `ergebnisse/<id>`, Leerzustand.

**Gegenproben (Test rot ohne Absicherung)**

`teams = null` wird nicht wie eine leere Einteilung behandelt; `veraltet` versteckt die Einteilung nicht;
`deutlich` geht bei `U` nie als `true` hinaus; `ERGEBNIS_VORHANDEN` erscheint nicht als Fehlermeldung;
Invalidierung nach Erfassen (Bilanz und Anzeige zeigen sonst den alten Stand); Verlauf ohne Polling; die
Sperre nach `KONTINGENT_ERSCHOEPFT` fällt bei neuer `teilnehmerVersion`; die Mindestanzahl kommt aus
`mindestzahlErreicht` des Servers.

---

## 12. Abnahme von C5

1. `npm run lint`, `typecheck`, `test`, `build`; ein `fetch(`; kein Hexwert ausserhalb der Tokendatei;
   Suche nach verwaisten Pfaden (`AGENT_CLIENT.md`).
2. E2E in den drei Chromium-Projekten lokal, alle sieben im CI (Layout bei Fensterhöhen unter 740 px
   beobachten; die Grenze nicht ohne Anlass verschieben).
3. **Termine für die Handprüfung am Server anlegen** (der Client kann das erst mit C7): mit Admin-Cookie
   `POST /admin/termin/anlegen` (`datum`, `uhrzeit`, optional `ort`, Zeitpunkt in der Zukunft) oder
   `POST /admin/serie/anlegen` (`titel`, `wochentag`, `uhrzeit`, `startdatum`, `enddatum`). Für die
   Warteschlange die Höchstzahl über `/admin/config/aendern` (Voll-Update) vorübergehend auf 2 setzen und
   danach zurücksetzen.
4. **Handprüfung gegen den echten Server, zwei Geräte:**
   - Zusage, Absage, „Doch zusagen“; **Reihenfolge nach Absage und erneuter Zusage** beobachten und den
     Hinweistext danach festschreiben (1.1 Nr. 8).
   - Mindestanzahl: Balken rot, nach der sechsten Zusage grün, Text sagt dasselbe.
   - Warteschlange: dritte Zusage bei Höchstzahl 2 wartet; Absage einer Person rückt nach (Anzeige auf dem
     zweiten Gerät nach höchstens 20 s).
   - Gast: sieht und meldet wie ein User, Eintrag trägt „(Gast)“.
   - Admin: `/` und `/teams` führen nach `/admin`.
   - Den nächsten Termin am Server absagen (`POST /admin/termin/absagen`): Hinweis auf dem Dashboard, Aktionen weg.
   - Rückmeldung nach Terminbeginn: Aktionen verschwinden von selbst; ein `409` im Server-Log nicht
     provozieren, das beweist nur die Uhr.
   - iPhone: Tap-Ziele, Aktionsleiste über dem Home-Indicator, Summary der Liste bedienbar.
5. Sichtprüfung bei 360 px: Dashboard (mit/ohne weitere Termine, eingeklappte Liste), Termin-Ansicht
   mit Warteschlange, Leerzustand, Fehler.
6. **Handprüfung der neuen Tabs gegen den echten Server** (zwei Geräte; Testdaten vorab anlegen, 1.4 und
   Nr. 3):
   - Vorbereitung: mindestens sechs Zusagen **mit Skillwerten** (sonst `SKILLWERTE_UNVOLLSTAENDIG`); Gäste
     brauchen eine Stufe (Adminendpunkt, im Client erst mit C7). Ungerade Teilnehmerzahl für den
     Auswechselspieler.
   - **Teams:** Generieren, zweites Gerät sieht die Einteilung nach höchstens 20 s; zweiter Lauf bei
     `anzTeamGenerator = 1` → Sperre mit Grund; Zu- oder Absage → Einteilung `veraltet`, Aktion wieder
     frei; nach Terminbeginn keine Aktion.
   - **Ergebnisse:** Einen Termin etwa zehn Minuten in der Zukunft anlegen, **vor** dem Beginn Teams
     generieren (danach fix), 30 bis 35 Minuten nach Beginn ist er `ABGESCHLOSSEN`. Zwei Geräte erfassen
     gleichzeitig: das zweite zeigt den Hinweis „bereits erfasst“. Bilanz des Spielers steigt; „Unentschieden“
     ohne Haken; Verhalten von `GET /bilanz/lesen` für einen Gast notieren (1.4).
   - **Verlauf:** abgeschlossener und abgesagter Termin erscheinen, neueste zuerst.
7. Sichtprüfung bei 360 px: Tab-Leiste (alle vier Beschriftungen ohne Umbruch), Teams (Einteilung mit
   Auswechselspieler, `veraltet`, gesperrte Aktion), Ergebnisse (Formular, Dialog, Anzeige), Verlauf (mit
   und ohne Einträge), jeweils mit und ohne Aktionsleiste.

---

## 13. Nachdokumentation und Commit

- `CONTEXT_HANDOFF_CLIENT.md` (Vorfassung ins Archiv): Entscheidungen E1–E10 (bestätigte Fassung),
  neue Bausteine und Hooks, Testzahlen, Stand der Handprüfung; Abschnitt 6.4 „`teams/:terminId` → Termin“
  an die neuen Zurück-Ziele anpassen (9.3).
- `AGENT_CLIENT.md`: Regel „Lesezugriffe der Terminansichten tragen `X-FuBo-Kein-Refresh`, die
  Rückmeldung nicht“; Teilnehmerliste nie umsortieren; `eigeneRueckmeldung` dreiwertig; neue Bausteine
  unter „Basis-Komponenten“.
- **DESIGN.md** gehört nicht zum Client-Repository: die Abweichungen aus 1.3 dem Entwickler zur
  Übernahme vorlegen (Prototyp 04/05/12).
- `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`: Client-Stand.
- Handoff-Meilensteintabelle: C6 geht in C5 auf (Vorschlag); neuer Umfang C5 31,5 h. `AGENT_CLIENT.md`
  zusätzlich: `teams`/`ergebnis` sind im Normalzustand `null`; `deutlich` bei `U` immer `false`;
  `TeamEintrag` ohne Skillwerte; Tab-Leiste als Links, Detailrouten ohne Leiste; Kontingent nur über den
  `409` erkennbar (bis der Server das Feld liefert).
- Commit auf `dev_client`; nichts nach `main`. Git im verbundenen Ordner nur mit `--no-optional-locks`;
  für den Commit selbst ist die Löschfreigabe nötig (Sperrdateien in `.git`).

---

## 14. Fallen

- **`if (eigeneRueckmeldung)` ist falsch.** Immer gegen `true`, `false` und `null` unterscheiden.
- **`new Date('YYYY-MM-DD')` liest als UTC** und kann den Tag verschieben; aus den Teilen bauen.
- **Teilnehmerliste nicht sortieren und nicht in zwei Arrays teilen** – `position` stimmt sonst nicht
  mehr mit der Anzeige überein.
- **Zahl im Kopf und Liste aus derselben Antwort lesen.** `zusagen` der Liste und das Detail können
  um einen Polling-Takt auseinanderliegen; auf der Termin-Ansicht gilt das Detail.
- **Beide Lesezugriffe teilen sich keinen Schlüssel mit der Sitzung.** Wer sie ohne den Kopf
  `X-FuBo-Kein-Refresh` anlegt, hält die Sitzung durch das Polling offen (Falle aus C3).
- **`invalidateQueries` lädt nur beobachtete Abfragen** – Hook-Tests mit `useTermin` daneben.
- **Ein Mock, der unabhängig von der Anfrage antwortet, kann eine Änderung nicht zeigen** (Falle aus C3):
  für die Zu-/Absage einen zustandsbehafteten Mock verwenden.
- **`Aktionsleiste` ersetzt die Schaltfläche beim Zustandswechsel:** ohne Fokusübergabe landet der Fokus
  auf `body` und die Tastatur beginnt oben.
- **Playwright klickt nicht auf `aria-disabled`-Elemente** (wartet); im Test `force: true`.
- **`page.clock` lässt `setInterval` des Querys mitlaufen**, aber nicht automatisch `Date.now()` im Server-
  Mock: Zeitpunkte im Mock mit **einer** Uhrablesung bauen.
- **Ablauf-Dialog gilt auch hier** (er hängt in `GeschuetzteRoute`); eine Rückmeldung ist eine Aktivität
  und verlängert das Fenster, das Polling nicht.
- **`teams = null` und `ergebnis = null` sind der Normalzustand**, kein Fehler und keine leere Liste.
- **Die Reihenfolge in `teamA`/`teamB` ist keine Rangfolge**, die der Teilnehmerliste dagegen schon (1.1 Nr. 4, 16).
- **`deutlich` bei `U`:** `true` liefert `400`; die Oberfläche setzt den Haken zurück, die API-Funktion sendet `false`.
- **`ERGEBNIS_VORHANDEN` ist kein Bedienfehler** (mehrere tippen nach dem Abpfiff): Hinweis und Anzeige, keine Fehlermeldung.
- **Ein Ergebnis lässt sich nicht löschen:** Dialog und Hinweis sind Pflicht, nicht Zierde.
- **`ab` hat keine Obergrenze:** Die Antwort enthält auch künftige Termine; im Client filtern. Das
  Datum nicht mit `toISOString()` bilden (UTC).
- **Ein Mock, der `teamsGenerieren` immer mit `201` beantwortet,** kann Kontingent und `veraltet` nicht zeigen:
  zustandsbehaftet bauen (3.7).
- **Tabs sind Links:** `NavLink`, nicht `role="tab"`; sonst erwartet ein Screenreader Pfeiltasten, die es nicht gibt.
- **`teams` und `teams/:terminId` sind zwei Routen mit derselben Seite:** Parameter prüfen (9.4), Hub und
  Detail testen.
- **Bilanz bei GAST:** nicht anzeigen und nicht abrufen, solange das Verhalten des Servers offen ist (1.4).
- **Handprüfung der Ergebnisse braucht Zeit:** Ein Termin ist erst 30 bis 35 Minuten nach Beginn
  abgeschlossen; Testtermin früh anlegen.

---

## 15. Zeitplan (31,5 h in vier Stufen)

Jede Stufe endet **grün** (`lint`, `tsc`, `test`, `build`, E2E in drei Chromium-Projekten) und wird einzeln
committet (auf Aufforderung); so bleibt der Stand lieferbar, wenn die Zeit knapp wird.

| Stufe | Schritt | Abschnitt | h |
|---|---|---|---|
| **1 – Termine und Tab-Rahmen** | Datenzugriff, Mocks, Schlüssel | 3.1–3.3 | 1,0 |
| | Zeit und Auswahl | 4 | 0,75 |
| | Hooks | 5 | 1,5 |
| | Bausteine (Karte, Status, Liste, Leiste) | 6.1–6.4 | 4,5 |
| | Dashboard samt `TerminAnsicht` | 6.5, 7 | 1,5 |
| | Termin-Ansicht | 8 | 1,0 |
| | Tab-Leiste, `DashboardLayout`, Routenbaum | 9 | 1,25 |
| | Tests, E2E, Gegenproben | 11.1–11.3 | 2,25 |
| | Abnahme und Doku | 12, 13 | 1,25 |
| | *Zwischensumme* | | *15,0* |
| **2 – Teams** | API, Mock, Hook | 3.4, 3.6, 3.7, 5 | 1,0 |
| | `TeamsAnzeige`, `TeamsLeiste`, `TeamsSeite` | 10.1, 10.2 | 3,0 |
| | Tests, E2E | 11.4 | 1,25 |
| | Abnahme | 12, Nr. 6 | 0,5 |
| | *Zwischensumme* | | *5,75* |
| **3 – Ergebnisse und Bilanz** | API (inkl. Korrektur), Mock, Hooks | 3.4, 3.6, 3.7, 5 | 1,5 |
| | `BilanzKarte`, `ErgebnisAnzeige`, `ErgebnisFormular`, `ErgebnisSeite` | 10.3 | 3,5 |
| | Tests, E2E | 11.4 | 1,75 |
| | Abnahme | 12, Nr. 6 | 0,75 |
| | *Zwischensumme* | | *7,5* |
| **4 – Verlauf** | `?ab=`, Zeitfunktionen, Hook | 3.4, 3.5, 4, 5 | 0,75 |
| | `VerlaufListe`, `VerlaufSeite` | 10.4 | 1,5 |
| | Tests, E2E | 11.4 | 0,75 |
| | Abnahme | 12, Nr. 6, 7 | 0,25 |
| | *Zwischensumme* | | *3,25* |
| **Summe** | | | **31,5** |

Die Reihenfolge der Stufen ist zwingend: Stufe 3 braucht den Rahmen aus Stufe 1 und die Teams-Anzeige aus
Stufe 2; Stufe 4 verlinkt auf die Ergebnis-Seite. Die Schätzung ist gröber als in der ersten Fassung: Sie
gründet auf den Bausteinzeiten aus 6 und trägt keine Reserve für den Kontingent-Umbau (1.4).

**Risiken:** (1) Teilnehmerliste samt Warteschlange (6.3) trägt die meiste Fachlogik – zuerst mit Mocks und
Unit-Tests fertigstellen, dann das Dashboard bauen. (2) Handprüfung ohne Terminverwaltung im Client (12,
Nr. 3): Testtermine **vor** der Abnahme anlegen; für Ergebnisse zusätzlich die Wartezeit bis `ABGESCHLOSSEN`.
(3) Die Lücke beim Generierungskontingent (1.1 Nr. 13): Wird das Feld am Server nachgezogen, entfällt die
Sperre nach `409` zugunsten der Anzeige „noch x von y“ (E15, ca. 1 h). (4) Der Rahmen (Tab-Leiste, Routen) ist
in der ersten Stufe der Hebel für alle weiteren; Änderungen an E11/E12 nach Stufe 1 kosten Umbau.
