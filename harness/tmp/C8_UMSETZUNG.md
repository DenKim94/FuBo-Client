# C8 – Admin-Dashboard und Verwaltung, Teil 2 (Umsetzungsanleitung)

> Arbeitspaket **C8** (geschätzt **21,5 h**; zwei Stufen, siehe 15). Es **setzt C7 voraus** (`C7_UMSETZUNG.md`, Stufen 1 bis 3,
> abgeschlossen und grün) und wurde am 18.10.2026 aus der ursprünglichen Gesamtanleitung (49 h, fünf Stufen) herausgelöst.
> Hier stehen die **Stufen 4 und 5**: Konfiguration, Gastplätze, Skill-Stufe eines Gastes, Hallenabsage, Ergebniskorrektur und
> manuelle Teamgenerierung. Die Fassung der Gesamtanleitung liegt unverändert unter `harness/tmp/C7_UMSETZUNG_2026-10-18.md`.
>
> **Nummerierung:** Die Nummern der Gesamtanleitung blieben erhalten (Entscheidungen E1–E22, Abschnitte 3, 4, 5.5, 5.8, 5.9, 9 bis
> 15, Stufen 4 und 5), damit Verweise zwischen beiden Dateien und in älteren Notizen gelten. Lücken sind Absicht. „C7 x.y“
> bezeichnet einen Abschnitt der C7-Anleitung; **was hier nicht steht, gilt aus C7 unverändert** (Befunde 1.1, Entscheidungen
> E1–E12, E19, E20, gemeinsame Regeln 4.2 und 4.3, Bausteine 5.1 bis 5.4, 5.6, 5.7).
>
> **Meilensteinplan:** Das Paket „PWA-Onboarding & Push“ heisst seither **C9**, „Abnahme, WCAG 2.1 AA, Deployment“ **C10**
> (bisher C8 und C9). Der Probeversand `POST /admin/push/test` gehört zu C9 (E21).
>
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (A11, A12, A15, A17–A19, A21–A24), `client/harness/AGENT_CLIENT.md`,
> `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Ansichten 12, 14 bis 16, 19), Vertrag `client/harness/assets/fubo-api.json`
> (45 Operationen, Stand 17.10.2026). Die Prototypdatei war bei der Erstellung nicht auswertbar; vor jeder Stufe sichten,
> Abweichungen sind zulässig (C7 1.3).
>
> **Fassung vom 18.10.2026.** Die Entscheidungen E13–E18 (1.2) sind **Vorschläge** und vor Beginn der jeweiligen Stufe vom
> Entwickler zu bestätigen oder zu ändern.

---

## 0. Ziel und Abgrenzung

Nach C8 stellt der Admin die **Konfiguration** ein (Teilnehmerzahlen, Team-Generator, Sitzung, Halle, Benachrichtigungen),
verwaltet **Gastplätze** und die **Skill-Stufe von Gästen** je Termin, sagt die **Halle** per E-Mail ab, **korrigiert
Ergebnisse** und rechnet **Teams unabhängig von einem Termin**. Damit sind alle Einträge der Verwaltungsliste aus C7 belegt;
die `Platzhalter` für `gaeste`, `konfiguration` und `teams` entfallen.

| Bereich | Routen (Vorschlag E1) | Inhalt | Endpunkte |
|---|---|---|---|
| im Termin | `/admin/termine/:terminId` | Skill-Stufe eines Gastes, Hallenabsage, Ergebnis korrigieren | `POST /admin/teilnahme/gast-stufe`, `POST /admin/halle/absagen`, `POST /admin/ergebnis/korrigieren` |
| Gäste | `/admin/gaeste` | Gastplätze, Freigabe | `GET /admin/gast/lesen`, `POST /admin/gast/freigeben` |
| Konfiguration | `/admin/konfiguration` | Voll-Update mit sechs Gruppen | `GET /admin/config/lesen`, `POST /admin/config/aendern` |
| Teams | `/admin/teams` | manuelle Generierung, nicht gespeichert | `POST /admin/teams/generieren` |

Alle Endpunkte unter `/admin/` verlangen die Rolle `ADMIN`. Der Admin sieht weiterhin keinen Zusagestatus und keine Tab-Leiste
(C7 E2).

**Nicht Teil von C8:**

- **Einstellungen, Push, Installationshinweis** → **C9**. Der Probeversand `POST /admin/push/test` gehört dorthin (E21), weil er
  den Push-Status (`GET /push/status/lesen`) daneben zeigen muss. Die Konfiguration zeigt nur den Schalter `pushAktiv` und
  die Erinnerungsstunden (9.2).
- **Alles aus C7:** Dashboard, Zugangsdaten, Profile, Termine (Anlegen, Ändern, Absagen, Abschliessen, Entfernen).
- **Änderung einer Serie, Audit-Log, Bilanz-Historie** – nicht über die API erreichbar (C7 0).
- Keine neuen Abhängigkeiten.

---

## 1. Vorab: Befunde und Entscheidungen

### 1.1 Befunde aus dem Vertrag

Stehen in **C7 1.1** und gelten unverändert. Für C8 besonders: Nr. 2 (Stufe einer Teilnahme), Nr. 3 (Konfiguration, Voll-Update),
Nr. 10 (Ergebniskorrektur), Nr. 11 (Hallenabsage), Nr. 12 (manuelle Generierung) und Nr. 17 (Sitzungsdauern).

### 1.2 Entscheidungen (Vorschläge vom 17.10.2026, übernommen aus der Gesamtanleitung)

| Nr. | Entscheidung | Begründung |
|---|---|---|
| E13 | **Skill-Stufe eines Gastes im Termin** (Teilnehmerliste der Verwaltung, je Gast „Stufe ändern“): Dialog mit Radiogruppe Stark/Mittel/Schwach; **vorbelegt** nur, wenn `GET /admin/gast/lesen` einen belegten Platz mit gleichem `gastName` zeigt, sonst ohne Vorauswahl (Pflichtwahl). Die Gastverwaltung (E15) zeigt die Stufe **nur an**. | Vertrag 1.1 Nr. 2; ersetzt DESIGN.md Ansicht 12, Vorbelegung „mittel“ nur bei Pflichtwahl sichtbar. |
| E14 | **Konfiguration als ein Formular** mit sechs Gruppen (Teilnehmer, Gäste, Team-Generator, Sitzung, Halle, Benachrichtigungen); Abbildung Formular → Körper in **einer** Funktion mit Test auf genau 15 Schlüssel; leere `halleEmail`/`halleAbsageVorlage` ⇒ `null`; `halleAbsageVorlageEffektiv` nur lesend unter der Vorlage. | Vertrag 1.1 Nr. 3. |
| E15 | **Gastverwaltung:** Platzliste (Nummer, Zustand, Name, Stufe, „seit“, „Sitzung abgelaufen“, „nicht mehr vergeben“), je belegtem Platz „Freigeben“, dazu „Verwaiste freigeben“ (`slotIds` der verwaisten). **Kein** „Alle freigeben“ (`alle: true`). | Ein aktiver Gast flöge sofort raus; die Sammelaktion trifft nur Plätze ohne lebende Sitzung. |
| E16 | **Hallenabsage im Termin** (`GEPLANT`): nur sichtbar, wenn `hallenModusAktiv`; zeigt „Absage möglich bis {Zeitpunkt}“ (absolut, aus `halleAbsageMoeglichBis`), danach deaktiviert (`useZeitpunktErreicht`, ohne Uhr im Render); bei `halleAbgesagtAm` nur „Absage am … versandt“. Dialog: Mail geht sofort hinaus, nicht zurücknehmbar, Termin wird mit abgesagt. | Vertrag 1.1 Nr. 11; DESIGN.md Ansicht 15. Kein heruntertickender Countdown: Er braucht eine Uhr im Render (C5-Regel). |
| E17 | **Ergebniskorrektur im Termin** (`ABGESCHLOSSEN` mit `ergebnis`): Anzeige oben, darunter „Ergebnis korrigieren“; Eingabe aus `ErgebnisFormular` herausgelöst (`ErgebnisEingabe`, wiederverwendet); Speichern gesperrt, solange nichts geändert ist; Dialog nennt „alt ⇒ neu“ und „Bilanz der Beteiligten wird angepasst“. | Vertrag 1.1 Nr. 10. Eine unveränderte Korrektur wäre zulässig, aber ohne Wirkung ausser dem Protokoll; Gegenvorschlag: nicht sperren. |
| E18 | **Manuelle Teamgenerierung** `/admin/teams`: Auswahlliste der aktiven Spielerprofile (ohne Adminprofil, ohne Gesperrte) mit „Alle“/„Keine“, Gäste als Zeilen (Name optional, Stufe Pflicht, vorbelegt sichtbar mit „Mittel“), Zähler „n von {maxTeilnehmer}“; Ergebnis mit dauerhaftem Hinweis „nicht gespeichert, für niemanden sichtbar, nach dem Verlassen weg“; Anzeige des tatsächlichen Verfahrens und Modus; Teamlisten aus `TeamsAnzeige` herausgelöst (`TeamListen`). | DESIGN.md Ansicht 16; Vertrag 1.1 Nr. 12. Kein Blocker beim Verlassen. |
| E21 | **Push-Probeversand gehört zu C9** (bisher C8). | s. 0. |
| E22 | **Meilensteinplan:** C7 und C8 sind die zwei Hälften des ursprünglichen C7 (49 h): **C7 27,5 h, C8 21,5 h**; Push/PWA wird **C9**, Abnahme/Deployment **C10**. | Abschnitt 15. |

Aus C7 gelten insbesondere **E3** (Ordnung, Hooks in `src/hooks/admin/`), **E4** (Lesen im Admin ohne Polling), **E5**
(`DATEN_VERALTET`, Muster in C7 4.2), **E7** (unvollständige Skillwerte) und **E19** (Dialoge nennen die Folgen).

### 1.3 Abweichungen von DESIGN.md und Prototyp (verbindlich ist der Vertrag)

- **Ansicht 12 (Gastverwaltung):** „je Gast eine Skill-Stufe zuweisen“ ist laut Vertrag eine Aktion an der
  **Teilnahme** (E13); die Gastverwaltung zeigt Plätze und gibt sie frei (E15).
- **Ansichten 14 und 15** (Ergebniskorrektur, Hallenabsage) sind keine eigenen Seiten, sondern Abschnitte der
  Termin-Verwaltung: Beide handeln an **einem** Termin, und die nötigen Felder (`ergebnis.version`,
  `halleAbsageMoeglichBis`) kommen mit dessen Einzelansicht.
- **Ansicht 19 (Konfiguration)** nennt „Sitzungsdauern“; die Obergrenze wirkt nicht rückwirkend – der Hinweis
  steht am Feld (C7 1.1 Nr. 17).
- Diese Abweichungen sind dem Entwickler zur Übernahme in `DESIGN.md` vorzulegen (die Datei gehört nicht zum
  Client-Repository).

### 1.4 Offen für Server und Handprüfung

- **Hallenabsage:** versendet eine **echte E-Mail**. Vor jeder Handprüfung `halleEmail` auf ein **eigenes
  Testpostfach** stellen; den Hallenmodus danach wieder ausschalten und die Adresse zurücksetzen.
- **Leerlauf-Fenster unter drei Minuten:** Die Konfiguration erlaubt ab 1 Minute; der Ablauf-Dialog erschiene
  nach jedem Verlängern sofort wieder (Handoff 6.4). Die Maske warnt unter 5 Minuten (9.2); Mindestwert am
  Server bleibt Anfrage an den Server-Track.
- **Stufe einer Teilnahme nicht lesbar:** Weder `TeilnehmerEintrag` noch eine Adminliste liefert die
  Gast-Stufe je Termin. Anfrage an den Server, `stufe` für den Admin in die Teilnehmerliste aufzunehmen (E13
  käme dann ohne Rateversuch über den Gastplatz aus).
- **Gleichzeitige Admin-Sitzungen:** Es gibt genau einen Admin, aber mehrere Geräte sind möglich; die
  Versionsprüfung (E5) fängt das ab, die Handprüfung stellt es mit zwei Browsern nach.
- **Fenster der Terminliste:** Die Verwaltung erreicht Termine nur {VERLAUF_TAGE} Tage rückwärts (C7 8.2); ein älteres Ergebnis
  liesse sich nicht korrigieren. Ob das reicht, entscheidet der Betrieb (Konstante `VERWALTUNG_TAGE`, siehe C7 1.4).
- **C5-Handprüfung** (Abnahme 12, Nr. 3 und 4 der C5-Anleitung: Mindest- und Höchstzahl, Warteschlange) wird mit der
  Konfiguration (9.2) möglich.

---

## 2. Voraussetzungen aus C7

C8 baut auf folgendem Stand auf; vor Beginn prüfen, dass alles vorhanden und **grün** ist (`lint`, `typecheck`, `test`, `build`,
E2E):

- **Rahmen:** `ADMIN_PFADE` (mit `gaeste`, `konfiguration`, `teams`; deren Routen zeigen auf `<Platzhalter paket="C8">` und
  werden ersetzt), `Verwaltungsliste` mit den Einträgen „Gastplätze“, „Konfiguration“, „Teams ohne Termin“, `Bestaetigung`
  (C7 5.1), `useNavigationsHinweis`, `useSperre`.
- **Termine:** `adminTermine.ts` (Anlegen, Ändern, Absagen, Entfernen), `termineNeuLesen` (`src/hooks/admin/`), `TerminVerwaltung`
  mit den Abschnitten aus C7 8.4 (jeder Abschnitt ein eigener Baustein; C8 hängt „Gäste“, „Hallenabsage“, „Ergebnis“ ein),
  `TerminAnsicht` mit `nurLesen` und `ohneAktualisierung`, `TerminKarte` mit `ueberschriftRef` (Fokusziel nach Absage), der Hook
  `useTermin(terminId, 0)` (pollt nicht).
- **Profile:** `useProfile`, `useSkillKategorien`, `src/api/admin/skills.ts` (`skillsVollstaendig`), `SpielerDetails`.
- **Mocks und E2E:** `src/test/mocks/admin.ts` (`AdminWelt` mit Profilen, Skillkategorien und Terminen, `welt.fremdeAenderung()`,
  `adminHandler(welt)`), `e2e/hilfen/admin.ts` (`adminNachbilden`). C8 erweitert beides (3.4, 11.2).
- **Aus C5 (unverändert vorhanden):** `ErgebnisFormular`, `ErgebnisAnzeige`, `TeamsAnzeige`, `ergebnisText.ts`
  (`ergebnisSatz`), `ergebnisKorrigieren` samt Test in `admin.ts` (zieht in 10.2 nach `adminTermine.ts`), `useBegonnen`.
- **Datenzugriff und Hooks:** `aufrufen`, `ApiFehler`, `fehlertextBilden`, `queryClient` (Standardwerte: `staleTime` 30 s,
  `gcTime` 5 min, `refetchOnWindowFocus: true`, Wiederholung nur bei `5xx`, Mutationen nie); Schlüssel `adminProfile`,
  `adminSkills`; `sitzungFrist`.

---

## 3. Datenzugriff und Mocks (Stufen 4 und 5; je Stufe nur die eigenen Funktionen)

Alle Funktionen sind dünn: Pfad, Methode, Körper, JSDoc mit Rolle, Fehlercodes und Folgen (wie `auth.ts`).
**Keine trägt `keinRefresh`:** Admin-Lesen ohne Kopf (E4), alle Schreibaufrufe ohne Kopf.

### 3.1 API-Funktionen

**`src/api/admin/adminKonfiguration.ts`** (Stufe 4): `konfigurationLesen`, `konfigurationAendern(anfrage)` (204),
`gastplaetzeLesen`, `gaesteFreigeben`. Der Körper von `gaesteFreigeben` ist **eine Union**, damit „beide“ und
„keines“ nicht übersetzbar sind:

```ts
export type GaesteFreigabe = { slotIds: number[] } | { alle: true }
```

**`src/api/admin/adminTeams.ts`** (Stufe 5): `teamsManuellGenerieren({ spielerIds, gaeste })` ⇒ `ManuelleEinteilung`
(Status `200`, Rumpf). Typen `ManuelleGenerierung`, `GastAuswahl`, `ManuelleEinteilung` aus dem Schema.

**`src/api/admin/adminTermine.ts`** (Datei aus C7; Ergänzungen):
`gastStufeAendern({ terminId, gastName, stufe })` (204; Stufe 4), `halleAbsagen(terminId)` (204; Stufe 5),
`ergebnisKorrigieren` (204; Stufe 5, **zieht aus `admin.ts` hierher** mitsamt Typ `ErgebnisKorrektur` und Test, `admin.test.ts`
und der Mock folgen, E3).

### 3.2 Schlüssel (`schluessel.ts`)

```ts
adminKonfiguration: ['admin', 'konfiguration'] as const,
adminGaeste: ['admin', 'gaeste'] as const,
```

(`adminProfile` und `adminSkills` stehen seit C7.) Die manuelle Generierung bekommt **keinen** Schlüssel: Ihr Ergebnis lebt im
Zustand der Seite (E18), nicht im Cache. Ein Cache-Eintrag liesse sie bei der nächsten Abfrage mit gleichem Schlüssel wieder
auftauchen.

### 3.3 Fehlercodes der Aufrufe (Reaktion der Oberfläche)

`401 SESSION_UNGUELTIG` beendet überall die Sitzung (global, `istSitzungsende`); `403` und unbekannte Codes
laufen über `fehlertextBilden`. `400 EINGABE_UNGUELTIG` trägt `felder` (am jeweiligen Feld anzeigen), sonst die
Meldung des Servers im Kasten. Die Tabelle nennt nur das Besondere:

| Aufruf | Status / Code | Reaktion |
|---|---|---|
| Gast-Stufe | `404 INHALT_NICHT_GEFUNDEN` | „Für diesen Termin liegt keine Teilnahme dieses Gastes vor.“ (Name zeichengenau), Dialog bleibt, Liste neu lesen |
| Ergebnis korrigieren | `409 DATEN_VERALTET` | E5 |
| | `404` | „Für diesen Termin liegt kein Ergebnis vor.“, neu lesen |
| Halle absagen | `409 HALLE_MODUS_INAKTIV` | „Der Hallenmodus ist abgeschaltet.“, Konfiguration neu lesen (Abschnitt verschwindet) |
| | `409 HALLE_FRIST_ABGELAUFEN` | `detail` des Servers nennt Vorlauf und Zeitpunkt; Aktion deaktivieren |
| | `409 HALLE_NICHT_KONFIGURIERT` | „Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.“, Link zur Konfiguration |
| | `409 HALLE_BEREITS_ABGESAGT` | **kein Fehler:** „Die Absage ist schon raus.“ mit Zeitpunkt (`halleAbgesagtAm` nach dem Neulesen) |
| | `409 TERMIN_GESCHLOSSEN` | „Der Termin ist abgeschlossen.“ |
| | `503 VERSAND_FEHLGESCHLAGEN` | „Die E-Mail konnte nicht gesendet werden. Es wurde nichts verändert; du kannst es erneut versuchen.“ |
| Konfiguration ändern | `409 DATEN_VERALTET` | E5 |
| | `400` | `felder` je Feld; `maxTeilnehmer` kleiner `minTeilnehmer`: Text am Höchstfeld |
| Gäste freigeben | `400` | Kasten (unbekannte Nummer); die Liste wird neu gelesen |
| Teams manuell | `409 ZU_WENIG_TEILNEHMER` / `ZU_VIELE_TEILNEHMER` | `detail` des Servers im Kasten über der Auswahl |
| | `409 SKILLWERTE_UNVOLLSTAENDIG` | `detail` nennt die Namen; Link „Profile“ |
| | `409 PROFIL_GESCHUETZT`, `400` | Auswahl wurde verfälscht (Profil inzwischen gesperrt): Profile neu lesen, Text |

### 3.4 Mocks (`src/test/mocks/admin.ts`, Erweiterung)

- `AdminWelt` bekommt **Konfiguration** (mit `version`, steigt bei jedem Schreiben; `409 DATEN_VERALTET` bei Abweichung),
  **Gastplätze** (belegt, verwaist, unwirksam), die **`version` des Ergebnisses** (`ergebnis.version`) und `halleAbsageMoeglichBis`
  (Zeitstempel) samt `halleAbgesagtAm`. `adminHandler(welt)` liefert nun alle 22 Handler.
- Nachgebildet, soweit die Tests es brauchen: `HALLE_MODUS_INAKTIV` (**auch für unbekannte Termine**, siehe Fallen),
  `HALLE_FRIST_ABGELAUFEN`, `HALLE_NICHT_KONFIGURIERT`, `HALLE_BEREITS_ABGESAGT`, `503 VERSAND_FEHLGESCHLAGEN` (über
  `welt.mailFehler = true`), `ZU_WENIG_TEILNEHMER`/`ZU_VIELE_TEILNEHMER`, `SKILLWERTE_UNVOLLSTAENDIG`, `PROFIL_GESCHUETZT`
  für gesperrte Profile, Freigabe mit `slotIds` und `alle`.
- `welt.fremdeAenderung()` (aus C7) wird um Konfiguration und Ergebnis erweitert: erhöht deren `version` ohne Oberfläche
  (E5-Tests, 11.1).
- Die Kategorien und ihre Schlüssel sind Beispiele aus C7; Code und Tests setzen sie nicht voraus.

---

## 4. Gemeinsame Regeln und Hooks

### 4.1 Lesen und Schreiben im Admin (Ergänzung zu C7 4.1)

- **Lesehooks** `useKonfiguration` und `useGastplaetze` rufen **ohne** Kopf, **ohne** `refetchInterval`, mit
  `refetchOnWindowFocus: false`. `useKonfiguration` zusätzlich `gcTime: 0`: Jeder Besuch lädt frisch, ein Cache-Stand aus dem
  letzten Besuch setzte sonst ein Formular auf einen alten Wert und erzeugte beim Eintreffen des neuen einen Neuaufbau (E5).
  `useGastplaetze` wird für den Dialog der Gast-Stufe mit `enabled` erst bei geöffnetem Dialog geladen (9.4).
- **Schreibhooks** (`useMutation` ohne Wiederholung, ohne Kopf; die JSDoc nennt, was nach Erfolg neu gelesen wird):

  | Hook (Datei in `src/hooks/admin/`) | Aufruf | liest nach Erfolg neu |
  |---|---|---|
  | `useHalleAbsagen`, `useErgebnisKorrigieren` | 3.1 | Termine (`termineNeuLesen`, C7 4.1); `useErgebnisKorrigieren` zusätzlich `schluessel.bilanz` |
  | `useGastStufe` | | `terminAlle`, `adminGaeste` |
  | `useKonfigurationAendern` | | `adminKonfiguration`, Termine (Mindest-/Höchstzahl wirken auf `wartet` und Balken), `sitzungFrist` (neues Leerlauf-Fenster zeigt sich sofort) |
  | `useGaesteFreigeben` | | `adminGaeste` |
  | `useTeamsManuell` | | nichts (Ergebnis nur im Hook-Zustand) |

- **`DATEN_VERALTET`** (E5) folgt dem Muster aus **C7 4.2**; dort ist die Konfiguration das Beispiel. `useKonfigurationAendern`
  liest bei `DATEN_VERALTET` sofort neu (`onError`).
- **`mutateAsync` mit `try`/`catch`, Fokus gezielt setzen, Uhr nie im Render:** wie C7 4.1 und 4.3; Fristen über
  `useZeitpunktErreicht` (5.5).

---

## 5. Gemeinsame Bausteine

Jeder Baustein: Komponente, `module.scss` (nur Tokens, kein Hexwert), Test, JSDoc mit Begründung. Die Nummern 5.5, 5.8 und 5.9
entsprechen der Gesamtanleitung; 5.1 bis 5.4, 5.6 und 5.7 stehen in C7.

### 5.5 `useZeitpunktErreicht` (Stufe 5)

`useBegonnen` verallgemeinern, **ohne** sein Verhalten zu ändern (Tests bleiben grün):

```ts
/** `true`, sobald der Zeitpunkt (ms seit 1970) erreicht ist; schaltet von selbst um, ohne Uhr im Render. */
export function useZeitpunktErreicht(zeitpunkt: number | undefined): boolean { /* Körper von useBegonnen */ }

export function useBegonnen(termin: Pick<TerminUebersicht, 'datum' | 'uhrzeit'> | undefined): boolean {
  return useZeitpunktErreicht(termin ? beginnVon(termin).getTime() : undefined)
}
```

### 5.8 `StufeWahl` (Stufe 4)

Radiogruppe `Stark`/`Mittel`/`Schwach` (Werte `STARK`/`MITTEL`/`SCHWACH`), Gruppenbeschriftung als `fieldset`/
`legend`; Eingaben `wert: GastStufe | null`, `beiAenderung`; ohne Vorauswahl bleibt `wert` `null` (Pflichtwahl,
Bestätigen gesperrt). Wiederverwendet im Dialog der Gast-Stufe (9.4) und in den Gastzeilen der manuellen
Generierung (10.3, dort mit `MITTEL` vorbelegt und sichtbar).

### 5.9 `ErgebnisEingabe`, `TeamListen` (Stufe 5, Herauslösen)

- `ErgebnisEingabe`: Radiogruppe „Wer hat gewonnen?“ und Haken „Deutlicher Sieg“ aus `ErgebnisFormular`
  herausgelöst (controlled: `sieger`, `deutlich`, `beiAenderung`, `deaktiviert`); die Logik „bei `U` Haken gesperrt
  und zurückgesetzt, Grund `ergebnis-deutlich-grund`“ zieht mit um, **mit ihren Tests**. `ErgebnisFormular` ruft
  den Baustein; **seine 14 Tests bleiben unverändert grün** (Prüfstein des Herauslösens).
- `TeamListen`: die beiden Teamspalten (Namen, „(Gast)“, „(du)“ optional, Auswechselspieler als Text mit Symbol,
  keine Rangfolge) aus `TeamsAnzeige` herausgelöst; `TeamsAnzeige` behält Kopf, „veraltet“-Hinweis und Fokusziel
  und ruft `TeamListen`; die Tests von `TeamsAnzeige` bleiben unverändert grün.

---

## 9. Stufe 4 – Konfiguration, Gastplätze und Skill-Stufe eines Gastes (10,5 h)

### 9.1 Datenzugriff, Hooks, Mocks (ca. 1,0 h)

`adminKonfiguration.ts` (3.1), Hooks `useKonfiguration` (`gcTime: 0`, 4.1), `useKonfigurationAendern`, `useGastplaetze`,
`useGaesteFreigeben`, `useGastStufe` mit `gastStufeAendern` in `adminTermine.ts` (3.1); Mock-Welt mit `version` der Konfiguration,
Gastplätzen und `welt.fremdeAenderung()` (3.4).

### 9.2 Konfiguration `/admin/konfiguration` (`AdminKonfiguration`, ca. 3,5 h)

Ein Formular, sechs Gruppen (`fieldset`/`legend`), `Aktionsleiste` mit „Speichern“ (`admin-konfig-speichern`, gesperrt
ohne Änderung). Der Formularzustand besteht aus **Texten** (leer ist ein Zustand); die Umwandlung geschieht in
**einer** Funktion:

```ts
export function konfigurationAnfrage(form: KonfigurationForm, version: number): KonfigurationAnfrage {
  return {
    version,
    minTeilnehmer: Number(form.minTeilnehmer),
    maxTeilnehmer: Number(form.maxTeilnehmer),
    anzGuests: Number(form.anzGuests),
    algorithmType: form.algorithmType,
    auswechselModus: form.auswechselModus,
    anzTeamGenerator: Number(form.anzTeamGenerator),
    sessionLeerlaufMinuten: Number(form.sessionLeerlaufMinuten),
    sessionMaximalStunden: Number(form.sessionMaximalStunden),
    halleEmail: form.halleEmail.trim() === '' ? null : form.halleEmail.trim(),
    halleAbsageVorlage: form.halleAbsageVorlage.trim() === '' ? null : form.halleAbsageVorlage,
    halleVorlaufStunden: Number(form.halleVorlaufStunden),
    hallenModusAktiv: form.hallenModusAktiv,
    pushAktiv: form.pushAktiv,
    pushErinnerungStunden: Number(form.pushErinnerungStunden),
  }
}
```

Der Rückgabetyp `KonfigurationAnfrage` (= `KonfigurationAendernRequest`) verhindert, dass ein Pflichtfeld fehlt; ein
Test hält **genau diese 15 Schlüssel** fest und dass `halleAbsageVorlageEffektiv` und `geaendertAm` **nie** darin
vorkommen.

| Gruppe | Feld | Eingabe | Prüfung im Client | Hinweis am Feld |
|---|---|---|---|---|
| Teilnehmer | `minTeilnehmer` | Zahl | ganze Zahl ≥ 1 | „Darunter kommt ein Termin nicht zustande (Balken rot).“ |
| | `maxTeilnehmer` | Zahl | ≥ `minTeilnehmer` | „Darüber greift die Warteschlange.“ |
| Gäste | `anzGuests` | Zahl | 0 bis 22 | „Gleichzeitig angemeldete Gäste. Eine Senkung meldet niemanden ab.“ |
| Team-Generator | `algorithmType` | `Auswahlliste` | – | „Exakt (bis 22 Teilnehmer) oder schnell (nah am Optimum).“ |
| | `anzTeamGenerator` | Zahl | ≥ 1 | „Läufe je Person und Spieltag; ändert sich der Teilnehmerkreis, steht das Kontingent wieder zur Verfügung.“ |
| | `auswechselModus` | `Auswahlliste` | – | „Wer bei ungerader Zahl aussetzt: der Schwächste oder der zuletzt angemeldete Spieler des grösseren Teams.“ |
| Sitzung | `sessionLeerlaufMinuten` | Zahl | 1 bis 1440 | „Wirkt sofort, auch für bestehende Sitzungen.“ **Unter 5 Minuten** zusätzlich nicht sperrend: „Der Ablauf-Dialog erscheint dann fast ununterbrochen.“ |
| | `sessionMaximalStunden` | Zahl | 1 bis 24 | „Gilt nur für neue Sitzungen; bestehende behalten ihre Obergrenze.“ |
| Halle | `hallenModusAktiv` | Haken | – | „Ausgeschaltet, bis du ihn einschaltest. Eine versandte Absage lässt sich nicht zurücknehmen.“ |
| | `halleEmail` | `Feld` `type="email"` | leer oder gültige Adresse, ≤ 120 | „Leer lassen, wenn keine hinterlegt ist.“ |
| | `halleVorlaufStunden` | Zahl | ganze Zahl ≥ 0 | „Bis so viele Stunden vor dem Termin ist die Absage möglich (0 = bis zum Anpfiff).“ |
| | `halleAbsageVorlage` | Textbereich | – | „Leer lassen für den Standardtext.“ Darunter schreibgeschützt der **tatsächliche** Text (`halleAbsageVorlageEffektiv`): „So lautet der Text, der versendet würde.“ |
| Benachrichtigungen | `pushAktiv` | Haken | – | „Erinnerung an offene Rückmeldungen und Terminabsage. Jede Person kann für sich abschalten.“ |
| | `pushErinnerungStunden` | Zahl | 1 bis 168 | „So viele Stunden vor dem Termin wird erinnert.“ |

- **Neuer Baustein `Textbereich`** (`textarea`, analog `Feld`: Beschriftung, Hinweis, Fehler, `beschriebenDurch`), ca. 0,25 h
  inbegriffen; `Feld` kann kein mehrzeiliges Feld.
- Eingaben werden **nicht** während des Tippens beanstandet, sondern beim Verlassen des Feldes und beim Senden
  (Fehlertext am Feld, Fokus auf das erste fehlerhafte); Serverfehler `400` mit `felder` am Feld.
- **E5 und Voll-Update:** `key={konfiguration.version}`; Hook `gcTime: 0`; bei `DATEN_VERALTET` Hinweis
  „Die Konfiguration wurde zwischenzeitlich geändert. Der aktuelle Stand ist geladen, deine Eingaben wurden
  zurückgesetzt.“ Nach Erfolg `Hinweis` „Gespeichert.“.
- **Wirkung auf andere Ansichten** (4.1): Termine neu lesen, `sitzungFrist` neu lesen.
- **Nicht in dieser Maske:** Zentrale PIN und Anmeldename (Zugang, C7 6.3/6.4), Push-Probeversand (C9).

### 9.3 Gastplätze `/admin/gaeste` (`AdminGaeste`, ca. 1,5 h)

- `h1` „Gastplätze“; Zusammenfassung „n von m Plätzen belegt“ (m = Zahl der **wirksamen** Plätze, n = belegte).
  **Aufgelistet werden die belegten Plätze** (auch unwirksame), freie nur in der Zusammenfassung.
- Zeile je belegtem Platz: „Platz {nummer}“, `gastName`, Stufe als Text (Stark/Mittel/Schwach), „seit {zeitpunktKurz}“,
  Zustand als **Text mit Symbol**: „angemeldet“ (`sitzungGueltig`) oder „Sitzung abgelaufen“ (verwaist, **Freigabe
  gefahrlos**), bei `!wirksam` zusätzlich „wird nicht mehr vergeben“.
- Aktionen: „Freigeben“ je Platz; bei lebender Sitzung `Bestaetigung` „{Name} wird sofort abgemeldet.“, bei
  verwaistem Platz **ohne Dialog**. „Verwaiste freigeben (n)“ (nur sichtbar bei n > 0, **ohne Dialog**, sendet
  `{ slotIds }` der verwaisten). **Kein** „Alle freigeben“ (E15, `alle: true` bleibt ungenutzt, aber in der Union).
- Fehler/Leer: „Zurzeit ist kein Gastplatz belegt.“ (`Leerzustand`), `Fehlerzustand` mit „Erneut versuchen“.
- Lesen ohne Polling; „Aktualisieren“ als sekundäre Schaltfläche (`admin-gaeste-aktualisieren`) – der Zustand
  ändert sich ohne Zutun des Admins.
- Hinweis unter der Liste: „Die Stufe eines Gastes ändert sich je Termin, unter Termine → Termin → Gäste.“ mit Link zu
  `termine`.

### 9.4 Skill-Stufe eines Gastes (`GastStufeListe`, ca. 0,75 h)

- Nur bei `GEPLANT` und mindestens einem Eintrag mit `gast === true` in `teilnehmerliste.teilnehmer`. Abschnitt
  „Gäste“ mit einer Zeile je Gast: Name mit „(Gast)“, Hinweis „wartet“ bei `wartet`, Schaltfläche „Stufe ändern“
  (`admin-gast-stufe-<position>`).
- Der Abschnitt hängt als eigener Baustein in `TerminVerwaltung` (C7 8.4, Tabelle: nach „Termin ändern“).
- Dialog (`Bestaetigung`, `art="primaer"`) mit `StufeWahl` (5.8): **Vorauswahl nur**, wenn `useGastplaetze()` (erst bei
  geöffnetem Dialog geladen, `enabled`) einen belegten Platz mit **gleichem** `gastName` zeigt; sonst Text „Die
  aktuelle Stufe liegt nicht vor. Bitte wähle eine.“ ohne Auswahl; „Speichern“ gesperrt ohne Wahl.
- Aufruf `gastStufeAendern({ terminId, gastName: eintrag.anzeigeName, stufe })` – der Name geht **unverändert** hinaus,
  ohne „(Gast)“ und ohne Trimmen (der Server vergleicht zeichengenau).
- Text im Dialog: „Die Änderung zählt als Änderung des Teilnehmerkreises: Eine vorhandene Teameinteilung gilt danach
  als veraltet, das Kontingent steht wieder zur Verfügung.“ (A15)
- `404 INHALT_NICHT_GEFUNDEN`: Text im Dialog, Termin neu lesen (der Gast hat sich inzwischen abgemeldet/ist
  entfernt).

### 9.5 Tests und Abnahme der Stufe 4

Siehe 11 und 12 (Nr. 3 bis 6).

---
## 10. Stufe 5 – Hallenabsage, Ergebniskorrektur, manuelle Teamgenerierung (11,0 h)

### 10.1 Hallenabsage (`TerminHalle`, ca. 1,75 h inkl. `useZeitpunktErreicht`, 5.5)

Abschnitt „Hallenabsage“ der Verwaltungsansicht (C7 8.4). Quellen: `useTermin(terminId, 0)` (`halleAbsageMoeglichBis`,
`halleAbgesagtAm`, `status`) und `useKonfiguration()` (`hallenModusAktiv`, `halleEmail`).

| Zustand | Anzeige |
|---|---|
| `halleAbgesagtAm` gesetzt (jeder Status) | „Die Absage an die Halle wurde am {zeitpunktKurz} versandt.“, keine Aktion |
| sonst `ABGESCHLOSSEN` | Abschnitt nicht sichtbar |
| sonst `hallenModusAktiv = false` | Abschnitt nicht sichtbar („der Knopf gehört dann ausgeblendet“) |
| sonst Frist erreicht (`useZeitpunktErreicht(Date.parse(halleAbsageMoeglichBis))`) | „Die Frist für die Hallenabsage ist abgelaufen (sie lief bis {zeitpunktKurz}).“; Aktion `aria-disabled`; Satz „Den Termin kannst du weiterhin absagen; die Halle informierst du dann selbst.“ |
| sonst `halleEmail` leer | „Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.“ mit Link zur Konfiguration; Aktion `aria-disabled` |
| sonst | „Absage möglich bis {zeitpunktKurz}.“ und Aktion „Halle per E-Mail absagen“ (`admin-halle-absagen`, `art="gefahr"`) |

- **Dialog** (`Bestaetigung`): „Die Absage geht **sofort** per E-Mail an den Hallenbetreiber und lässt sich nicht
  zurücknehmen. Der Termin wird dabei ebenfalls abgesagt.“; Bestätigung „Absage senden“. Während der Mutation
  `laedt` (Doppelklick-Schutz; der Server entscheidet ohnehin in der Datenbank).
- Fehler wie 3.3; **`HALLE_BEREITS_ABGESAGT` ist kein Fehler**: Dialog schliesst, nach dem Neulesen steht „Die Absage ist
  schon raus.“ mit dem Zeitpunkt. **`503`**: „Die E-Mail konnte nicht gesendet werden. Es wurde nichts verändert; du
  kannst es erneut versuchen.“ – der Dialog bleibt offen, kein automatischer Wiederholungsversuch.
- Nach Erfolg: Termin ist `ABGESAGT`, die übrigen Aktionen verschwinden; Fokus auf die Überschrift der `TerminKarte`
  (`ueberschriftRef`, C7 8.5).
- `aria-disabled` statt `disabled`, mit Grund als Text (C5-Muster); Playwright klickt mit `force: true`.
- **Handprüfung nur mit Testpostfach** (1.4).

### 10.2 Ergebniskorrektur (`TerminErgebnis`, ca. 2,25 h inkl. Herauslösen `ErgebnisEingabe`, 5.9)

Abschnitt „Ergebnis“ bei `ABGESCHLOSSEN`:

- **Mit `ergebnis`:** `ErgebnisAnzeige` (mit Fokusziel) und, falls `korrigiertAm` gesetzt, die Zeile „Zuletzt korrigiert am
  {zeitpunktKurz}.“; Schaltfläche „Ergebnis korrigieren“ (`admin-ergebnis-korrigieren`) klappt das Formular auf.
- **Formular** (`ErgebnisKorrekturFormular`): `ErgebnisEingabe` mit dem aktuellen Stand vorbelegt; Speichern
  (`admin-ergebnis-speichern`) gesperrt, solange `sieger` und `deutlich` unverändert sind (E17); Bei `U` ist der Haken
  gesperrt und zurückgesetzt (Regel aus C5, jetzt in `ErgebnisEingabe`). `Bestaetigung`: „Ergebnis ändern von
  „{ergebnisSatz(alt)}“ auf „{ergebnisSatz(neu)}“? Die Bilanz der beteiligten Spieler wird angepasst.“ (`ergebnisSatz` aus
  `ergebnisText.ts`).
- Aufruf `ergebnisKorrigieren({ terminId, sieger, deutlich: sieger === 'U' ? false : deutlich, version: ergebnis.version })`;
  `deutlich` bei `U` immer `false` (C5-Falle).
- **E5:** `key={ergebnis.version}`, Mutation im Elternbaustein, `DATEN_VERALTET` ⇒ Neulesen, Text „Das Ergebnis wurde
  zwischenzeitlich korrigiert. Der aktuelle Stand ist geladen; deine Eingaben wurden zurückgesetzt.“ **(Neu laden und
  erneut speichern, nicht „Eingabe falsch“.)**
- Erfolg: Formular klappt zu, `Hinweis` „Ergebnis korrigiert.“ (`role="status"`), Fokus auf die Überschrift der Anzeige,
  Bilanz-Abfragen ungültig (`schluessel.bilanz`: die Bilanz der Spieler hat sich geändert; beobachtet sie dieses Gerät
  nicht, ist das ohne Wirkung).
- **Ohne `ergebnis`:** `Hinweis` „Für diesen Termin wurde noch kein Ergebnis erfasst. Das erfassen die Spieler.“; ist
  `teams === null`, zusätzlich „Es liegt keine Teameinteilung vor; ohne sie kann kein Ergebnis erfasst werden.“ Der
  Admin erfasst in C7 kein Ergebnis (A21 sieht das Erfassen durch die Teilnehmer und die Korrektur durch den Admin
  vor); ob `POST /ergebnis/erfassen` für ADMIN zulässig wäre, steht nicht im Vertrag.
- `ergebnisKorrigieren` und `ErgebnisKorrektur` ziehen von `admin.ts` nach `adminTermine.ts`; `admin.test.ts` und
  der Mock folgen (E3).

### 10.3 Manuelle Teamgenerierung `/admin/teams` (`AdminTeams`, ca. 3,0 h inkl. Herauslösen `TeamListen`, 5.9)

- `h1` „Teams ohne Termin“; **dauerhafter** Hinweis (`teams-manuell-hinweis`, `Hinweis`): „Die Einteilung wird nicht
  gespeichert, löst keine Einteilung eines Termins ab und ist für niemanden sonst sichtbar. Sie ist weg, sobald du die
  Seite verlässt.“ Er steht **oberhalb der Auswahl und bei jedem Ergebnis** (E18).
- **Spielerprofile** (`fieldset`/`legend`): Checkboxen der Profile mit `rolle: USER` und `aktiv: true` aus `useProfile()`;
  Zeilen mit Tap-Ziel ≥ 44 px; **Profile mit unvollständiger Skillkarte** (E7) sind **deaktiviert** mit dem Grund
  „Skillwerte unvollständig“ (sonst `409 SKILLWERTE_UNVOLLSTAENDIG`). „Alle auswählen“ / „Keine“ als Textlinks. Keine
  Skillwerte in der Zeile.
- **Gäste:** „Gast hinzufügen“ fügt eine Zeile (Name optional, 40 Zeichen, Hinweis „Ohne Namen heisst der Gast Gast 1, Gast
  2 …“; `StufeWahl` mit `MITTEL` **vorbelegt und sichtbar**; „Entfernen“). Der Name geht getrimmt hinaus, leer ⇒
  weggelassen.
- **Zähler:** „Ausgewählt: {n}. Erlaubt: {min} bis {max}.“ (`useKonfiguration`: `minTeilnehmer`, `maxTeilnehmer`);
  „Teams berechnen“ (`admin-teams-berechnen`) `aria-disabled` ausserhalb des Bereichs mit Grund als Text; der Server
  (`409 ZU_WENIG_TEILNEHMER`/`ZU_VIELE_TEILNEHMER`) bleibt die Wahrheit.
- **Ergebnis** (`ManuelleEinteilung`, Fokus auf seine Überschrift `h2`):
  - `TeamListen` (5.9), Auswechselspieler als Text mit Symbol (Namen aus `auswechselspieler`).
  - „Gerechnet mit: {Verfahren}.“ **Stimmt es nicht mit der Konfiguration überein**, der Satz „Abweichend von der
    Einstellung, weil die Gruppe für das exakte Verfahren zu gross ist.“ (Vertrag: oberhalb von 24 Teilnehmern).
  - „Auswechselspieler nach der Regel: {Regel}.“ Stimmt `auswechselModus` nicht mit der Konfiguration überein: „Für
    diese Berechnung gibt es keine Anmeldereihenfolge; es gilt der schwächste Spieler des grösseren Teams.“
  - „Ungleichgewicht: {Zahl}“ (`toLocaleString('de-DE', { maximumFractionDigits: 2 })`) mit Erklärung „0 heisst
    vollständig ausgeglichen, grösser ist schlechter. Es ist die gewichtete Summe der Unterschiede je Kategorie, nicht
    der Unterschied der Gesamtstärken.“ **Nur hier** (A12).
- **Ändert sich die Auswahl, verschwindet das Ergebnis** (`mutation.reset()`): Es zeigt nie eine andere Gruppe als die
  ausgewählte. „Erneut berechnen“ ist derselbe Aufruf (ein Lauf mit `HEURISTIK` liefert je Seed ein anderes Ergebnis).
- Fehler (3.3) als `Fehlermeldung` über der Auswahl; `detail` des Servers im Text.
- Kein Blocker beim Verlassen der Seite (E18).

### 10.4 Tests und Abnahme der Stufe 5

Siehe 11 und 12 (Nr. 7 bis 11).

---

## 11. Tests (über die Stufen verteilt; Anteile im Zeitplan, 15)

### 11.1 Unit (Vitest, MSW, echter `queryClient`)

- **API** (je Funktion: Pfad, Methode, Körper): **keine** der acht Funktionen und kein Lesehook sendet `X-FuBo-Kein-Refresh`;
  `gaesteFreigeben` sendet entweder `{ slotIds }` oder `{ alle: true }`, nie beides; `gastStufeAendern` sendet `gastName`
  **unverändert** (ohne Trimmen, ohne „(Gast)“).
- **Reine Funktionen:**
  - `konfigurationAnfrage`: **genau die 15 Schlüssel**, `halleAbsageVorlageEffektiv`/`geaendertAm` nie dabei, leere
    Texte ⇒ `null` (nur Leerraum in der Vorlage ebenfalls), Zahlen als Zahlen, Schalter unverändert.
  - Konfigurationsprüfung: `maxTeilnehmer < minTeilnehmer`, `anzGuests` 23, `sessionLeerlaufMinuten` 0 und 1441, `halleEmail`
    ohne `@`, `pushErinnerungStunden` 169, `halleVorlaufStunden` −1; die Warnung unter 5 Minuten sperrt **nicht**.
  - `useZeitpunktErreicht` mit Fake-Timern (schaltet um, ohne Re-Render durch Polling) und `useBegonnen` **unverändert**.
- **Hooks:** Lesehooks rufen einmal und pollen nicht (60 s Fake-Zeit ⇒ ein Abruf); jede Mutation liest ihre Gruppe aus 4.1 neu
  (**mit beobachteter Abfrage daneben**, sonst lädt `invalidateQueries` nichts neu) und bleibt bis dahin `pending`; kein
  zweiter Versuch bei `500`; `useKonfigurationAendern` liest bei `DATEN_VERALTET` neu.
- **Bausteine:** `StufeWahl` (ohne Vorauswahl gesperrt), `Textbereich`, `ErgebnisEingabe` (die Regeln aus C5 und **alle 14 Tests
  von `ErgebnisFormular` unverändert grün**), `TeamListen` (die Tests von `TeamsAnzeige` unverändert grün).
- **Seiten** (je Zustand: laden, leer, Fehler, Normalfall, jeder Fehlercode aus 3.3):
  - `AdminTerminDetail`, soweit C8 Abschnitte beisteuert: Gast-Stufe mit und ohne Vorauswahl; `TerminHalle` **für jede Zeile
    der Tabelle in 10.1**; Ergebniskorrektur mit `deutlich = false` bei `U`.
  - `AdminKonfiguration` (sechs Gruppen, Speichern erst nach Änderung, Validierung, Warnung unter 5 Minuten),
    `AdminGaeste` (verwaist ohne Dialog, lebend mit Dialog, `slotIds` der verwaisten), `AdminTeams` (deaktivierte
    unvollständige Profile, Zähler und Sperre, Ergebnis verschwindet bei geänderter Auswahl, Abweichungssätze, Hinweis
    „nicht gespeichert“, **keine Skillwerte ausser `differenzTeamstaerke`**).
- **E5 für Konfiguration und Ergebniskorrektur:** Mit `welt.fremdeAenderung()` die `version` erhöhen, speichern, `409` ⇒ das
  Formular zeigt den **frischen** Stand und den Text; ein zweites Speichern sendet die **neue** `version` nur nach neuer Eingabe.
- **Routen:** `/admin/konfiguration`, `/admin/gaeste`, `/admin/teams` zeigen die Seiten statt des Platzhalters; Nicht-Admin ⇒ `/`;
  ohne Sitzung ⇒ Anmeldung.

### 11.2 E2E (Playwright, drei Chromium-Projekte lokal, alle sieben im CI)

Der Helfer `e2e/hilfen/admin.ts` (`adminNachbilden`, C7) wird um Konfiguration, Gastplätze, Halle, Ergebnis und die manuelle
Generierung erweitert (zustandsbehaftet, liefert Zähler und gesendete Körper).

| Spezifikation | Inhalt |
|---|---|
| `admin-konfiguration.spec.ts` | Speichern sendet **15 Schlüssel** (Anfrage abfangen); Konflikt; Warnung unter 5 Minuten |
| `admin-gaeste-teams.spec.ts` | Freigabe verwaist/lebend; Gast-Stufe im Termin (mit und ohne Vorauswahl); manuelle Generierung mit Hinweis, Abweichungssatz, Zurücksetzen bei geänderter Auswahl |
| `admin-halle-ergebnis.spec.ts` | Hallenabsage (Zustände, „schon raus“, Frist); Ergebniskorrektur samt Konflikt |

- **Layout:** Die Schleife über alle Admin-Pfade (360 px ohne waagerechte Bildlaufleiste, Tap-Ziele mindestens 44 px, sticky
  `Aktionsleiste` verdeckt keine Eingabe) aus C7 umfasst nun auch `konfiguration`, `gaeste`, `teams` und die Termin-Verwaltung mit
  allen Abschnitten (Fensterhöhen unter 740 px beobachten; die Grenze nicht ohne Anlass verschieben).
- `aria-disabled`-Aktionen: `click({ force: true })` (C5-Falle).
- Die Cloud-Kopie wie in C5 für Chromium; WebKit nur im CI.

### 11.3 Gegenproben (Test rot ohne Absicherung)

Wie in C5 und C7 (Skript mit Ergebnisprüfung auf „failed“, nicht auf die letzte Zeile): Je Mutation muss mindestens ein Test rot
werden; gleichwertige Mutanten werden benannt, nicht gezählt. Die Nummern entsprechen der Gesamtanleitung (M2 bis M5, M8 bis M10
und M14 stehen in C7).

| Nr. | Mutation | Erwartung |
|---|---|---|
| M1 | `konfigurationAnfrage` lässt `hallenModusAktiv` weg | Mapper-Test und E2E (15 Schlüssel) rot |
| M6 | `TerminHalle` ohne Prüfung von `hallenModusAktiv` | Zustandstest rot |
| M7 | `HALLE_BEREITS_ABGESAGT` wird als Fehler gezeigt | Test rot |
| M11 | `deutlich` bei `U` nicht auf `false` gesetzt | Test rot |
| M12 | Ergebnis der manuellen Generierung bleibt nach Auswahländerung | Seitentest rot |
| M13 | `gaesteFreigeben` sendet `alle: true` für „Verwaiste freigeben“ | API-/Seitentest rot |
| M3 | `key={version}` an Konfiguration oder Ergebniskorrektur entfernt (E5) | E5-Tests rot |

---

## 12. Abnahme von C8

1. `npm run lint`, `typecheck`, `test`, `build`; **ein** `fetch(`; kein Hexwert ausserhalb der Tokendatei; Suche nach verwaisten
   Pfaden (`AGENT_CLIENT.md`); `grep` nach `skills`/`differenzTeamstaerke` ausserhalb von `AdminProfilFormular`, `AdminTeams`,
   `adminProfile.ts`, `adminTeams.ts` und den Mocks: **kein Treffer in Spieleransichten**; kein `Platzhalter` mehr für `gaeste`,
   `konfiguration`, `teams`.
2. E2E in den drei Chromium-Projekten lokal, alle sieben im CI (Layout bei Fensterhöhen unter 740 px beobachten).
3. **Gast-Stufe:** Gast (zweites Gerät) sagt zu; Admin ändert die Stufe; die Einteilung ist `veraltet`; falscher Name ⇒
    Text; Vorauswahl entspricht dem Gastplatz.
4. **Konfiguration:** alle Felder speichern und nachlesen; Wirkung prüfen (`minTeilnehmer` ⇒ Balken, `maxTeilnehmer` auf 2
    ⇒ Warteschlange – **damit die C5-Handprüfung Nr. 3/4 nachholen** –, `anzTeamGenerator`, `sessionLeerlaufMinuten` sofort,
    `sessionMaximalStunden` nicht rückwirkend); `halleEmail` leeren ⇒ `null`; Vorlage leeren ⇒ der effektive Text zeigt
    die Ersatzvorlage; zwei Browser ⇒ Konflikt. **Werte danach zurücksetzen.**
5. **Gastplätze:** zwei Gäste anmelden ⇒ Liste; Leerlauf kurz stellen, einen Gast ablaufen lassen ⇒ „Sitzung abgelaufen“ ⇒
    „Verwaiste freigeben“; lebender Gast ⇒ Dialog ⇒ er wird abgemeldet; `anzGuests` senken ⇒ unwirksam belegter Platz.
6. Sichtprüfung bei 360 px: Konfiguration (alle Gruppen, Aktionsleiste), Gastplätze.
7. **Hallenabsage – nur mit Testpostfach:** Modus aus ⇒ kein Abschnitt; Modus an, Adresse leer ⇒ Hinweis mit Link;
    Adresse gesetzt ⇒ Absage: Mail trifft ein, Termin `ABGESAGT`, „versandt am“; zweiter Aufruf von einem zweiten
    Gerät ⇒ „schon raus“; Frist: `halleVorlaufStunden` hochsetzen ⇒ Aktion deaktiviert; `503` nur mit gestopptem
    Mailserver. **Danach Modus aus und Adresse zurücksetzen.**
8. **Ergebniskorrektur:** Ergebnis erfassen lassen, Sieger ändern ⇒ die Bilanz der Beteiligten dreht (am Spieler
    nachsehen), `U` und „deutlich“, zwei Browser ⇒ Konflikt; die unveränderte Korrektur ist gesperrt (E17).
9. **Manuelle Generierung:** Profile und Gast auswählen ⇒ Ergebnis; Auswahl ändern ⇒ Ergebnis weg; Seite verlassen ⇒
    weg; unvollständiges Profil deaktiviert; zu viele ⇒ Sperre bzw. `409`; (optional) `maxTeilnehmer` auf 26 und 25
    Teilnehmer ⇒ Abweichungssatz zum Verfahren.
10. Sichtprüfung bei 360 px: Termin-Verwaltung (alle Abschnitte, jede Statusvariante), manuelle Generierung (20 Profile,
    Ergebnis).
11. **Gesamtdurchgang als Admin (C7 und C8):** nirgends ein Zusagestatus oder eine Tab-Leiste; Skillwerte nur im Profilformular;
    `differenzTeamstaerke` nur unter `/admin/teams`; kein Cache-Rest nach PIN- und Passwortwechsel; jeder Eintrag der
    Verwaltungsliste führt auf eine echte Seite; Abmelden aus jedem Bereich.

---

## 13. Nachdokumentation und Commit

- `CONTEXT_HANDOFF_CLIENT.md` (Vorfassung ins Archiv): Entscheidungen E13–E18 (bestätigte Fassung), neue Bausteine und Hooks
  (`StufeWahl`, `Textbereich`, `ErgebnisEingabe`, `TeamListen`, `useZeitpunktErreicht`, Hooks der Stufen 4 und 5), Testzahlen,
  Stand der Handprüfung; Meilensteintabelle nur im Status fortschreiben (C7 27,5 h, C8 21,5 h); in 6.4 „Ergebnis-Korrektur ohne
  Ansicht“ als erledigt streichen.
- `AGENT_CLIENT.md`: Regeln „`differenzTeamstaerke` nur in `AdminTeams`“, „Voll-Update: nie mit neuer Version und alten Eingaben
  senden“ (gilt für Konfiguration und Ergebniskorrektur), „Halle: `aria-disabled` mit Grund als Text“, „Mapper
  `konfigurationAnfrage` ist die einzige Stelle, die den Körper baut“; neue Bausteine unter „Basis-Komponenten“.
- **DESIGN.md** gehört nicht zum Client-Repository: die Abweichungen aus 1.3 dem Entwickler zur Übernahme vorlegen.
- **Server-Track** (Anfragen, nicht Teil von C8): `stufe` des Gastes je Teilnahme für den Admin lesbar machen; Mindestwert für
  `sessionLeerlaufMinuten`; Format von `halleAbsageMoeglichBis` im Schema festschreiben (`format: date-time`).
- `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`: Client-Stand.
- Commit auf `dev_client`, **je Stufe auf Aufforderung**; nichts nach `main`; Git im verbundenen Ordner nur mit
  `--no-optional-locks`; für den Commit selbst ist die Löschfreigabe nötig (Sperrdateien in `.git`).

---

## 14. Fallen

Die Fallen aus **C7 14** gelten weiter (`mutate` vs. `mutateAsync`, `invalidateQueries` nur für beobachtete Abfragen, Mocks mit
Zustand, `refetchInterval: 0`, Fokus). Zusätzlich für C8:

- **`refetchOnWindowFocus` steht im Client auf `true`:** Eine Formularabfrage, die beim Fensterwechsel neu lädt, baut das
  Formular mit `key={version}` neu und verwirft Eingaben. Für Formularabfragen abschalten.
- **Voll-Update: ein fehlendes Feld ist `400` und wird nie als `false` gelesen.** Der Mapper ist die einzige Stelle; sein Test
  zählt die Schlüssel.
- **`""`, `null` und „fehlt“ bedeuten je Aufruf etwas anderes:** Konfiguration leer ⇒ `null`; Gast `name` leer ⇒ weglassen
  (Termine: C7 14).
- **`ABGESAGT` setzt auch der Server selbst** (Vertrag, 18.10.2026): Hat ein geplanter Termin 30 Minuten nach Beginn weniger Zusagen
  als `minTeilnehmer`, wird er `ABGESAGT` statt `ABGESCHLOSSEN` – ohne Push, ohne dass jemand abgesagt hat. Ein abgesagter Termin
  ist darum nicht immer ein Absagen des Admins: Texte (Statusabschnitt, Dialoge) dürfen das nicht behaupten; Hallenabsage und
  Absagen-Aktion gelten nur für `GEPLANT`. Die Rückmeldungen bleiben stehen, `PROFIL_IN_VERWENDUNG`/`TERMIN_IN_VERWENDUNG` greifen weiter.
- **Hallenabsage:** versendet eine **echte** E-Mail und ist nicht zurücknehmbar; bei ausgeschaltetem Modus liefert der Server
  `HALLE_MODUS_INAKTIV` **auch für unbekannte Termine** (nicht `404`); `HALLE_BEREITS_ABGESAGT` ist ein Doppelklick, kein
  Fehler; `503` hinterlässt nichts, die Wiederholung ist erlaubt.
- **`halleAbsageMoeglichBis` ist ein Zeitstempel:** mit `Date.parse` lesen; den Termin nicht aus `new Date('YYYY-MM-DD')`
  bilden (UTC, C5-Falle).
- **Uhr im Render ist verboten** (react-hooks v7): `useZeitpunktErreicht` (5.5); das Datum für `min` einmalig über `useState(() => heuteIso(new Date()))`.
- **`deutlich` bei `U`:** `true` ⇒ `400`; Oberfläche setzt zurück, Funktion sendet `false`.
- **Die manuelle Generierung wird nirgends gespeichert:** kein Schlüssel im Cache, Ergebnis im Zustand, Hinweis dauerhaft;
  `ZU_VIELE_TEILNEHMER` schneidet **nicht** ab; Verfahren und Modus **anzeigen**, wie der Server sie meldet;
  `differenzTeamstaerke` sind Kosten der Zielfunktion, nicht die Differenz der Stärken.
- **`gastName` roh senden:** ohne „(Gast)“, ohne Trimmen (zeichengenauer Vergleich am Server).
- **„Alle freigeben“ (`alle: true`) würde aktive Gäste abmelden**; angeboten wird nur „Verwaiste freigeben“ (`slotIds`).
- **Fokus** nach Dialog, Absage, Abschluss, Entfernen und Weiterleitung gezielt setzen (Fokus landet sonst auf `body`).

---

## 15. Zeitplan (21,5 h in zwei Stufen)

Jede Stufe endet **grün** (`lint`, `tsc`, `test`, `build`, E2E in drei Chromium-Projekten) und wird einzeln committet (auf
Aufforderung). **Voraussetzung: C7 ist abgeschlossen** (2).

| Stufe | Schritt | Abschnitt | h |
|---|---|---|---|
| **4 – Konfiguration, Gastplätze, Gast-Stufe** | API, Mock, Hooks | 3.1, 9.1 | 1,0 |
| | Konfigurationsformular samt `Textbereich` | 9.2 | 3,5 |
| | Gastplätze | 9.3 | 1,5 |
| | Skill-Stufe eines Gastes (`StufeWahl`) | 5.8, 9.4 | 0,75 |
| | Tests, E2E | 11 | 3,0 |
| | Abnahme | 12 (Nr. 3 bis 6) | 0,75 |
| | *Zwischensumme* | | *10,5* |
| **5 – Halle, Korrektur, manuelle Teams** | Hallenabsage, `useZeitpunktErreicht` | 5.5, 10.1 | 1,75 |
| | Ergebniskorrektur, `ErgebnisEingabe` herauslösen | 5.9, 10.2 | 2,25 |
| | Manuelle Teamgenerierung, `TeamListen` herauslösen | 5.9, 10.3 | 3,0 |
| | Tests, E2E, Gegenproben | 11 | 2,75 |
| | Abnahme, Gesamtdurchgang, Doku | 12 (Nr. 7 bis 11), 13 | 1,25 |
| | *Zwischensumme* | | *11,0* |
| **Summe C8** | | | **21,5** |

Zusammen mit C7 (27,5 h) ergeben sich die ursprünglichen **49,0 h**.

**Reihenfolge:** Stufe 4 liefert `useKonfiguration`, das die Hallenabsage (Modus, Adresse) und die manuelle Generierung
(Mindest- und Höchstzahl) lesen, sowie `useGastplaetze` für die Gast-Stufe. Stufe 5 hängt Hallenabsage und Ergebnis in die
Verwaltungsansicht und braucht die Profilliste aus C7. **Die Reihenfolge der beiden Stufen ist zwingend.**

**Risiken:** (1) Die **Hallenabsage** versendet eine echte E-Mail: Handprüfung nur mit Testpostfach, Modus und Adresse danach
zurücksetzen. (2) Die Handprüfung der **Konfiguration** ändert einen gemeinsamen Zustand: Werte notieren und zurücksetzen. (3) Der
**Prototyp** war nicht auswertbar: Layout-Abweichungen kosten Umbau; vor jeder Stufe sichten. (4) Die **Gast-Stufe ohne
Lesequelle** (1.4) bleibt ein Ratespiel, bis der Server nachzieht; E13 nimmt es in Kauf. (5) Das **Fenster der Terminliste**
(60 Tage) begrenzt die Ergebniskorrektur; ändert sich die Anforderung, ist es eine Konstante, aber eine Entscheidung des
Betriebs.
