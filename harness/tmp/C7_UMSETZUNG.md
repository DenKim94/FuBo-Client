# C7 – Admin-Dashboard und Verwaltung, Teil 1 (Umsetzungsanleitung)

> Arbeitspaket **C7** (geschätzt **27,5 h**; Umsetzung in drei Stufen, siehe 15).
>
> **Aufteilung vom 18.10.2026:** Die ursprüngliche Gesamtanleitung (49 h, fünf Stufen) ist zu umfangreich für ein Paket. Die
> Stufen 1 bis 3 (Rahmen/Dashboard/Zugang, Profile, Termine) bleiben hier. Die **Stufen 4 und 5** (Konfiguration, Gastplätze,
> Skill-Stufe eines Gastes, Hallenabsage, Ergebniskorrektur, manuelle Teamgenerierung; 21,5 h) stehen in
> **`C8_UMSETZUNG.md`** und setzen den Abschluss von C7 voraus. Die Fassung vor der Aufteilung liegt unverändert unter
> `harness/tmp/C7_UMSETZUNG_2026-10-18.md`. **Die Nummern der Abschnitte, Stufen und Entscheidungen (E1–E22) blieben erhalten**,
> damit Verweise in beiden Dateien gelten; Lücken (5.5, 5.8, 5.9, 9, 10) sind Absicht. Das Paket „PWA-Onboarding & Push“ heisst
> seither **C9**, „Abnahme, WCAG 2.1 AA, Deployment“ **C10**.
> Massgeblich: `/PRJ_FuBo/harness/AGENT.md` (A3, A10, A11, A13, A15, A17–A19, A21–A24),
> `client/harness/AGENT_CLIENT.md`, `/PRJ_FuBo/harness/assets/Design/DESIGN.md` (Ansichten 9 bis 16, 19),
> Vertrag `client/harness/assets/fubo-api.json` (45 Operationen, Stand 17.10.2026).
> Referenz: `FuBo_Design_Prototypen.html` – die Datei war bei der Erstellung dieser Anleitung nicht
> auswertbar (eingebettetes Bündel); **Layoutangaben stützen sich auf DESIGN.md**. Vor Beginn jeder Stufe den
> Prototyp sichten; Abweichungen sind zulässig (1.3).
>
> **Fassung vom 17.10.2026 (aufgeteilt am 18.10.2026)**, Stand Commit `e9a85e6` auf `dev_client` (C5 committet, nicht gepusht). Die
> **Entscheidungen E1–E22 (1.2) sind Vorschläge** und vor Beginn der jeweiligen Stufe vom Entwickler zu
> bestätigen oder zu ändern; abweichende Antworten ändern nur die jeweils genannten Abschnitte.
> **Der Umfang liegt weit über dem Meilensteinplan:** Der Vertrag kennt 24 Admin-Operationen (ohne
> Anmeldung; 22 davon sind neu, das Passwort steht seit C4, der Probeversand gehört zu C9), DESIGN.md zehn Admin-Ansichten; 20 h trugen nur das Dashboard und die Profilverwaltung
> (Abschnitt 15 erklärt die Rechnung).

---

## 0. Ziel und Abgrenzung

Nach C7 hat der Admin ein **Dashboard** mit der Teilnehmerübersicht des nächsten Termins und einer
Verwaltungsliste, von der aus er alle Bereiche erreicht. Er verwaltet Spielerprofile samt Skillwerten und Termine
(Einzeltermin, Serie, Änderung, Absage, Abschluss, Entfernung) und pflegt die Zugangsdaten (zentrale PIN, Anmeldename; das
Passwort steht seit C4). Konfiguration, Gastplätze, die Skill-Stufe von Gästen, Hallenabsage, Ergebniskorrektur und die
manuelle Teamgenerierung folgen in **C8**; ihre Einträge stehen schon in der Verwaltungsliste, die Ziele zeigen bis dahin auf
`Platzhalter` (6.1).

| Bereich | Routen (Vorschlag E1) | Inhalt | Endpunkte |
|---|---|---|---|
| Dashboard | `/admin` | nächster Termin lesend, Verwaltungsliste | `GET /termine/lesen`, `GET /termine/{terminId}/lesen` |
| Profile | `/admin/profile`, `/neu`, `/:spielerId` | Liste, Anlegen, Bearbeiten, Sperren, Entfernen | `GET /admin/user/lesen`, `GET /admin/skills/lesen`, `POST /admin/user/anlegen`, `…/bearbeiten`, `…/blockieren`, `…/entfernen` |
| Termine | `/admin/termine`, `/neu`, `/:terminId` | Liste (kommende, vergangene), Einzel/Serie anlegen, ändern, absagen, abschliessen, entfernen | `POST /admin/termin/anlegen`, `…/aendern`, `…/absagen`, `…/entfernen`, `POST /admin/serie/anlegen` |
| im Termin (**C8**) | `/admin/termine/:terminId` | Skill-Stufe eines Gastes, Hallenabsage, Ergebnis korrigieren | `POST /admin/teilnahme/gast-stufe`, `POST /admin/halle/absagen`, `POST /admin/ergebnis/korrigieren` |
| Gäste (**C8**) | `/admin/gaeste` | Gastplätze, Freigabe | `GET /admin/gast/lesen`, `POST /admin/gast/freigeben` |
| Konfiguration (**C8**) | `/admin/konfiguration` | Voll-Update mit sechs Gruppen | `GET /admin/config/lesen`, `POST /admin/config/aendern` |
| Teams (**C8**) | `/admin/teams` | manuelle Generierung, nicht gespeichert | `POST /admin/teams/generieren` |
| Zugang | `/admin/pin`, `/admin/name/aendern`, `/admin/name/bestaetigen`, `/admin/passwort/aendern` (C4) | zentrale PIN, Anmeldename | `POST /admin/pin/aendern`, `POST /admin/name/aendern`, `POST /admin/name/bestaetigen` |

Alle Endpunkte unter `/admin/` verlangen die Rolle `ADMIN` (`AdminRoute` ist nur Bedienkomfort, die Prüfung
liegt am Server). Die Rückmeldung bleibt dem Admin gesperrt (`409 PROFIL_GESCHUETZT`); er sieht deshalb auf
dem Dashboard weder „Zusagen“ noch „Absagen“ (E2).

**Nicht Teil von C7:**

- **Stufen 4 und 5** (Konfiguration, Gastplätze, Gast-Stufe, Hallenabsage, Ergebniskorrektur, manuelle Teams) → **C8**
  (`C8_UMSETZUNG.md`).
- **Einstellungen, Push, Installationshinweis** → **C9**. Der Probeversand `POST /admin/push/test` gehört dorthin
  (E21), weil er den Push-Status (`GET /push/status/lesen`) daneben zeigen muss.
- **Tab-Leiste und User-Dashboard für den Admin** – bleibt ausgeschlossen (C5, E7).
- **Änderung einer Serie** – der Vertrag kennt sie nicht (1.1 Nr. 5); einzelne Termine sind einzeln änderbar.
- **Audit-Log, Bilanz-Historie, „Absagen“-Liste** – nicht über die API erreichbar.
- Keine neuen Abhängigkeiten.

---

## 1. Vorab: Befunde und Entscheidungen

### 1.1 Befunde aus dem Vertrag

1. **Der Admin liest Termine über die offenen Endpunkte.** Es gibt keinen Adminendpunkt für Termine:
   `GET /termine/lesen` (**ohne `ab` seit dem Vertragsstand vom 18.10.2026 alle Termine, auch vergangene**; der Client
   fragt mit `ab`) und `GET /termine/{terminId}/lesen` liefern auch die
   `version`, `halleAbgesagtAm`, `halleAbsageMoeglichBis`, `teams` und `ergebnis` samt dessen `version`. Der
   Vertrag nennt die Rolle ADMIN dort nicht ausdrücklich; `AGENT.md` (Sicherheitsregel `anyRequest()`) lässt
   `USER`, `ADMIN` und `GAST` zu. **In der Handprüfung bestätigen (1.4).**
2. **Die Skill-Stufe eines Gastes hängt an der Teilnahme, nicht am Gastplatz.** `POST /admin/teilnahme/gast-stufe`
   verlangt `terminId`, `gastName` (zeichengenau) und `stufe`; es ändert **nur** diese Teilnahme und zählt die
   `teilnehmerVersion` hoch. `TeilnehmerEintrag` trägt **keine** Stufe, `GastPlatzInfo.gastStufe` zeigt nur die
   Selbsteinschätzung der laufenden Sitzung. DESIGN.md (Ansicht 12: „je Gast eine Stufe zuweisen“) lässt sich so
   nicht 1:1 bauen (1.3, E13).
3. **Die Konfiguration ist ein Voll-Update:** vierzehn änderbare Felder plus `version` = **15 Schlüssel**, keiner
   optional. `halleEmail` und `halleAbsageVorlage` sind `null`-fähig (leer ⇒ `null`, nicht `""`).
   `halleAbsageVorlageEffektiv` und `geaendertAm` sind nur lesbar und gehören **nicht** in den Körper. Ein
   fehlendes Feld ist `400` mit dem Schlüssel im Block `felder` – es wird nie als `false` gelesen.
4. **Profilverwaltung:** `GET /admin/user/lesen` liefert **alle** Profile, auch gesperrte (`aktiv: false`) und
   das Adminprofil (`rolle: ADMIN`), mit `skills`, `bilanz` und `belegt` (online). Das Adminprofil lässt sich
   weder bearbeiten, sperren noch entfernen (`409 PROFIL_GESCHUETZT`) – die Oberfläche blendet die Aktionen aus.
   Die Karte `skills` kann **Lücken** haben (Datenimport); der Client erkennt sie, indem er sie gegen
   `GET /admin/skills/lesen` hält.
5. **Anlegen verlangt alle aktiven Kategorien, Bearbeiten erlaubt eine Teilmenge.** Beim Anlegen fehlende,
   unbekannte oder ausserhalb des Bereichs liegende Werte ⇒ `400 EINGABE_UNGUELTIG` mit den Kategorien in der
   Meldung. Beim Bearbeiten heisst Weglassen „nicht ändern“; ein Aufruf ohne `name` und `skills` ⇒ `400`.
   Eine leere Karte löscht nichts. Bereiche: 0 bis 6, `TORWART` 0 bis 3 (datengetrieben, `minWert`/`maxWert`).
6. **Entfernen ist für den Fehlgriff gedacht.** Hängen Daten am Profil, kommt `409 PROFIL_IN_VERWENDUNG`;
   dann ist `blockieren` der richtige Weg. Sperren widerruft die offenen Sitzungen des Profils; der Name bleibt
   belegt. `blockieren` ist wiederholbar (`204`).
7. **Termine:** `datum` + `uhrzeit` sind global eindeutig (`409 TERMIN_BELEGT`, auch bei anderem Ort);
   Vergangenes wird abgelehnt (`400`). Nur ein `GEPLANT`-Termin ist änderbar (`409 TERMIN_GESCHLOSSEN`).
   **Die Absage ist endgültig**, ein abgesagter Termin belegt seinen Zeitpunkt weiter; der **einzige Weg zurück**
   ist Entfernen und Neuanlegen – und das gelingt nur, solange nichts am Termin hängt (`409 TERMIN_IN_VERWENDUNG`).
8. **`POST /admin/termin/aendern` ist feldweise** (`version` Pflicht; `""` leert den Ort; ein Körper ohne
   Änderung ⇒ `400`). Der Zielstatus darf nur `ABGESAGT` oder `ABGESCHLOSSEN` sein (`GEPLANT` ⇒ `400`).
   `POST /admin/termin/absagen` ist der Kurzweg **ohne** `version`.
9. **Serie:** Kollidierende Zeitpunkte werden **übersprungen und namentlich zurückgemeldet**
   (`uebersprungeneTermine`); höchstens 52 Termine (`400` nennt die errechnete Zahl); `enddatum` strikt nach
   `startdatum`; die Serie ist nach dem Anlegen nicht änderbar. `wochentag` ist ISO (1 = Montag … 7 = Sonntag).
   Die Termine entstehen sofort als echte Zeilen.
10. **Ergebnis korrigieren** ist ein Voll-Update (`sieger`, `deutlich`, `version`); eine Korrektur ohne
    Änderung wird angenommen. `409 DATEN_VERALTET` heisst „neu laden und erneut speichern“, nicht „Eingabe
    falsch“. Bei `sieger = U` ist `deutlich = true` unzulässig. Die Bilanz wird gedreht, nicht addiert; die
    Zähler anderer Termine bleiben unberührt. `404 INHALT_NICHT_GEFUNDEN` deckt „kein Ergebnis“ und „kein Termin“
    ab.
11. **Hallenabsage:** Der Server prüft in dieser Reihenfolge `HALLE_MODUS_INAKTIV` (vor der Terminsuche),
    `TERMIN_GESCHLOSSEN`, `HALLE_FRIST_ABGELAUFEN`, `HALLE_NICHT_KONFIGURIERT` (leere `halleEmail`),
    `HALLE_BEREITS_ABGESAGT`; bei `503 VERSAND_FEHLGESCHLAGEN` bleibt nichts zurück, der Aufruf ist
    wiederholbar. **Die Mail ist nicht zurücknehmbar.** Ein `GEPLANT`-Termin wird mit abgesagt. Die Frist liefert
    `halleAbsageMoeglichBis` (immer gefüllt, ein vergangener Termin fällt automatisch darunter), die versandte
    Absage `halleAbgesagtAm`. `HALLE_BEREITS_ABGESAGT` ist **kein Bedienfehler** (Doppelklick).
12. **Manuelle Teamgenerierung:** nicht gespeichert, kein Kontingent, nur Admin. `400` für unbekannte oder
    gesperrte `spielerIds`; `409` mit `PROFIL_GESCHUETZT` (Adminprofil), `ZU_WENIG_TEILNEHMER`,
    `ZU_VIELE_TEILNEHMER` (**keine stille Kürzung**), `SKILLWERTE_UNVOLLSTAENDIG` (`detail` nennt die Namen).
    `gaeste[].stufe` ist Pflicht, `name` optional (Server vergibt `Gast 1`, `Gast 2`, … nach Position).
    Die Antwort nennt das **tatsächlich** gerechnete Verfahren und den **tatsächlich** angewandten
    Auswechselmodus (beide können von der Konfiguration abweichen); `differenzTeamstaerke` sind die Kosten der
    Zielfunktion (0 = ausgeglichen), **nicht** die Differenz der Gesamtstärken; kein `seed`.
13. **Gastplätze:** `GET /admin/gast/lesen` liefert auch **unwirksame** Plätze (`wirksam: false`, Nummer über
    `anzGuests`). `belegt: true` bei `sitzungGueltig: false` ist ein **verwaister** Platz (die Sitzung ist
    abgelaufen, der Platz wird erst nachts freigegeben) – der Kandidat für die Freigabe. `freigeben` meldet den
    Gast **ab** (Sitzung widerrufen); ein freier Platz wird übersprungen. Der Körper trägt **genau eines** von
    `slotIds` (mindestens 1) oder `alle: true` – ein leerer Körper ⇒ `400`.
14. **Zentrale PIN:** vier Ziffern (`^\d{4}$`), kein Feld für die alte PIN; **alle** Sitzungen sind danach
    widerrufen, auch die eigene und die der Spieler und Gäste; belegte Gastplätze werden freigegeben. Der
    Anmeldeendpunkt prüft **kein** Format (ein Bestand wie `FUBO_INITIAL_PIN` bleibt eingebbar).
15. **Anmeldename:** zwei Schritte. `POST /admin/name/aendern` ⇒ `202` ohne Rumpf (prüft den Namen, schickt eine
    fünfstellige PIN an die hinterlegte Adresse); `POST /admin/name/bestaetigen` mit `bestaetigungsPin`
    (`^\d{5}$`, **kein Name im Körper**) ⇒ `204`. **Die Sitzung bleibt bestehen**, der neue Name gilt beim
    **nächsten** Login (zeichengenau, Gross-/Kleinschreibung). Fehler: `400`, `409 NAME_BELEGT` (auch noch beim
    Bestätigen), `429 NAME_AENDERUNG_GEDROSSELT` (höchstens drei je Stunde), `503 VERSAND_FEHLGESCHLAGEN`
    (wiederholbar, nichts bleibt zurück); beim Bestätigen `401 NAME_PIN_FALSCH` (ein Versuch verbraucht, fünf
    je Vorgang), `409 NAME_AENDERUNG_UNGUELTIG` (nie angefordert, abgelaufen, eingelöst, entwertet, Versuche
    erschöpft – bewusst nicht unterschieden), `429 PIN_GESPERRT` mit `wartesekunden`. **Nur `SESSION_UNGUELTIG`
    beendet die Sitzung** (`istSitzungsende` unterscheidet über `code`; `NAME_PIN_FALSCH` ist kein Sitzungsende).
    Ein Vorgang gehört nicht zur Sitzung: Er bleibt nach einer erneuten Anmeldung einlösbar, solange er gilt.
    **Die Gültigkeitsdauer der PIN steht nicht im Vertrag** – eine Restzeitanzeige wie beim Passwort-Reset
    entfällt (E20).
16. **Zwei Voll-Update-Formulare mit `version`, ein feldweises:** Konfiguration und Ergebniskorrektur sind
    Voll-Updates; der Termin ist feldweise. Bei allen dreien heisst `409 DATEN_VERALTET`: nichts wurde
    geschrieben, neu laden und erneut speichern (E5).
17. **Wirkung der Konfiguration:** `sessionLeerlaufMinuten` wirkt **sofort**, auch auf bestehende Sitzungen;
    `sessionMaximalStunden` **nicht rückwirkend**; `anzGuests`-Erhöhung legt Plätze an, eine Senkung löscht keine;
    `hallenModusAktiv` (Vorgabe **aus**) und `pushAktiv` (Vorgabe **an**) wirken sofort; `maxTeilnehmer` darf nicht
    unter `minTeilnehmer` liegen (`400` mit beiden Zahlen); `anzGuests` 0 bis 22, `sessionLeerlaufMinuten`
    1 bis 1440, `sessionMaximalStunden` 1 bis 24, `pushErinnerungStunden` 1 bis 168, `halleEmail` höchstens 120
    Zeichen und gültige Adresse, `halleVorlaufStunden` mindestens 0 (`0` = „bis zum Anpfiff“).
18. **Längen:** Profilname höchstens 60, Gastname 40, Terminort 160, Serientitel 80 Zeichen; Server entfernt
    Randleerzeichen. Beim Anmeldenamen ist das wesentlich: Die Anmeldung trimmt ihre Eingabe ebenfalls.
19. **Uhrzeit:** `HH:MM:SS` in Ortszeit, Sekunden dürfen entfallen; `<input type="time">` liefert `HH:MM`
    und ist zulässig. Datum `YYYY-MM-DD` (nicht über `toISOString()` bilden, C5-Falle).
20. **Typen:** `skills` ist in `SpielerDetails`, `SpielerAnlegenRequest` und `SpielerBearbeitenRequest` als
    `{ [key: string]: number }` erzeugt; `GastAuswahl.name` ist `string | null | undefined`,
    `halleAbsageMoeglichBis` ein `string` ohne Formatangabe (als Zeitstempel mit Zone lesen, in der Handprüfung
    nachsehen).

### 1.2 Entscheidungen (Vorschläge vom 17.10.2026)

| Nr. | Entscheidung | Begründung |
|---|---|---|
| E1 | **Ein Hub, keine Tab-Leiste:** `/admin` ist das Dashboard, jede Verwaltung eine eigene Route mit „Zurück“ zur Übergeordneten (`handle.zurueck`, immer ein fester Pfad: `/admin` bzw. `/admin/profile`, `/admin/termine`). Pfade nur in `ADMIN_PFADE` (`zielpfad.ts`). | Der Admin sieht keine Tabs (C5, E7). Alle Zurück-Ziele sind parameterlos; das Problem aus C5 (`teams/:terminId`) tritt nicht auf. |
| E2 | **Dashboard = Teilnehmerübersicht des nächsten Termins (lesend) + Verwaltungsliste.** `TerminAnsicht` bekommt die Eigenschaft `nurLesen` (kein `Zusagestatus`, keine `RueckmeldungLeiste`, keine Verweise auf Teams/Ergebnisse); sie führt stattdessen zum Termin in der Verwaltung. | A10 verlangt die Übersicht auf dem Admin-Dashboard. Ein „Noch nicht gemeldet“ für den Admin wäre falsch, er kann nicht zusagen. |
| E3 | **Ordnung:** Admin-Hooks in `src/hooks/admin/` (Tests daneben), API-Dateien nach Thema (`adminProfile.ts`, `adminTermine.ts`, `adminKonfiguration.ts`, `adminTeams.ts`; `admin.ts` bleibt für Zugangsdaten), Seiten flach als `src/pages/Admin…`. | Der Ordner `src/hooks/` hat bereits über 60 Dateien; über 20 weitere Hooks gehören gruppiert. `ergebnisKorrigieren` zieht nach `adminTermine.ts` um (nur Test und Typ betroffen). |
| E4 | **Lesen im Admin:** Formular- und Listenabfragen **ohne Polling und ohne** `X-FuBo-Kein-Refresh` (das Öffnen der Seite ist eine Aktivität), `refetchOnWindowFocus: false`. Ausnahmen: Dashboard und Terminliste nutzen die vorhandenen Hooks `useTermine`/`useTermin`/`useVerlauf` (mit Kopf, mit Polling), weil Zusagen wechseln; die Verwaltungsansicht eines Termins ruft `useTermin(terminId, 0)` (Kopf, **ohne** Polling). | Ein Polling ohne Kopf hielte die Sitzung ewig offen (C3-Falle); ein Formular, das beim Fensterwechsel neu lädt, überschriebe Eingaben. |
| E5 | **Nach `409 DATEN_VERALTET` setzt das Formular auf den frisch gelesenen Stand zurück** (Schlüssel `key={version}` am Formularkörper; die Mutation liegt im Elternbaustein, damit die Meldung den Neuaufbau überlebt). Eingaben gehen verloren, der Text sagt es. Gesendet wird nie mit einer `version`, die der Nutzer nicht gesehen hat. | Vertrag: „neu laden und erneut speichern“. Mit der neuen `version` und den alten Werten zu senden, überschriebe genau die fremde Änderung, die die Sperre schützt. |
| E6 | **Skill-Eingabe:** Zahlenfeld je Kategorie, Beschriftung/Grenzen/Reihenfolge aus `GET /admin/skills/lesen` (nichts fest verdrahtet). Anlegen: Vorbelegung mit der gerundeten Mitte des Bereichs, **sichtbar** als Eingabe mit Hinweis „Vorbelegt, bitte prüfen“. Bearbeiten: gesendet wird nur, was sich geändert hat. | Vertrag 1.1 Nr. 5; DESIGN.md Ansicht 10. Ein Zahlenfeld braucht keinen neuen Eingabebaustein (`Feld`, `type="number"`, `inputMode="numeric"`). Gegenvorschlag: Radiogruppe 0 bis 6 – sieben Tap-Ziele zu 44 px passen bei 360 px nicht ohne Umbruch. |
| E7 | **Unvollständige Skillwerte** (Karte hat nicht alle aktiven Kategorien) werden in der Profilliste gekennzeichnet („Skillwerte unvollständig“). | Sonst erscheint der Fehler erst als `409 SKILLWERTE_UNVOLLSTAENDIG` bei der Teamgenerierung. |
| E8 | **Sperren** ohne Dialog, ausser das Profil ist `belegt` (online): dann Dialog „wird sofort abgemeldet“. **Entfernen** immer mit Dialog; `PROFIL_IN_VERWENDUNG` ⇒ Hinweis mit Angebot „Stattdessen sperren“. **Entsperren** ohne Dialog. | Sperren ist umkehrbar, Entfernen nicht. |
| E9 | **Terminliste auf einer Ansicht:** Abschnitt „Kommende“ (`useTermine`) und „Vergangene (letzte {VERLAUF_TAGE} Tage)“ (`useVerlauf`); beide Zeilen führen zur Verwaltung des Termins. | Die Ergebniskorrektur braucht Zugang zu vergangenen Terminen; die Hooks stehen. |
| E10 | **Anlegen in einem Formular** mit Umschalter „Einzeltermin“/„Serie“ (Radiogruppe). Serie: Bestätigungsdialog („nicht mehr änderbar“) und eigene Ergebnisansicht (`SerieErgebnis`: angelegte Zahl, übersprungene Zeitpunkte als Liste). Einzeltermin: danach zum Termin in der Verwaltung. | DESIGN.md Ansicht 11; Vertrag 1.1 Nr. 9. |
| E11 | **Termin ändern diffbasiert** (nur Geänderte gehen hinaus, `""` leert den Ort, Speichern erst bei einer Änderung). **Absagen** und **Abschliessen** sind eigene Aktionen mit Dialog; Absagen über `/admin/termin/absagen` (ohne `version`), Abschliessen über `aendern` mit `status: 'ABGESCHLOSSEN'`. | Ein Körper ohne Änderung ist `400`. „Abschliessen“ macht die Handprüfung der Ergebnisse (30 bis 35 Minuten Wartezeit, C5 Nr. 6) abkürzbar – zulässig laut Vertrag. |
| E12 | **Entfernen** nur für `GEPLANT`/`ABGESAGT` angeboten, immer mit Dialog; `TERMIN_IN_VERWENDUNG` ⇒ „Stattdessen absagen“. Der Absagen-Dialog nennt: endgültig, Zeitpunkt bleibt belegt, Rückweg nur über Entfernen. | Vertrag 1.1 Nr. 7. |
| E13 | **Skill-Stufe eines Gastes im Termin: verschoben nach C8** (dort 1.2). | Sie braucht den Lesehook der Gastplätze (`useGastplaetze`), der zu C8 gehört. |
| E14 | **Konfiguration als ein Formular: verschoben nach C8.** | – |
| E15 | **Gastverwaltung: verschoben nach C8.** | – |
| E16 | **Hallenabsage im Termin: verschoben nach C8.** | – |
| E17 | **Ergebniskorrektur im Termin: verschoben nach C8.** | – |
| E18 | **Manuelle Teamgenerierung: verschoben nach C8.** | – |
| E19 | **Zentrale PIN:** `PinFeld` mit vier Stellen, Dialog **vor** dem Senden („alle Angemeldeten, auch Spieler und Gäste, werden sofort abgemeldet; teile die neue PIN vorher über deinen Weg mit“); nach `204` räumt der Client auf (`sitzungsendeAusloesen` mit Hinweis), wie beim Passwort. | Vertrag 1.1 Nr. 14: „gehört als Hinweis in die Bestätigung, nicht als Überraschung“. |
| E20 | **Anmeldename in zwei Ansichten** wie der Passwort-Reset (C4): `/admin/name/aendern` (neuer Name ⇒ `202` ⇒ Weiterleitung) und `/admin/name/bestaetigen` (5 Ziffern); Link „Ich habe bereits eine PIN“; **keine Restzeitanzeige** (nicht geliefert), stattdessen fester Satz „Die PIN ist nur kurz gültig und auf fünf Versuche begrenzt.“; nach Erfolg Hinweis „gilt ab der nächsten Anmeldung“, **die Sitzung bleibt**. | Vertrag 1.1 Nr. 15; DESIGN.md Ansicht 17 als Muster. |
| E21 | **Push-Probeversand gehört zu C9** (bisher C8). | s. 0. |
| E22 | **Meilensteinplan:** Das ursprüngliche C7 wuchs von 20 auf 49 h und ist geteilt: **C7 27,5 h, C8 21,5 h**; Push/PWA wird **C9**, Abnahme/Deployment **C10** (15). | Abschnitt 15. |

### 1.3 Abweichungen von DESIGN.md und Prototyp (verbindlich ist der Vertrag)

- **Ansicht 12 (Gastverwaltung):** „je Gast eine Skill-Stufe zuweisen“ ist laut Vertrag eine Aktion an der
  **Teilnahme** (E13); die Gastverwaltung zeigt Plätze und gibt sie frei (E15). Beides in C8.
- **Ansichten 14 und 15** (Ergebniskorrektur, Hallenabsage) sind keine eigenen Seiten, sondern Abschnitte der
  Termin-Verwaltung: Beide handeln an **einem** Termin, und die nötigen Felder (`ergebnis.version`,
  `halleAbsageMoeglichBis`) kommen mit dessen Einzelansicht. Umsetzung in C8.
- **Ansicht 9 (Admin-Dashboard)** trägt zusätzlich die Teilnehmerübersicht (A10, E2).
- **Ansicht 17 (Passwort vergessen)** ist seit C4 umgesetzt; der Anmeldename übernimmt das Muster, aber ohne
  Restzeitbalken (1.1 Nr. 15).
- **Skalen:** Die Eingabe der Skillwerte ist ein Zahlenfeld, kein Schieber (E6).
- **Ansicht 19 (Konfiguration)** nennt „Sitzungsdauern“; die Obergrenze wirkt nicht rückwirkend – der Hinweis
  steht am Feld (1.1 Nr. 17; Umsetzung in C8).
- Diese Abweichungen sind dem Entwickler zur Übernahme in `DESIGN.md` vorzulegen (die Datei gehört nicht zum
  Client-Repository).

### 1.4 Offen für Server und Handprüfung

- **ADMIN darf `GET /termine/*` lesen** (1.1 Nr. 1): in Stufe 1 (Dashboard) als Erstes beobachten.
- **Hängt `version` des Termins an Zusagen?** Der Vertrag nennt `teilnehmerVersion` für Zu- und Absagen; ob
  `version` dabei steigt, steht nicht da. Steigt sie, würde ein Polling der Einzelansicht ein offenes Formular
  zurücksetzen (E5). Deshalb pollt die **Verwaltungsansicht des Termins nicht** (4.1).
- **Gültigkeitsdauer der Namens-PIN** und Zustellzeit der E-Mail: nicht im Vertrag; in der Handprüfung messen
  und den festen Satz (E20) gegebenenfalls ergänzen.
- **Stufen 4 und 5:** Hallenabsage (echte E-Mail), Leerlauf-Fenster unter drei Minuten und die Gast-Stufe ohne Lesequelle
  gehören zu C8 und stehen in `C8_UMSETZUNG.md`, 1.4.
- **Zentrale PIN ändern** meldet alle ab (auch den Admin): neue PIN vorher notieren; die Änderung bleibt
  bestehen, bis sie wieder gesetzt wird. **Anmeldenamen ändern:** höchstens drei Anforderungen je Stunde, der
  Name gilt danach beim nächsten Login; `ADMIN_NAME` in der `.env` ist danach veraltet (Betriebshinweis des
  Vertrags).
- **Gleichzeitige Admin-Sitzungen:** Es gibt genau einen Admin, aber mehrere Geräte sind möglich; die
  Versionsprüfung (E5) fängt das ab, die Handprüfung stellt es mit zwei Browsern nach.
- **Fenster der Terminliste:** Die Verwaltung erreicht Termine nur {VERLAUF_TAGE} Tage rückwärts (8.2); ein älteres
  Ergebnis liesse sich nicht korrigieren. Ob das reicht, entscheidet der Betrieb; der Vertrag kennt für `ab` keine
  Obergrenze, ein grösseres Fenster wäre eine Konstante (`VERWALTUNG_TAGE`). **Seit dem 18.10.2026 liefert der Vertrag ohne
  `ab` alle Termine ohne Untergrenze:** Ein eigener Admin-Abruf ohne `ab` hebt das Fenster auf, die Antwort wächst dann mit
  jedem Termin (kein Limit) – zu entscheiden, wenn das Fenster nicht reicht.
- **C5-Handprüfung** (Abnahme 12, Nr. 6 der C5-Anleitung) wird mit Stufe 3 erst möglich: Termine ohne
  `curl` anlegen, Ergebnisse über „Abschliessen“ (E11) herstellen. Nr. 3 und 4 (Mindest- und Höchstzahl, Warteschlange)
  folgen mit der Konfiguration in C8.

---

## 2. Was bereits steht und wiederverwendet wird

- **Guards und Pfade:** `AdminRoute` (Rolle `ADMIN`, sonst nach `/`), `ADMIN_PFADE` und `zielFuerStufe`
  (`src/app/schutz/zielpfad.ts`; der Admin landet auf `/admin`). In `routen.tsx` steht unter `AdminRoute` bisher
  nur `/admin` als `Platzhalter` (`paket="C7"`, Link `admin-passwort-aendern-link`) und `admin/passwort/aendern`.
- **Zugangsdaten (C4):** `passwortAendern` in `src/api/admin/admin.ts` samt Hook `usePasswortAendern`
  (`sitzungsendeAusloesen` mit Hinweis), Seite `PasswortAendern`, Bausteine `PinFeld` (Eingabe `stellen`),
  `PasswortFeld`, `PasswortRegeln`, `Restzeitbalken`, Hook `useSperre` (Sperre nach `429 PIN_GESPERRT`),
  `useNavigationsHinweis` (Hinweis über `location.state`).
- **Datenzugriff:** `aufrufen` (`httpService.ts`; `202` und `204` ohne Rumpf, `ANTWORT_OHNE_RUMPF`), `ApiFehler`
  (`code`, `status`, `felder`, `wartesekunden`), `fehlertextBilden`, `istWiederholbar`; `queryClient` mit
  `sitzungsendeAusloesen`, `istSitzungsende` (nur `SESSION_UNGUELTIG`/`UNBEKANNT` beenden die Sitzung).
  **Standardwerte des Clients:** `staleTime` 30 s, `gcTime` 5 min, `refetchOnWindowFocus: true`, Wiederholung
  nur bei `5xx` und höchstens einmal, Mutationen nie.
- **Termine:** `useTermine`, `useTermin`, `useVerlauf`, `useTerminParameter`, `useBegonnen`; `terminZeit.ts`
  (`beginnVon`, `datumKurz`, `datumLang`, `uhrzeitKurz`, `zeitpunktKurz`, `naechsterTermin`, `heuteIso`,
  `verlaufAb`, `vergangeneTermine`, `VERLAUF_TAGE`); Schlüssel `termine`, `termin(id)`, `terminAlle`,
  `termineVerlauf`.
- **Bausteine:** `TerminAnsicht`, `TerminKarte`, `Teilnehmerliste`, `Fortschrittsbalken`, `TeamsAnzeige`,
  `ErgebnisAnzeige`, `ErgebnisFormular`, `BilanzKarte`, `VerlaufListe`; Basis: `Dialog` (`offen`, `titel`,
  `aufSchliessen`, `festhalten`, `symbol`, `beschreibungId`), `Feld` (`beschriftung`, `hinweis`, `fehler`,
  `aktion`, `ref`), `Auswahlliste`, `Aktionsleiste`, `CustomButton` (`art`, `breit`, `laedt`, `symbol`),
  `Hinweis`, `Leerzustand`, `Fehlerzustand`, `Fehlermeldung`, `Ladespinner`, `Textlink`, `Icon`.
- **Rahmen:** `AppLayout` (Kopfzeile mit „Zurück“ und „Abmelden“; Ziel aus `handle.zurueck`, sonst Schritt im
  Verlauf), `RoutenAngaben`, `NichtGefunden`.
- **Mocks und E2E:** `beispielAdminSitzung` (`handlers.ts`), `src/test/mocks/termine.ts` (zustandsbehaftetes
  `TerminModell`, `termineHandler`), `problem`; E2E-Helfer `sitzungNachbilden` (Rolle `'ADMIN'`),
  `termineNachbilden`, `ergebnisseNachbilden`, `inMinuten`, `problem`; Cloud-Kopie für Chromium.
- **Vorhanden, aber ohne Ansicht:** `ergebnisKorrigieren` samt Test und Typ `ErgebnisKorrektur` (die Ansicht folgt in C8).
- **Nicht vorhanden:** Datenzugriff für die 14 Operationen von C7 (die übrigen acht gehören zu C8; `ergebnisKorrigieren` ist schon vorhanden), alle
  Admin-Hooks, alle Verwaltungsseiten. Das Typmodul `schema.d.ts` kennt alle Schemas (Stand 45 Operationen) – kein
  `npm run api:typen` nötig, solange der Vertrag unverändert ist.

---

## 3. Datenzugriff und Mocks (Stufen 1 bis 3; die Stufen 4 und 5 stehen in C8, Abschnitt 3; je Stufe nur die eigenen Funktionen)

Alle Funktionen sind dünn: Pfad, Methode, Körper, JSDoc mit Rolle, Fehlercodes und Folgen (wie `auth.ts`).
**Keine trägt `keinRefresh`:** Admin-Lesen ohne Kopf (E4), alle Schreibaufrufe ohne Kopf.

### 3.1 API-Funktionen

**`src/api/admin/admin.ts`** (Zugangsdaten; Stufe 1):

```ts
export type PinAenderung = components['schemas']['PinAendernRequest']              // { neuePin }
export type NameAnforderung = components['schemas']['AdminNameAendernRequest']      // { neuerName }
export type NameBestaetigung = components['schemas']['AdminNameBestaetigenRequest'] // { bestaetigungsPin }

/** `204`. Danach sind ALLE Sitzungen widerrufen (auch die aufrufende, Spieler und Gäste). */
export async function zentralePinAendern(anfrage: PinAenderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/pin/aendern', { body: anfrage })
}

/** `202` ohne Rumpf: Der Name wird noch nicht geändert, die E-Mail geht an die hinterlegte Adresse. */
export async function adminNameAnfordern(anfrage: NameAnforderung): Promise<void> {
  await aufrufen<void>('POST', '/admin/name/aendern', { body: anfrage })
}

/** `204`. Kein Name im Körper; die Sitzung bleibt bestehen, der Name gilt ab dem nächsten Login. */
export async function adminNameBestaetigen(anfrage: NameBestaetigung): Promise<void> {
  await aufrufen<void>('POST', '/admin/name/bestaetigen', { body: anfrage })
}
```

**`src/api/admin/adminProfile.ts`** (Stufe 2):

```ts
export type SpielerDetails = components['schemas']['SpielerDetails']
export type SkillKategorie = components['schemas']['SkillKategorieInfo']
export type SpielerAnlegen = components['schemas']['SpielerAnlegenRequest']
export type SpielerBearbeiten = components['schemas']['SpielerBearbeitenRequest']
export type SpielerAngelegt = components['schemas']['SpielerAngelegt']

export const profileLesen = () => aufrufen<SpielerDetails[]>('GET', '/admin/user/lesen')
export const skillKategorienLesen = () => aufrufen<SkillKategorie[]>('GET', '/admin/skills/lesen')
export const spielerAnlegen = (anfrage: SpielerAnlegen) =>
  aufrufen<SpielerAngelegt>('POST', '/admin/user/anlegen', { body: anfrage })           // 201 mit Rumpf
export const spielerBearbeiten = (anfrage: SpielerBearbeiten) =>
  aufrufen<void>('POST', '/admin/user/bearbeiten', { body: anfrage })                    // 204
export const spielerBlockieren = (spielerId: number, blockieren: boolean) =>
  aufrufen<void>('POST', '/admin/user/blockieren', { body: { spielerId, blockieren } })  // 204
export const spielerEntfernen = (spielerId: number) =>
  aufrufen<void>('POST', '/admin/user/entfernen', { body: { spielerId } })               // 204
```

**`src/api/admin/adminTermine.ts`** (Stufe 3):
`terminAnlegen` (201, Körper `TerminAnlegenRequest`, Antwort `TerminAngelegt`), `serieAnlegen` (201,
`SerieAngelegt`), `terminAendern` (204), `terminAbsagen(terminId)` (204), `terminEntfernen(terminId)` (204). Die Uhrzeit
geht als `HH:MM` oder `HH:MM:SS` hinaus; `ort` wird beim Anlegen leer weggelassen (der Server macht aus `""` `null`),
beim Ändern bedeutet `""` „leeren“ (E11).

**Stufen 4 und 5 (C8):** `adminKonfiguration.ts`, `adminTeams.ts` und in `adminTermine.ts` die Funktionen `gastStufeAendern`,
`halleAbsagen` und `ergebnisKorrigieren` (zieht aus `admin.ts` um); siehe `C8_UMSETZUNG.md`, 3.1.

### 3.2 Schlüssel (`schluessel.ts`)

```ts
/** Admin-Abfragen. Wurzel `admin`: hebt sie von den Abfragen der Spieler ab. */
adminProfile: ['admin', 'profile'] as const,
adminSkills: ['admin', 'skills'] as const,
// adminKonfiguration und adminGaeste: C8 (3.2)
```

### 3.3 Fehlercodes der neuen Aufrufe (Reaktion der Oberfläche)

`401 SESSION_UNGUELTIG` beendet überall die Sitzung (global, `istSitzungsende`); `403` und unbekannte Codes
laufen über `fehlertextBilden`. `400 EINGABE_UNGUELTIG` trägt `felder` (am jeweiligen Feld anzeigen), sonst die
Meldung des Servers im Kasten. Die Tabelle nennt nur das Besondere:

| Aufruf | Status / Code | Reaktion |
|---|---|---|
| Profil anlegen | `409 NAME_BELEGT` | Text am Namensfeld, Eingaben bleiben, Fokus auf das Feld |
| | `400` (Skillwerte) | Meldung nennt die Kategorien; Kasten über dem Skillblock |
| Profil bearbeiten | `409 NAME_BELEGT` | wie oben |
| | `404` | „Dieses Profil gibt es nicht mehr.“, Liste neu lesen, zurück zur Liste |
| | `409 PROFIL_GESCHUETZT` | darf nicht vorkommen (Aktion ausgeblendet); generischer Fehler |
| Profil sperren/entsperren | `404` | wie oben; Liste neu lesen |
| Profil entfernen | `409 PROFIL_IN_VERWENDUNG` | Hinweis „Das Profil hat bereits Daten und lässt sich nicht entfernen.“, Aktion „Stattdessen sperren“ |
| | `404` | Liste neu lesen, Dialog schliessen |
| Termin anlegen | `409 TERMIN_BELEGT` | „Zu diesem Zeitpunkt gibt es bereits einen Termin (auch an einem anderen Ort).“ am Zeitfeld |
| | `400` | Vergangenheit/Format: Text am Feld (`felder`) oder Kasten |
| Serie anlegen | `400` | Kasten mit der Meldung des Servers (Enddatum, kein passender Wochentag, erster Termin vergangen, mehr als 52 mit Zahl) |
| Termin ändern | `409 DATEN_VERALTET` | E5: Neu lesen, Formular zurücksetzen, Text „zwischenzeitlich geändert“ |
| | `409 TERMIN_BELEGT` | Text am Zeitfeld |
| | `409 TERMIN_GESCHLOSSEN` | Hinweis „Der Termin ist nicht mehr geplant.“, neu lesen |
| | `400` | „keine Änderung“ darf nicht vorkommen (Speichern gesperrt); sonst Text des Servers |
| Termin absagen | `409 TERMIN_GESCHLOSSEN` | „Der Termin ist bereits abgesagt oder abgeschlossen.“, neu lesen |
| Termin entfernen | `409 TERMIN_IN_VERWENDUNG` | Hinweis, „Stattdessen absagen“ (nur bei `GEPLANT`) |
| | `404` | „Der Termin existiert nicht mehr.“, zur Liste |
| Zentrale PIN | `400` mit `felder.neuePin` | am Feld |
| Namen anfordern | `409 NAME_BELEGT` | am Namensfeld; es wurde nichts gesendet |
| | `429 NAME_AENDERUNG_GEDROSSELT` | „Zu viele Anforderungen. Bitte versuche es in einer Stunde erneut.“ |
| | `503 VERSAND_FEHLGESCHLAGEN` | wie bei der Halle: nichts verändert, wiederholbar |
| Namen bestätigen | `401 NAME_PIN_FALSCH` | **kein Sitzungsende**; PIN-Feld leeren, Fokus, Text am Feld |
| | `409 NAME_AENDERUNG_UNGUELTIG` | „Es liegt keine gültige Anforderung vor.“ mit Link „Neu anfordern“ |
| | `409 NAME_BELEGT` | „Der Name ist inzwischen vergeben.“ mit Link „Neu anfordern“ |
| | `429 PIN_GESPERRT` | `useSperre` (Sekunden aus `wartesekunden`) |

Die Aufrufe der Stufen 4 und 5 (Gast-Stufe, Ergebniskorrektur, Halle, Konfiguration, Gäste freigeben, manuelle Teams)
stehen in `C8_UMSETZUNG.md`, 3.3.

### 3.4 Mocks (`src/test/mocks/admin.ts`, neu)

- **Zustand statt Konstante:** ein `AdminWelt`-Objekt (Profile, Skillkategorien, dazu die `TerminModell`e aus
  `termine.ts`; C8 ergänzt Konfiguration mit `version` und Gastplätze); Lese- **und** Schreibhandler arbeiten darauf, jede
  Antwort entsteht aus dem Zustand (Falle aus C3: ein Mock, der unabhängig von der Anfrage antwortet, zeigt keine
  Änderung). `adminHandler(welt)` liefert die Handler der umgesetzten Stufen (C7: 14 Operationen, C8 ergänzt die übrigen
  acht); Tests hängen sie mit `mockServer.use(...adminHandler(welt))` vor (erster Treffer gewinnt).
- **Beispieldaten ohne reale Namen:** `Beispielspieler 01` bis `05` (einer gesperrt, einer mit unvollständiger
  Skillkarte), das Adminprofil `Beispieladmin` (`rolle: 'ADMIN'`, Skillwerte 0), Kategorien `ANGRIFF`,
  `VERTEIDIGUNG`, `SPIELSTAERKE`, `LAUFSTAERKE` (0 bis 6) und `TORWART` (0 bis 3). **Die Schlüssel sind
  Beispiele**; Code und Tests dürfen sie nicht voraussetzen (Tests prüfen mit eigenen Kategorien, dass nichts
  fest verdrahtet ist).
- **Das Verhalten des Servers wird nachgebildet, soweit die Tests es brauchen:** `NAME_BELEGT` ohne Beachtung
  der Gross-/Kleinschreibung, vollständige Skillwerte beim Anlegen (`400`), Teilmenge beim Bearbeiten,
  `PROFIL_GESCHUETZT` für das Adminprofil, `PROFIL_IN_VERWENDUNG` bei Profilen mit Zusagen, `version` des Termins
  (steigt bei jedem Schreiben, `409 DATEN_VERALTET` bei Abweichung), `TERMIN_BELEGT` bei gleichem `datum`/`uhrzeit`,
  Serie mit Übersprungenen. C8 ergänzt die Versionen von Konfiguration und Ergebnis sowie die Hallenfrist.
- **Der Konflikt lässt sich auslösen:** `welt.fremdeAenderung(...)` erhöht `version`, ohne dass der Test die
  Oberfläche benutzt (E5-Tests, 11.1).

---

## 4. Gemeinsame Regeln und Hooks

### 4.1 Lesen und Schreiben im Admin

- **Lesehooks** (`useProfile`, `useSkillKategorien`; in C8 `useKonfiguration`, `useGastplaetze`) rufen **ohne** Kopf,
  **ohne** `refetchInterval`, mit `refetchOnWindowFocus: false`. `useSkillKategorien` darf länger gelten
  (`staleTime: 5 * 60_000`): Kategorien ändern sich selten.
- **Die Verwaltungsansicht eines Termins pollt nicht** (Befund `version`, 1.4): Sie ruft das vorhandene
  `useTermin(terminId, 0)`. `refetchInterval: 0` schaltet das Polling in TanStack Query ab; **kein** zweiter Hook
  und kein zweiter Schlüssel, damit Dashboard-Karte und Verwaltung dieselbe Abfrage teilen (zwei Hooks mit
  gleichem Schlüssel und verschiedener Abfragefunktion sind eine Falle). Der Kopf `X-FuBo-Kein-Refresh` bleibt
  gesetzt; das Öffnen der Seite verlängert die Sitzung nicht, die erste Schreibaktion tut es. Ein Test hält fest,
  dass nach 60 s Fake-Zeit kein zweiter Abruf erfolgt (11.1).
- **Schreibhooks** sind `useMutation` ohne Wiederholung (Standard), **ohne** Kopf. Jeder Hook nennt in seiner
  JSDoc, **was** er nach Erfolg neu liest:

  | Hook (Datei in `src/hooks/admin/`) | Aufruf | liest nach Erfolg neu |
  |---|---|---|
  | `useProfilAnlegen`, `useProfilBlockieren`, `useProfilEntfernen` | 3.1 | `adminProfile` |
  | `useProfilBearbeiten` | | `adminProfile` und (Skillwerte ändern die `teilnehmerVersion` künftiger Termine) `terminAlle` |
  | `useTerminAnlegen`, `useSerieAnlegen`, `useTerminAendern`, `useTerminAbsagen`, `useTerminEntfernen` | | Termine (`termine`, `terminAlle`, `termineVerlauf`) |
  | (C8) `useGastStufe`, `useHalleAbsagen`, `useErgebnisKorrigieren`, `useKonfigurationAendern`, `useGaesteFreigeben`, `useTeamsManuell` | | siehe `C8_UMSETZUNG.md`, 4.1 |
  | `usePinAendern` | | `sitzungsendeAusloesen(HINWEIS_PIN_GEAENDERT)` |
  | `useNameAnfordern`, `useNameBestaetigen` | | nichts (die Sitzung bleibt; Hinweistext statt Cache-Änderung) |

  Die Neu-Lese-Gruppe der Termine steht **einmal** in `src/hooks/admin/termineNeuLesen.ts`
  (`Promise.all` über die drei Schlüssel, wie `neuLesen` in `useRueckmeldung`). **Der Hook gibt das Versprechen
  zurück** (`onSuccess: () => termineNeuLesen()`): Die Mutation bleibt `pending`, bis die Daten da sind, und der
  Dialog zeigt den neuen Stand statt des alten (C5-Regel).
- **`mutateAsync` mit `try`/`catch`, wo der Aufrufer nach dem Erfolg verschwindet** (Weiterleitung nach dem
  Anlegen, Schliessen eines Dialogs, dessen Elternbaustein sich ändert): `mutate(..., { onSuccess })` verliert den
  Rückruf, wenn der Aufrufer ausgehängt ist (C5, Regressionstests 11.1).
- **Fokus** nach Dialog, Weiterleitung oder Listenänderung gezielt setzen (C5-Falle: Fokus landet sonst auf
  `body`): nach „Anlegen“ auf die Überschrift der Zielseite, nach „Entfernen“ in der Liste auf die Überschrift,
  nach Dialog-Abbruch auf die auslösende Schaltfläche (`Dialog` stellt das bereits her).

### 4.2 `DATEN_VERALTET` (E5) – ein Muster für drei Formulare (Termin ändern in C7; Konfiguration und Ergebniskorrektur in C8)

```tsx
// Elternbaustein: besitzt Abfrage UND Mutation, damit die Meldung den Neuaufbau überlebt.
const abfrage = useKonfiguration()
const speichern = useKonfigurationAendern()
const veraltet = speichern.error instanceof ApiFehler && speichern.error.code === 'DATEN_VERALTET'

{abfrage.data && (
  <KonfigurationFormular
    key={abfrage.data.version}            // neuer Stand ⇒ neues Formular mit den frischen Werten
    daten={abfrage.data}
    speichern={speichern}
    beiVeraltet={veraltet}                // Hinweistext oberhalb: „Zwischenzeitlich geändert … Eingaben zurückgesetzt.“
  />
)}
```

- Der Hook liest bei `DATEN_VERALTET` **sofort neu** (`onError`), sonst bliebe der alte Stand stehen. Nach dem
  Neuaufbau zeigt der Text, was geschah; er verschwindet mit der nächsten Eingabe (`speichern.reset()` beim ersten
  `onChange` des neuen Formulars).
- `key={version}` baut auch nach **eigenem** Speichern neu auf (die `version` steigt um 1); das ist erwünscht,
  das Formular zeigt dann den gespeicherten Stand. Bei der Konfiguration und der Ergebniskorrektur ist es ein
  Voll-Update, beim Termin trägt der Schlüssel die `version` der Einzelansicht.
- **Nicht** mit der neuen `version` und den alten Eingaben automatisch erneut senden.

### 4.3 Sonstige gemeinsame Regeln

- **Pfade und Ziele** nur aus `ADMIN_PFADE` (Erweiterung in 6.1); Funktionen für parametrisierte Pfade
  (`terminVerwaltung(terminId)`, `profilBearbeiten(spielerId)`) stehen ebenfalls dort.
- **Parameter prüfen:** `:terminId` und `:spielerId` mit `useTerminParameter` bzw. dem gleichen Muster
  (`useSpielerParameter`: positive ganze Zahl, sonst `NichtGefunden` **ohne** Abruf).
- **Keine Skillwerte ausserhalb der Admin-Ansichten:** Die Skillwerte erscheinen nur in `AdminProfilFormular`,
  nie in Liste, Dashboard, Teams oder Dialogen (DESIGN.md, A12). `differenzTeamstaerke` nur in `/admin/teams`.
- **Uhr im Render verboten** (react-hooks v7): Fristen über `useZeitpunktErreicht` (C8, 5.5), Datum für `min`
  einmalig über `useState(() => heuteIso(new Date()))`.
- **Ladezustand, Leerzustand, Fehlerzustand** je Ansicht (DESIGN.md): `Ladespinner`, `Leerzustand`,
  `Fehlerzustand` mit „Erneut versuchen“; Mutationsfehler als `Fehlermeldung` über der Aktion.

---

## 5. Gemeinsame Bausteine

Jeder Baustein: Komponente, `module.scss` (nur Tokens, kein Hexwert), Test, JSDoc mit Begründung. Reihenfolge nach
Bedarf der Stufen.

### 5.1 `Bestaetigung` (Stufe 1, vor den ersten Dialogen)

Dünner Baustein um `Dialog`; acht Stellen brauchen denselben Aufbau (PIN, Profil entfernen, Profil sperren
(online), Termin absagen/entfernen/abschliessen, Serie anlegen, Gäste freigeben, Halle, Ergebnis).

```tsx
<Bestaetigung
  offen={offen}
  titel="Termin absagen?"
  bestaetigenText="Termin absagen"
  art="gefahr"                       // 'gefahr' | 'primaer'
  laedt={absagen.isPending}          // sperrt „Abbrechen“, Escape und Hintergrund: `festhalten`
  fehler={absagen.error}             // Fehlermeldung im Dialog, der Dialog bleibt offen
  beiBestaetigen={() => void absagen.mutate(terminId)}
  beiAbbruch={() => setOffen(false)}
>
  <p>Die Absage ist endgültig. …</p>   {/* Folgen in ganzen Sätzen, nicht „Sind Sie sicher?“ */}
</Bestaetigung>
```

- **Der Dialog nennt die Folgen**, nicht die Frage; Beschriftung der Bestätigung ist das Verb („Termin absagen“),
  nicht „OK“. Abbrechen ist die zuerst fokussierte Aktion bei `art="gefahr"`.
- Test: Fokus, Escape, `festhalten` während `laedt`, Fehler im Dialog, Rückgabe des Fokus.
- Den Dialog dort einhängen, wo `ErgebnisFormular` ihn einhängt (innerhalb des Behälters der Aktionsleiste), damit
  die sticky Leiste und der Dialog sich nicht überlagern.

### 5.2 `Verwaltungsliste` (Stufe 1)

Liste von Zeilen mit Titel, einem Satz Untertitel und Pfeil, als Links (`<nav aria-label="Verwaltung">` mit `<ul>`),
Tap-Ziel mindestens 56 px, **keine** ARIA-Tab-Rollen. Eingaben: `eintraege: { to, titel, text, symbol?, 'data-testid' }[]`,
Gruppenüberschrift als `h2`. Dient dem Dashboard (7) und, falls gewünscht, der Zugangsgruppe.

### 5.3 `SkillFelder` (Stufe 2)

Controlled: `kategorien: SkillKategorie[]`, `werte: Record<string, string>`, `beiAenderung(schluessel, text)`,
`fehler?: Record<string, string>`, `vorbelegtHinweis?: boolean`. Je Kategorie ein `Feld`
(`type="number"`, `inputMode="numeric"`, `min`, `max`, `step=1`, Beschriftung `bezeichnung`, Hinweis
„0 bis 6“ aus `minWert`/`maxWert`). **Die Werte bleiben Text bis zum Senden** (leer ist ein Zustand, 0 ein Wert);
`skillZahl(text, kategorie)` prüft ganze Zahl im Bereich, sonst `null`. Hilfsfunktionen im Modul
(`src/api/admin/skills.ts`, rein, getestet):

```ts
export const mitte = (k: SkillKategorie) => Math.round((k.minWert + k.maxWert) / 2)   // 0..6 → 3, 0..3 → 2
export const skillsVollstaendig = (skills: Record<string, number>, kat: SkillKategorie[]) =>
  kat.every((k) => skills[k.schluessel] !== undefined)
export function skillsAenderung(vorher: Record<string, number>, jetzt: Record<string, number>): Record<string, number>
```

`skillsAenderung` liefert **nur** die geänderten Kategorien (Bearbeiten, E6); leer ⇒ nichts zu senden.

### 5.4 `ProfilListe`, `ProfilZeile` (Stufe 2)

Zeile: Name, Kennzeichen als **Text mit Symbol** (nicht allein Farbe): „gesperrt“, „online“ (`belegt`), „Admin“
(`rolle: ADMIN`), „Skillwerte unvollständig“ (E7), Bilanz „x S · y N · z U“ (Siege, Niederlagen, Unentschieden;
das Adminprofil ohne Bilanz); die Zeile ist ein Link zur Bearbeitung, **ausser** beim Adminprofil (kein Ziel,
`div`). **Keine Skillwerte in der Zeile.** Sortierung wie geliefert (Spieler vorn, Admin am Ende – Vertrag).

### 5.5 `useZeitpunktErreicht` (Stufe 5) → C8

Gehört zur Hallenabsage und steht in `C8_UMSETZUNG.md`, 5.5. Die Terminliste (8.2) braucht es nicht.

### 5.6 `TerminAnsicht` mit `nurLesen` (Stufe 1)

Neue Eigenschaft `nurLesen?: boolean` (Vorgabe `false`): blendet `Zusagestatus`, `RueckmeldungLeiste` und die
Verweise `Teams ansehen`/`Ergebnis ansehen` aus, behält Karte, Balken, Platzsatz, Teilnehmerliste und `children`.
Der Admin hat weder eine Rückmeldung noch einen Zusagestatus; die Ansicht darf ihm keinen vortäuschen. Tests:
Admin-Sitzung zeigt keinen Zusagestatus und keine Leiste; Standardverhalten unverändert.

### 5.7 `TerminFormular` (Stufe 3)

Gemeinsame Felder von „Einzeltermin anlegen“ und „Termin ändern“: Datum (`type="date"`, `min` = heute für
**Anlegen**, beim Ändern ebenfalls), Uhrzeit (`type="time"`), Ort (höchstens 160 Zeichen, Zähler ab 140).
Controlled, Fehlertexte je Feld; der Elternbaustein entscheidet, was gesendet wird. Datum und Uhrzeit **zusammen**
prüfen (Vergangenheit) – im Submit-Handler mit `Date.now()`, nicht im Render; die Server-Prüfung bleibt die
Wahrheit.

### 5.8 `StufeWahl` (Stufe 4) → C8

Gehört zur Skill-Stufe eines Gastes und zur manuellen Generierung und steht in `C8_UMSETZUNG.md`, 5.8.

### 5.9 `ErgebnisEingabe`, `TeamListen` (Stufe 5, Herauslösen) → C8

Steht in `C8_UMSETZUNG.md`, 5.9 (Herauslösen aus `ErgebnisFormular` und `TeamsAnzeige`).

---

## 6. Stufe 1 – Rahmen, Dashboard und Zugang (8,0 h)

Ziel der Stufe: Der Admin landet auf einem echten Dashboard, erreicht von dort jeden künftigen Bereich (Links auf
noch fehlende Ansichten führen zunächst auf `Platzhalter`) und pflegt zentrale PIN und Anmeldenamen. Damit steht
der Rahmen, den alle weiteren Stufen füllen.

### 6.1 Pfade und Routenbaum (ca. 0,5 h)

`ADMIN_PFADE` (`zielpfad.ts`) wächst; die Pfade stehen **nur dort**:

```ts
export const ADMIN_PFADE = {
  anmelden: '/admin/anmelden',                // vorhanden (C4)
  passwortVergessen: '/admin/passwort/vergessen',
  passwortNeu: '/admin/passwort/neu',
  start: '/admin',
  passwortAendern: '/admin/passwort/aendern',
  profile: '/admin/profile',
  profilNeu: '/admin/profile/neu',
  profilBearbeiten: (spielerId: number) => `/admin/profile/${spielerId}`,
  termine: '/admin/termine',
  terminNeu: '/admin/termine/neu',
  terminVerwaltung: (terminId: number) => `/admin/termine/${terminId}`,
  gaeste: '/admin/gaeste',
  konfiguration: '/admin/konfiguration',
  teams: '/admin/teams',
  pin: '/admin/pin',
  nameAendern: '/admin/name/aendern',
  nameBestaetigen: '/admin/name/bestaetigen',
} as const
```

Routenbaum unter `AdminRoute` (`routen.tsx`); jede Route trägt ihr Zurück-Ziel im `handle` (E1):

| Pfad | Seite | `handle` |
|---|---|---|
| `admin` | `AdminDashboard` | `ohneZurueck` (wie der bisherige Platzhalter) |
| `admin/passwort/aendern` | `PasswortAendern` (vorhanden) | `zurueck: start` (vorhanden) |
| `admin/pin` | `AdminPin` | `zurueck: start` |
| `admin/name/aendern` | `AdminNameAendern` | `zurueck: start` |
| `admin/name/bestaetigen` | `AdminNameBestaetigen` | `zurueck: nameAendern` |
| `admin/profile`, `admin/profile/neu`, `admin/profile/:spielerId` | `AdminProfile`, `AdminProfilFormular` (zweimal) | `zurueck: start`, `profile`, `profile` |
| `admin/termine`, `admin/termine/neu`, `admin/termine/:terminId` | `AdminTermine`, `AdminTerminNeu`, `AdminTerminDetail` | `zurueck: start`, `termine`, `termine` |
| `admin/gaeste`, `admin/konfiguration`, `admin/teams` | `AdminGaeste`, `AdminKonfiguration`, `AdminTeams` | `zurueck: start` |

- Bis eine Stufe ihre Seite liefert, steht dort `<Platzhalter titel="…" paket="C7">` (wie bisher für `/admin`).
  Die Routen `admin/gaeste`, `admin/konfiguration` und `admin/teams` bleiben am Ende von C7 **Platzhalter mit
  `paket="C8"`**; C8 ersetzt sie durch die Seiten.
- **`neu` vor `:id`:** React Router wertet statische vor dynamischen Segmenten; ein Test sichert, dass
  `/admin/profile/neu` das Formular zeigt und nicht „nicht gefunden“ (`neu` ist keine Zahl).
- **Der Platzhalter für `/admin` entfällt**; `Platzhalter` bleibt für `/einstellungen` (jetzt `paket="C9"`, bisher C8; Anpassung in `routen.tsx` am 18.10.2026 erledigt). `zielpfad.test.ts`
  ergänzt: Admin → `/admin`, Funktionen liefern die erwarteten Pfade.

### 6.2 Dashboard `/admin` (`AdminDashboard`, ca. 1,0 h; mit den Bausteinen 5.1, 5.2 und 5.6 ca. 2,0 h)

Von oben nach unten (Überschriften `h1` „Administration“, dann `h2`):

1. **Hinweis aus der Navigation** (`useNavigationsHinweis`, `Hinweis`, `role="status"`): erscheint nach der
   Namensänderung (6.4) und nach Anlegen/Entfernen, sofern jene Seiten auf `/admin` zurückführen.
2. **„Nächster Termin“:** `useTermine()` + `naechsterTermin(liste).termin`; mit Termin
   `<TerminAnsicht terminId eingeklappt nurLesen>` (5.6) und als `children` ein `Textlink`
   „Termin verwalten“ (`admin-termin-verwalten-link`) nach `ADMIN_PFADE.terminVerwaltung(id)`. Ohne geplanten
   Termin `Leerzustand` „Kein Termin geplant“ mit Link „Termin anlegen“ (`ADMIN_PFADE.terminNeu`). Laden und
   Fehler wie im User-Dashboard (`Ladespinner`, `Fehlerzustand` mit „Erneut versuchen“); **ein Fehler der
   Terminabfrage blockiert die Verwaltungsliste nicht** (beide stehen unabhängig).
3. **Verwaltungsliste** (`Verwaltungsliste`, 5.2) in drei Gruppen:

| Gruppe | Eintrag | Ziel | Untertitel |
|---|---|---|---|
| Verwaltung | Spielerprofile | `profile` | „Profile und Skillwerte pflegen, sperren, entfernen“ |
| | Termine | `termine` | „Anlegen, ändern, absagen, Ergebnis korrigieren“ |
| | Gastplätze | `gaeste` | „Angemeldete Gäste ansehen und Plätze freigeben“ |
| | Konfiguration | `konfiguration` | „Teilnehmerzahlen, Team-Generator, Sitzung, Halle, Push“ |
| Werkzeuge | Teams ohne Termin | `teams` | „Eine Einteilung für eine frei gewählte Gruppe rechnen“ |
| Zugang | Zentrale PIN | `pin` | „Neue PIN für alle Spieler festlegen“ |
| | Anmeldename | `nameAendern` | „Mit Bestätigung per E-Mail ändern“ |
| | Passwort | `passwortAendern` | „Bisheriges Passwort wird abgefragt“ |

- **Keine Aktionsleiste, keine Tab-Leiste.** Das Dashboard hat keine primäre Aktion; die Liste ist die Navigation.
- Links tragen `data-testid="admin-link-<ziel>"` (`profile`, `termine`, `gaeste`, `konfiguration`, `teams`,
  `pin`, `name`, `passwort`); der bisherige `admin-passwort-aendern-link` bleibt als Alias des Eintrags
  „Passwort“ erhalten (Test aus C4 bleibt gültig).
- Die Einträge „Gastplätze“, „Konfiguration“ und „Teams ohne Termin“ stehen von Anfang an in der Liste (sie ist der
  Endzustand); ihre Ziele zeigen bis C8 auf `Platzhalter` (6.1). Test: Die Links führen auf die jeweilige Route.
- **Der Admin sieht keinen Zusagestatus und keine Leiste** (E2); Test mit Admin-Sitzung.
- Erste Beobachtung am echten Server: Antwortet `GET /termine/lesen` für ADMIN mit `200`? (1.4).

### 6.3 Zentrale PIN `/admin/pin` (`AdminPin`, ca. 1,0 h)

- Aufbau: `h1` „Zentrale PIN ändern“; Satz „Die PIN erhalten die Spieler über deinen Weg. Alle Angemeldeten
  werden mit der Änderung abgemeldet.“; `PinFeld` (`stellen={4}`, `nurZiffern`, `autoComplete="off"`,
  Beschriftung „Neue PIN“, Hinweis „Genau vier Ziffern.“, Fehlertext aus `felder.neuePin`).
  `PinFeld` zeigt die Ziffern offen (`type="text"`): Es ist ein geteilter Code, kein persönliches Passwort, und eine
  Wiederholung entfällt wie bei C4/E3 – Sichtbarkeit ist die Kontrolle gegen Tippfehler.
- `Aktionsleiste` mit „PIN ändern“ (`admin-pin-absenden`, `aria-disabled` bis vier Ziffern, Grund als Text),
  öffnet `Bestaetigung` (E19, `art="gefahr"`): Titel „Zentrale PIN ändern?“; Text: „Alle Angemeldeten werden
  sofort abgemeldet, auch Spieler und Gäste, und du selbst. Sie brauchen die neue PIN über deinen Weg. Teile sie
  vorher oder direkt danach mit.“; Bestätigung „PIN ändern“.
- Hook `usePinAendern`: `onSuccess: () => sitzungsendeAusloesen(HINWEIS_PIN_GEAENDERT)` (Hook-Ebene, nicht `mutate`-
  Ebene: Die Seite wird beim Sitzungsende ausgehängt). Hinweistext
  `'Die zentrale PIN wurde geändert. Bitte melde dich mit der neuen PIN an.'`.
- **Kein Hexwert, keine neue Farbe**; der Dialog nutzt `art="gefahr"`.
- Test: Absenden gesperrt unter vier Ziffern; Dialog nennt die Abmeldung; nach `204` ruft der Hook
  `sitzungsendeAusloesen` mit dem Text; `400` zeigt den Text am Feld; Fehler im Dialog; Dialog schliesst sich bei
  Fehlern nicht.

### 6.4 Anmeldename `/admin/name/aendern` und `/admin/name/bestaetigen` (ca. 1,75 h)

Zwei Ansichten wie der Passwort-Reset (C4, E2): Das Anfordern und das Einlösen sind getrennte Vorgänge, und ein
Vorgang überlebt die Sitzung (1.1 Nr. 15).

**`AdminNameAendern`** (Schritt 1):
- `h1` „Anmeldenamen ändern“; Text: „Wir senden eine fünfstellige PIN an die hinterlegte E-Mail-Adresse. Der neue
  Name gilt erst nach der Bestätigung und ab deiner nächsten Anmeldung.“
- `Feld` „Neuer Anmeldename“ (`maxLength` 60, Hinweis „Gross- und Kleinschreibung zählen.“); gesendet wird der
  **getrimmte** Wert, leer ⇒ Absenden gesperrt.
- `Aktionsleiste`: „PIN anfordern“ (`admin-name-anfordern`); darüber (Textlink) „Ich habe bereits eine PIN“ nach
  `nameBestaetigen` (ohne Zustand).
- Erfolg (`202`): `navigate(nameBestaetigen, { state: { hinweis: 'Die PIN wurde an deine hinterlegte E-Mail-Adresse
  gesendet.', neuerName } })` – `mutateAsync` und `try`/`catch` in der Seite (Weiterleitung nach dem Erfolg).
- Fehler: `409 NAME_BELEGT` am Feld (Eingabe bleibt, Fokus), `429 NAME_AENDERUNG_GEDROSSELT` und
  `503 VERSAND_FEHLGESCHLAGEN` im Kasten (3.3); `503` ist unverändert wiederholbar.

**`AdminNameBestaetigen`** (Schritt 2):
- `h1` „Anmeldenamen bestätigen“; Hinweis aus `location.state` (`useNavigationsHinweis`); ist `neuerName` im Zustand
  vorhanden: „Neuer Anmeldename: **{name}**“ (reine Anzeige; nach einem Neuladen entfällt die Zeile, der Server
  kennt den Namen).
- `PinFeld` mit `stellen={5}`, Beschriftung „Bestätigungs-PIN“; fester Satz „Die PIN ist nur kurz gültig und auf
  fünf Versuche begrenzt.“ (die Dauer steht nicht im Vertrag, E20; **keine** Restzeitanzeige).
- `useSperre` für `429 PIN_GESPERRT` (Sekunden aus `wartesekunden`, wie in C4).
- Erfolg (`204`): `navigate(ADMIN_PFADE.start, { state: { hinweis: 'Anmeldename geändert. Er gilt ab der nächsten
  Anmeldung.' } })`. **Die Sitzung bleibt**, es gibt keinen Sitzungsende-Aufruf und kein Neuladen der Sitzung.
- Fehler: `401 NAME_PIN_FALSCH` (**kein Sitzungsende**; PIN leeren, Fokus ins Feld, Text am Feld),
  `409 NAME_AENDERUNG_UNGUELTIG` und `409 NAME_BELEGT` (Kasten mit Link „Neu anfordern“ nach `nameAendern`),
  `400` am Feld. Es wird **nur nach dem jeweiligen Code** geleert, nicht nach jedem Fehler (C4-Regel).
- Test: `401 NAME_PIN_FALSCH` beendet die Sitzung nicht (kein `sitzungsendeAusloesen`); `SESSION_UNGUELTIG` beendet
  sie; Hinweis auf dem Dashboard nach dem Erfolg.
- **Handprüfung:** Nach der Bestätigung mit dem alten Namen anmelden (muss scheitern), mit dem neuen (muss
  gelingen), dann zurücksetzen; höchstens drei Anforderungen je Stunde (1.4).

### 6.5 Tests und Abnahme der Stufe 1

Siehe 11 (Unit und E2E) und 12 (Abnahme, Nr. 1 bis 4).

---

## 7. Stufe 2 – Spielerprofile (8,5 h)

### 7.1 Datenzugriff, Hooks, Mocks (ca. 1,25 h)

`adminProfile.ts` (3.1), Schlüssel `adminProfile` und `adminSkills` (3.2), Hooks `useProfile`, `useSkillKategorien`,
`useProfilAnlegen`, `useProfilBearbeiten`, `useProfilBlockieren`, `useProfilEntfernen` (4.1; Lesehooks ohne
Polling), Mock-Welt `profile`, `skillKategorien` (3.4), Hilfen `src/api/admin/skills.ts` (5.3).

### 7.2 Liste `/admin/profile` (`AdminProfile`, ca. 2,0 h inkl. 5.3/5.4)

- `h1` „Spielerprofile“; Zahl „n Spielerprofile“ (ohne das Adminprofil) in einem Satz unter der Überschrift;
  `ProfilListe` (5.4); `Aktionsleiste` mit „Profil anlegen“ (`admin-profil-anlegen`, primär) nach `profilNeu`.
- Zustände: `Ladespinner`; `Fehlerzustand` mit „Erneut versuchen“; **Leerzustand**, wenn kein Profil mit `rolle: USER`
  existiert („Noch keine Spielerprofile“, Link „Profil anlegen“); das Adminprofil bleibt in der Liste.
- **Hinweis aus der Navigation** (Anlegen/Entfernen, 7.3, 7.4).
- Skill-Kennzeichnung (E7): `skillsVollstaendig(profil.skills, kategorien)`; die Kategorien kommen aus
  `useSkillKategorien`. Solange sie laden, **keine** Kennzeichnung (kein Flackern), kein Fehlerzustand der Liste bei
  Ausfall der Kategorien (Kennzeichnung entfällt still, die Liste bleibt benutzbar).

### 7.3 Formular `/admin/profile/neu` und `/admin/profile/:spielerId` (`AdminProfilFormular`, ca. 2,75 h inkl. 7.4)

Ein Baustein, zwei Routen (`modus="neu"` oder `"bearbeiten"`); `useSpielerParameter` prüft `:spielerId`
(ungültig ⇒ `NichtGefunden` **ohne** Abruf).

- **Gemeinsam:** `h1` („Profil anlegen“ / Profilname), `Feld` „Name“ (`maxLength` 60, Hinweis „Eindeutig; Gross- und
  Kleinschreibung zählen nicht als Unterschied.“), `SkillFelder` (5.3) mit den Kategorien aus
  `useSkillKategorien`; `Fehlertexte` aus `ApiFehler.felder` am Feld.
- **Kategorien noch nicht da:** Spinner; **Kategorienfehler:** `Fehlerzustand` (ohne die Kategorien lässt sich kein
  Formular bauen, nichts raten).
- **Anlegen** (`neu`): Werte mit `mitte(kategorie)` **vorbelegt** und sichtbar; Satz „Die Werte sind vorbelegt
  (Mitte der Skala). Bitte prüfe jeden Wert.“ (`skill-vorbelegt-hinweis`); „Profil anlegen“ gesperrt, solange der
  Name leer oder ein Wert keine ganze Zahl im Bereich ist. Gesendet wird `{ name, skills }` mit **allen**
  Kategorien (Vertrag). Erfolg: `mutateAsync` ⇒ `navigate(profile, { state: { hinweis: 'Profil „{name}“ angelegt.' } })`.
- **Bearbeiten:** Ausgangsstand aus `useProfile()` (das Profil per `spielerId`; nicht gefunden ⇒ „Profil nicht
  gefunden“ mit Link zur Liste, **nach** dem Laden). Das Formular baut sich aus dem **Stand des Profils** auf
  (`key` aus Name und Skillkarte): Nach dem Speichern oder einer fremden Änderung zeigt es den neuen Stand.
  Fehlt eine Kategorie in der Karte, ist das Feld leer mit dem Hinweis „Noch nicht bewertet“; gesendet wird sie nur,
  wenn der Admin einen Wert einträgt. Gesendet wird **nur das Geänderte** (`profilAenderung`, E6); „Speichern“
  (`admin-profil-speichern`) ist gesperrt, solange nichts geändert ist. Erfolg: `Hinweis` „Gespeichert.“
  (`role="status"`), Fokus bleibt auf der Schaltfläche, die Liste wird neu gelesen.
- **Das Adminprofil** (`rolle: ADMIN`): **kein Formular**, kein Sperren, kein Entfernen; stattdessen `Hinweis`
  „Das Adminprofil wird über den Anmeldenamen umbenannt.“ mit Link nach `nameAendern`.

```ts
/** Nur das Geänderte: Name (getrimmt, grossschreibungsempfindlich verglichen) und geänderte Kategorien. */
export function profilAenderung(
  vorher: { name: string; skills: Record<string, number> },
  jetzt: { name: string; skills: Record<string, string> },
  kategorien: SkillKategorie[],
): { name?: string; skills?: Record<string, number> } | null
```

Rückgabe `null`: nichts geändert (Speichern gesperrt). Ein Wechsel „Pruefspieler a“ → „Pruefspieler A“ **ist** eine
Änderung (der Server erlaubt die Korrektur der Schreibweise). Testfälle: nur Name; nur eine Kategorie; beides;
nichts; Kategorie neu gefüllt, die in der Karte fehlte; Leerzeichen am Namen.

### 7.4 Sperren und Entfernen (in 7.3 enthalten)

Im Bearbeiten-Formular unterhalb, als eigener Abschnitt (`h2` „Status“), nicht in der Aktionsleiste:

- **Sperren/Entsperren** (`admin-profil-sperren`): Text „Gesperrt: erscheint nicht mehr in der Namensauswahl, der
  Name bleibt belegt.“ Beim **Sperren eines online befindlichen** Profils (`belegt`) öffnet `Bestaetigung`: „{Name} ist
  gerade angemeldet und wird sofort abgemeldet.“ In allen anderen Fällen (auch Entsperren) **ohne Dialog**. Die
  Schaltfläche behält ihr Element und wechselt nur Beschriftung und Zustandstext (Fokus bleibt).
- **Entfernen** (`admin-profil-entfernen`, `art="gefahr"`): Dialog „Profil entfernen?“ mit „Das ist nur für ein
  Profil gedacht, das noch nie benutzt wurde, etwa nach einem Tippfehler. Für alles andere sperre es.“ Erfolg:
  `mutateAsync` ⇒ `navigate(profile, { state: { hinweis: 'Profil „{name}“ entfernt.' } })`. `409 PROFIL_IN_VERWENDUNG`:
  Dialog schliesst, im Abschnitt erscheint der Hinweis „Das Profil hat bereits Daten (Rückmeldungen, Teams,
  Ergebnisse) und lässt sich nicht entfernen.“ mit der Aktion „Stattdessen sperren“.
- Beide Aktionen entfallen beim Adminprofil.

### 7.5 Tests und Abnahme der Stufe 2

Siehe 11 und 12 (Nr. 5 bis 7).

---

## 8. Stufe 3 – Termine (11,0 h)

### 8.1 Datenzugriff, Hooks, Mocks (ca. 1,25 h)

`adminTermine.ts` (3.1), Hooks `useTerminAnlegen`, `useSerieAnlegen`, `useTerminAendern`, `useTerminAbsagen`,
`useTerminEntfernen` und die gemeinsame `termineNeuLesen` (4.1), Mock-Welt (3.4) mit den
`TerminModell`en aus `termine.ts` samt `version`, Serie, `TERMIN_BELEGT`, Vergangenheitsprüfung.
Ausbau von `TerminKarte` um `ueberschriftRef` (Fokusziel nach Absage/Abschliessen, 8.5).

### 8.2 Liste `/admin/termine` (`AdminTermine`, ca. 1,25 h)

- `h1` „Termine“; `Aktionsleiste` mit „Termin anlegen“ (`admin-termin-anlegen`) nach `terminNeu`.
- Abschnitt `h2` „Kommende Termine“ (`useTermine()`, Polling wie am Dashboard) und `h2` „Vergangene Termine (letzte
  {VERLAUF_TAGE} Tage)“ (`useVerlauf()`, E9). Zeile (`AdminTerminZeile`): „Di., 20.10. · 20:00 Uhr“, Ort, Status als
  **Text mit Symbol** (geplant / abgesagt / abgeschlossen), „n Zusagen“ nur bei `GEPLANT`/`ABGESCHLOSSEN`, bei
  Serientermin der Hinweis „Serie“ (`serieId !== null`); die ganze Zeile ist ein Link zu `terminVerwaltung(id)`
  (**auch abgesagte**: Entfernen).
- Jeder Abschnitt hat **eigenen** Lade-, Leer- und Fehlerzustand („Keine kommenden Termine“ mit Link zum Anlegen;
  „Keine vergangenen Termine“); ein Fehler des einen blockiert den anderen nicht.
- **Hinweis aus der Navigation** („Termin entfernt.“).
- **Grenze:** Termine, die länger als {VERLAUF_TAGE} Tage zurückliegen, sind in der Verwaltung nicht erreichbar (dasselbe
  Fenster wie der Verlauf, C5 E14); ihr Ergebnis lässt sich also nur innerhalb des Fensters korrigieren. Ein grösseres
  Fenster, ein Abruf ohne `ab` (alle Termine, Vertrag seit 18.10.2026) oder eine Datumsauswahl wäre eine spätere
  Entscheidung (1.4).

### 8.3 Anlegen `/admin/termine/neu` (`AdminTerminNeu`, ca. 2,75 h)

- `h1` „Termin anlegen“; Radiogruppe „Art“ (`fieldset`/`legend`): **Einzeltermin** (Vorgabe) / **Serie**
  (`admin-art-einzel`, `admin-art-serie`). Der Wechsel behält Datum/Uhrzeit/Ort.
- **Einzeltermin:** `TerminFormular` (5.7). „Termin anlegen“ in der `Aktionsleiste`, gesperrt ohne Datum und
  Uhrzeit. Erfolg: `mutateAsync` ⇒ `navigate(terminVerwaltung(id), { state: { hinweis: 'Termin angelegt.' } })`.
  `409 TERMIN_BELEGT` am Zeitfeld, Eingaben bleiben.
- **Serie:** Felder `Titel` (Pflicht, 80), `Wochentag` (`Auswahlliste`, Montag bis Sonntag, Werte `'1'`…`'7'`,
  **ohne Vorauswahl**), `Uhrzeit`, `Startdatum`, `Enddatum` (**muss nach dem Startdatum liegen**, strikt;
  Clientprüfung mit Text „Das Enddatum muss nach dem Startdatum liegen.“, der Server bleibt die Wahrheit), `Ort`.
  Hinweis am Startdatum: „Fällt es selbst auf den Wochentag, gehört es zur Serie.“ Vor dem Senden `Bestaetigung`
  „Serie anlegen?“ („Alle passenden Termine werden sofort angelegt, höchstens 52. Eine Serie lässt sich danach nicht
  mehr ändern; einzelne Termine lassen sich einzeln ändern, absagen oder entfernen.“).
- **Ergebnis der Serie** (`SerieErgebnis`, ersetzt das Formular, nicht die Seite):
  - `h2` „Serie angelegt“ (bekommt den Fokus), Satz „{n} Termine angelegt.“ (`angelegteTermine.length`).
  - **Übersprungene Zeitpunkte** (`uebersprungeneTermine`, `YYYY-MM-DD`, ohne Uhrzeit): Liste „Übersprungen, weil zu
    diesem Zeitpunkt bereits ein Termin liegt:“ mit `datumLang`; leer ⇒ „Es wurde kein Zeitpunkt übersprungen.“
    **Dieser Absatz ist Pflicht** (DESIGN.md Ansicht 11, sonst fällt eine unvollständige Serie erst beim Nachzählen
    auf).
  - Die angelegten Termine als Liste von Links zur Verwaltung (`datumKurz`, `uhrzeitKurz`); Link „Zu den Terminen“
    nach `termine`.
- Erfolg der Serie: `mutateAsync` im `try`/`catch`; der Ergebniszustand liegt in der Seite, die Mutation wartet auf
  das Neulesen (4.1), das Ergebnis erscheint also auf aktuellem Stand.
- **Uhr im Render:** `min` des Datumsfeldes aus `useState(() => heuteIso(new Date()))`; die Vergangenheitsprüfung
  (Datum + Uhrzeit) im Submit-Handler mit `Date.now()`.

### 8.4 Verwaltungsansicht `/admin/termine/:terminId` (`AdminTerminDetail`; Rahmen in 8.5 mitgerechnet)

- `useTerminParameter` (ungültig ⇒ `NichtGefunden` ohne Abruf).
- **Aufbau:** `TerminAnsicht` mit `nurLesen`, `eingeklappt={false}` und dem neuen `ohneAktualisierung`
  (reicht `useTermin(terminId, 0)` durch, 4.1), darunter als `children` `TerminVerwaltung` (liest über
  `useTermin(terminId, 0)` **denselben Cache-Eintrag** und zeigt seine Abschnitte nur, wenn Daten da sind; Laden,
  `404` und Fehler zeigt `TerminAnsicht`).
- **Hinweis aus der Navigation** („Termin angelegt.“).
- Abschnitte (jeder mit `h2`, in dieser Reihenfolge; nicht jeder Zustand zeigt jeden):

| Abschnitt | Zeigt bei | Stufe |
|---|---|---|
| „Termin ändern“ (8.5) | `GEPLANT` | 3 |
| „Gäste“ – Stufe ändern (C8, 9.4) | `GEPLANT` und mindestens ein Gast in der Teilnehmerliste | **C8** |
| „Hallenabsage“ (C8, 10.1) | nach Tabelle in 10.1 | **C8** |
| „Ergebnis“ (C8, 10.2) | `ABGESCHLOSSEN` | **C8** |
| „Weitere Aktionen“ (8.5): Abschliessen, Absagen, Entfernen | je nach Status | 3 |

**Schnittstelle zu C8:** Die drei Abschnitte aus C8 (Gäste, Hallenabsage, Ergebnis) hängen als eigene Bausteine in
`TerminVerwaltung` und teilen sich dessen Abfrage (`useTermin(terminId, 0)`). C7 baut `TerminVerwaltung` daher so, dass
jeder Abschnitt ein eigener Baustein ist, der in der Tabellenreihenfolge eingehängt wird; C7 zeigt **keine** Platzhalter für
die C8-Abschnitte.

- **Keine sticky `Aktionsleiste` auf dieser Seite:** Sie hat mehrere Abschnitte mit eigenen Schaltflächen; eine
  Leiste liesse offen, auf welchen Abschnitt sie wirkt. Jede Aktion steht im Abschnitt, in dem sie wirkt.

### 8.5 Ändern, Abschliessen, Absagen, Entfernen (ca. 2,5 h inkl. Rahmen 8.4)

**Termin ändern** (`TerminAendernFormular`, nur `GEPLANT`):
- `TerminFormular` mit dem Stand des Termins; **diffbasiert** (E11): gesendet werden nur geänderte Felder, `""` leert
  den Ort (nicht `null`), `version` aus dem Stand, mit dem das Formular gebaut wurde. „Änderungen speichern“
  (`admin-termin-speichern`) gesperrt ohne Änderung (ein Körper ohne Änderung ist `400`).
- **E5:** `key={termin.version}`; Elternbaustein (`TerminVerwaltung`) hält die Mutation; bei `DATEN_VERALTET` liest der
  Hook neu, das Formular baut sich mit dem frischen Stand neu, Text „Der Termin wurde zwischenzeitlich geändert.
  Deine Eingaben wurden zurückgesetzt; bitte prüfe den aktuellen Stand und ändere erneut.“
- Hinweis unter den Feldern (aus A7/A19-Folgen): „Eine Verschiebung von Datum oder Uhrzeit setzt die Fixierung der
  Teams zurück und löst die Erinnerung neu aus.“ (nach `AGENT.md`; in der Handprüfung bestätigen).
- Fehler (3.3): `TERMIN_BELEGT` am Zeitfeld, `TERMIN_GESCHLOSSEN` als Hinweis plus Neulesen.
- Erfolg: `Hinweis` „Gespeichert.“, Fokus bleibt an der Schaltfläche.

**Weitere Aktionen** (`h2`; jede Aktion **Dialog** mit Folgen, E11/E12):
- **Termin abschliessen** (`GEPLANT`, sekundär): „Der Termin gilt danach als abgeschlossen. Rückmeldungen sind nicht
  mehr möglich; Ergebnisse lassen sich erfassen, sofern eine Teameinteilung vorliegt. Das lässt sich nicht
  rückgängig machen.“ Aufruf `terminAendern({ terminId, version, status: 'ABGESCHLOSSEN' })`.
- **Termin absagen** (`GEPLANT`, `art="gefahr"`): „Die Absage ist endgültig. Der Zeitpunkt bleibt belegt; einen
  neuen Termin zu diesem Zeitpunkt gibt es erst, wenn du diesen entfernst – und das geht nur, solange niemand
  geantwortet hat.“ Aufruf `terminAbsagen(terminId)`.
- **Termin entfernen** (`GEPLANT` und `ABGESAGT`, `art="gefahr"`): „Das lässt sich nicht rückgängig machen; es bleibt
  nur der Protokolleintrag.“ `409 TERMIN_IN_VERWENDUNG`: Dialog schliesst, Hinweis „Am Termin hängen Rückmeldungen
  oder Teams; er lässt sich nicht entfernen.“ und – bei `GEPLANT` – die Aktion „Stattdessen absagen“. Erfolg:
  `mutateAsync` ⇒ `navigate(termine, { state: { hinweis: 'Termin entfernt.' } })`.
- **Fokus nach Absagen/Abschliessen:** Die Aktionen verschwinden mit dem Statuswechsel; der Fokus wandert auf die
  Überschrift der `TerminKarte` (`ueberschriftRef`, `tabIndex={-1}`), sonst landet er auf `body` (C5-Falle).
- Der Dialog **bleibt bei Fehlern offen** und zeigt den Fehler (`Bestaetigung`, 5.1).

### 8.6 Skill-Stufe eines Gastes → C8

Verschoben nach `C8_UMSETZUNG.md`, 9.4: Sie liest die Gastplätze (`useGastplaetze`, Stufe 4), um die Stufe vorzubelegen,
und gehört darum zur Gastverwaltung. `StufeWahl` (5.8) entfällt dadurch in C7.

### 8.7 Tests und Abnahme der Stufe 3

Siehe 11 und 12 (Nr. 8 bis 11).

---

## 9. Stufe 4 – Konfiguration und Gastplätze → C8

Verschoben nach `C8_UMSETZUNG.md`, Abschnitt 9 (Konfiguration, Gastplätze und die Skill-Stufe eines Gastes aus 8.6; 10,5 h).

---

## 10. Stufe 5 – Hallenabsage, Ergebniskorrektur, manuelle Teamgenerierung → C8

Verschoben nach `C8_UMSETZUNG.md`, Abschnitt 10 (11,0 h).

---

## 11. Tests (über die Stufen verteilt; Anteile im Zeitplan, 15; die Tests der Stufen 4 und 5 stehen in C8, Abschnitt 11)

### 11.1 Unit (Vitest, MSW, echter `queryClient`)

- **API** (je Funktion: Pfad, Methode, Körper): **keine** der 14 neuen Funktionen und kein Lesehook sendet
  `X-FuBo-Kein-Refresh` (Ausnahme: das vorhandene `useTermin`); `terminAendern` sendet `status` nur, wenn gesetzt;
  `terminAnlegen` lässt einen leeren Ort weg.
- **Reine Funktionen:**
  - `skills.ts`: `mitte` (0 bis 6 ⇒ 3, 0 bis 3 ⇒ 2), `skillsVollstaendig`, `skillsAenderung`; **mit selbst erfundenen
    Kategorien**, damit nichts fest verdrahtet ist.
  - `profilAenderung`: nur Name; nur eine Kategorie; beides; nichts (`null`); Kategorie neu gefüllt, die in der Karte
    fehlte; Randleerzeichen; reine Gross-/Kleinschreibung ist eine Änderung.
  - Serienprüfung (Enddatum nicht nach Startdatum), Wochentagsnamen.
- **Hooks:** Lesehooks rufen einmal und pollen nicht (60 s Fake-Zeit ⇒ ein Abruf); `useTermin(id, 0)` pollt nicht;
  jede Mutation liest die Gruppe aus 4.1 neu (**mit beobachteter Abfrage daneben**, sonst lädt `invalidateQueries`
  nichts neu) und bleibt bis dahin `pending` (verzögerter Mock-Abruf); kein zweiter Versuch bei `500`;
  `usePinAendern` ruft `sitzungsendeAusloesen` mit dem Text; `useNameBestaetigen`: `NAME_PIN_FALSCH` beendet die Sitzung
  **nicht**, `SESSION_UNGUELTIG` schon.
- **Bausteine:** `Bestaetigung` (Fokus, Escape, `festhalten` während `laedt`, Fehler im Dialog, Rückgabe des Fokus),
  `Verwaltungsliste` (Links, `aria-label`, keine ARIA-Tab-Rollen), `SkillFelder` (Grenzen aus den Kategorien, Text bleibt
  Text), `ProfilListe` (Kennzeichen als Text, Adminzeile ohne Link, **keine Skillwerte im DOM**), `TerminFormular`,
  `SerieErgebnis` (der Absatz zu den Übersprungenen ist immer da), `TerminAnsicht nurLesen` (Admin: kein Zusagestatus,
  keine Leiste, keine Verweise) und `ohneAktualisierung`.
- **Seiten** (je Zustand: laden, leer, Fehler, Normalfall, jeder Fehlercode aus 3.3):
  - Dashboard, `AdminPin`, `AdminNameAendern`, `AdminNameBestaetigen`.
  - `AdminProfile`; `AdminProfilFormular` (Anlegen: Vorbelegung sichtbar, **alle** Kategorien im Körper, `NAME_BELEGT` am
    Feld; Bearbeiten: nur Geändertes im Körper, Lücke „Noch nicht bewertet“, Adminprofil ohne Formular und Aktionen,
    Sperren eines Online-Profils mit Dialog, Entsperren ohne, Entfernen mit `PROFIL_IN_VERWENDUNG` ⇒ „Stattdessen
    sperren“).
  - `AdminTermine` (zwei unabhängige Abschnitte), `AdminTerminNeu` (Einzel; Serie mit Dialog und Ergebnis samt
    Übersprungenen; `TERMIN_BELEGT`), `AdminTerminDetail` (Abschnitte je Status; Ändern diffbasiert; Absagen,
    Abschliessen, Entfernen mit Fokus).
- **E5 für „Termin ändern“** (Konfiguration und Ergebniskorrektur: C8): Mit `welt.fremdeAenderung()` die `version` erhöhen, speichern, `409` ⇒ das Formular zeigt
  den **frischen** Stand und den Text; ein zweites Speichern sendet die **neue** `version` nur nach neuer Eingabe.
- **Regression für `mutateAsync`** (Muster `Huelle` aus C5): Anlegen ⇒ Weiterleitung, Entfernen ⇒ Weiterleitung, Namen
  anfordern ⇒ Weiterleitung, Serie ⇒ Ergebnis; jeweils so, dass die Weiterleitung auch dann geschieht, wenn der Aufrufer
  durch das Neulesen ausgehängt wird.
- **Routen:** `/admin/profile/neu` zeigt das Formular, nicht „nicht gefunden“; ungültige Ids (`abc`, `0`, `-1`) ⇒ „nicht
  gefunden“ **ohne Abruf**; Nicht-Admin ⇒ `/`; ohne Sitzung ⇒ Anmeldung; jeder neue Pfad steht in `ADMIN_PFADE`.

### 11.2 E2E (Playwright, drei Chromium-Projekte lokal, alle sieben im CI)

Neuer Helfer `e2e/hilfen/admin.ts` (`adminNachbilden(page, welt)`, zustandsbehaftet wie `termineNachbilden`; liefert
Zähler für Aufrufe und die gesendeten Körper) auf Basis von `sitzungNachbilden(page, { rolle: 'ADMIN' })`.

| Spezifikation | Inhalt |
|---|---|
| `admin-dashboard.spec.ts` | Dashboard mit/ohne Termin; **kein** Zusagestatus, keine Tab-Leiste; jeder Link führt zum Bereich, „Zurück“ zur Übergeordneten; Hinweis nach Rückkehr |
| `admin-zugang.spec.ts` | PIN ändern ⇒ Dialog, Abmeldung, Hinweis auf der PIN-Eingabe; Namen anfordern ⇒ bestätigen ⇒ Hinweis auf dem Dashboard, Sitzung bleibt; falsche PIN ohne Sitzungsende; „Ich habe bereits eine PIN“ |
| `admin-profile.spec.ts` | Anlegen (Körper hat alle Kategorien) ⇒ Liste; Bearbeiten (Körper nur Geändertes); Sperren/Entsperren; Entfernen mit Konflikt; Adminprofil ohne Aktionen |
| `admin-termine.spec.ts` | Einzeltermin anlegen; Serie mit Übersprungenen; Ändern; **Konflikt über zweite Seite ⇒ Formular zurückgesetzt**; Absagen (Fokus), Abschliessen, Entfernen |

- **Layout:** Jede Admin-Seite bei 360 px **ohne waagerechte Bildlaufleiste** (Schleife über alle Pfade); Tap-Ziele
  mindestens 44 px; die sticky `Aktionsleiste` verdeckt keine Eingabe (Fenster 360 × 640 und mit geöffneter Tastatur
  nachgestellt, Fensterhöhen unter 740 px beobachten; die Grenze nicht ohne Anlass verschieben).
- `aria-disabled`-Aktionen: `click({ force: true })` (C5-Falle).
- Die Cloud-Kopie (`/tmp/e2e-cloud`, `pw.cloud.config.ts`) wie in C5 für Chromium; WebKit nur im CI.

### 11.3 Gegenproben (Test rot ohne Absicherung)

Wie in C5 (Skript mit Ergebnisprüfung auf „failed“, nicht auf die letzte Zeile): Je Mutation muss mindestens ein Test
rot werden; gleichwertige Mutanten werden benannt, nicht gezählt.

| Nr. | Mutation | Erwartung |
|---|---|---|
| M2 | `profilAenderung` sendet alle Kategorien statt der geänderten | Unit und E2E rot |
| M3 | `key={version}` am Formular entfernt (E5) | E5-Tests rot |
| M4 | `useTermin(id, 0)` zu `useTermin(id)` (pollt) | Poll-Test rot |
| M5 | Dialog beim Sperren eines Online-Profils entfällt | Seitentest rot |
| M8 | `NAME_PIN_FALSCH` löst das Sitzungsende aus | Hook- und Seitentest rot |
| M9 | `mutate({ onSuccess })` statt `mutateAsync` nach dem Anlegen | Regressionstest rot |
| M10 | Absatz der übersprungenen Zeitpunkte entfällt bei leerer Liste | `SerieErgebnis`-Test rot |
| M14 | `useTermin`-Neulesen nach Mutation fehlt (`terminAlle` vergessen) | Hook-Test rot |

M1, M6, M7 und M11 bis M13 gehören zu den Stufen 4 und 5 und stehen in `C8_UMSETZUNG.md`, 11.3; ihre Nummern bleiben.

---

## 12. Abnahme von C7

1. `npm run lint`, `typecheck`, `test`, `build`; **ein** `fetch(`; kein Hexwert ausserhalb der Tokendatei; Suche nach
   verwaisten Pfaden (`AGENT_CLIENT.md`); `grep` nach `skills`/`differenzTeamstaerke` ausserhalb von `AdminProfilFormular`,
   `adminProfile.ts` und den Mocks (ab C8 auch `AdminTeams`, `adminTeams.ts`): **kein Treffer in Spieleransichten**.
2. E2E in den drei Chromium-Projekten lokal, alle sieben im CI (Layout bei Fensterhöhen unter 740 px beobachten).
3. **Handprüfung Stufe 1 gegen den echten Server:** `GET /termine/lesen` für ADMIN (1.4); **zentrale PIN** ändern (zweites
   Gerät als Spieler angemeldet ⇒ abgemeldet; der Admin selbst mit Hinweis abgemeldet; Anmeldung mit der neuen PIN;
   danach zurücksetzen); **Anmeldename** (E-Mail trifft ein, falsche PIN, richtige PIN, Hinweis, alter Name scheitert,
   neuer gelingt, zurücksetzen; höchstens drei Anforderungen je Stunde); Dauer der Namens-PIN notieren.
4. Sichtprüfung bei 360 px: Dashboard (mit/ohne Termin), PIN, Name (beide Ansichten), mit Tastatur geöffnet.
5. **Handprüfung Profile:** Anlegen (Vorbelegung sichtbar), Liste, Bearbeiten (im Netzwerkprotokoll nur Geändertes),
   Sperren eines angemeldeten Spielers (er wird abgemeldet), Entsperren, Entfernen eines frischen Profils, Entfernen
   eines Profils mit Zusage ⇒ `PROFIL_IN_VERWENDUNG`, Adminprofil ohne Aktionen.
6. Kategorien aus dem Server: sind alle fünf Kategorien mit Bereichen da? (Falls der Testserver es erlaubt: eine Kategorie
   abschalten ⇒ das Formular passt sich an, ohne Frontend-Änderung.)
7. Sichtprüfung bei 360 px: Liste (Kennzeichen ohne Umbruch), Formular (alle Felder, Statusabschnitt), alle Dialoge.
8. **Handprüfung Termine anlegen:** Einzeltermin; gleicher Zeitpunkt ⇒ `TERMIN_BELEGT`-Text; Vergangenheit ⇒ Text.
9. **Serie:** drei Termine mit einer Kollision ⇒ die Ergebnisansicht nennt den übersprungenen Zeitpunkt; falsches
   Enddatum ⇒ Text; mehr als 52 Wochen ⇒ Meldung mit Zahl.
10. **Ändern und Konflikt:** Datum ändern; Ort leeren; mit zwei Browsern gleichzeitig ändern ⇒ der zweite sieht den
    Konflikttext und den frischen Stand; **Abschliessen** und danach Ergebnisse erfassen lassen (**die C5-Handprüfung Nr. 6
    damit nachholen**; Teams vorher generieren, sonst `ergebnis-ohne-einteilung`; **mindestens `minTeilnehmer` Zusagen**, sonst
    setzt der Server den Termin nach 30 Minuten selbst auf `ABGESAGT` und ein Ergebnis lässt sich nicht erfassen; das gilt nur
    für den automatischen Übergang, „Abschliessen“ durch den Admin setzt `ABGESCHLOSSEN` unmittelbar).
11. **Absagen und Entfernen:** Absagen ⇒ Status, Dialogtext; Entfernen eines abgesagten Termins ohne Rückmeldungen ⇒
    der Zeitpunkt ist wieder frei (Neuanlegen gelingt); Entfernen mit Rückmeldungen ⇒ `TERMIN_IN_VERWENDUNG`.
12. **Gesamtdurchgang als Admin (Stand C7):** nirgends ein Zusagestatus oder eine Tab-Leiste; Skillwerte nur im
    Profilformular; kein Cache-Rest nach PIN- und Passwortwechsel; Abmelden aus jedem Bereich; die Einträge „Gastplätze“,
    „Konfiguration“ und „Teams ohne Termin“ führen auf Platzhalter. **Die Handprüfungen Gast-Stufe, Konfiguration,
    Gastplätze, Hallenabsage, Ergebniskorrektur und manuelle Generierung stehen in `C8_UMSETZUNG.md`, 12.**

---

## 13. Nachdokumentation und Commit

- `CONTEXT_HANDOFF_CLIENT.md` (Vorfassung ins Archiv): Entscheidungen E1–E12, E19, E20 (bestätigte Fassung), neue Bausteine
  und Hooks, Testzahlen, Stand der Handprüfung; Meilensteintabelle (am 18.10.2026 umgestellt: **C7 27,5 h**, **C8 21,5 h**,
  PWA/Push **C9**, Abnahme/Deployment **C10**) nur im Status fortschreiben; in 6.4 „Namensänderung nicht angebunden“ als erledigt
  streichen („Ergebnis-Korrektur ohne Ansicht“ bleibt bis C8).
- `AGENT_CLIENT.md`: Regeln „Admin-Lesen ohne Polling und ohne `X-FuBo-Kein-Refresh`, `refetchOnWindowFocus: false`“,
  „Voll-Update und Version: nach `DATEN_VERALTET` Formular auf den frischen Stand (`key={version}`), nie mit neuer Version und
alten Eingaben senden“, „Admin-Hooks in `src/hooks/admin/`“, „Pfade nur in `ADMIN_PFADE`“, „Skillwerte nur in
`AdminProfilFormular` (mit C8: `differenzTeamstaerke` nur in `AdminTeams`)“, „`Bestaetigung` für jede nicht umkehrbare Aktion
  (Folgen nennen)“, „`useTermin(id, 0)` pollt nicht“, neue Bausteine unter „Basis-Komponenten“.
- **DESIGN.md** gehört nicht zum Client-Repository: die Abweichungen aus 1.3 dem Entwickler zur Übernahme vorlegen.
- **Server-Track** (Anfragen, nicht Teil von C7): Gültigkeitsdauer der Namens-PIN dokumentieren. Die Anfragen der Stufen 4 und 5
  stehen in `C8_UMSETZUNG.md`, 13.
- `/PRJ_FuBo/harness/CONTEXT_HANDOFF.md`: Client-Stand.
- Commit auf `dev_client`, **je Stufe auf Aufforderung**; nichts nach `main`; Git im verbundenen Ordner nur mit
  `--no-optional-locks`; für den Commit selbst ist die Löschfreigabe nötig (Sperrdateien in `.git`).

---

## 14. Fallen

- **`mutate(…, { onSuccess })` geht verloren, wenn der Aufrufer ausgehängt wird.** Nach Anlegen, Entfernen und Namen
  anfordern: `mutateAsync` mit `try`/`catch`; Hook-eigene `onSuccess` (PIN) laufen weiter.
- **`invalidateQueries` lädt nur beobachtete Abfragen** – Hook-Tests mit der Abfrage daneben.
- **Ein Mock, der unabhängig von der Anfrage antwortet, kann keine Änderung zeigen** (C3): zustandsbehaftet bauen, samt
  `version` und Konflikt.
- **Zwei Hooks mit demselben Schlüssel und verschiedener Abfragefunktion** teilen sich eine davon, ohne es zu sagen.
  Deshalb `useTermin(id, 0)` statt eines zweiten Hooks.
- **`refetchInterval: 0` heisst „aus“**, nicht „dauernd“; der Test hält es fest.
- **`refetchOnWindowFocus` steht im Client auf `true`:** Eine Formularabfrage, die beim Fensterwechsel neu lädt, baut das
  Formular mit `key={version}` neu und verwirft Eingaben. Für Formularabfragen abschalten.
- **`""`, `null` und „fehlt“ bedeuten je Aufruf etwas anderes:** Termin ändern: `""` leert den
  Ort, `null`/fehlt lässt ihn; Termin anlegen: leer ⇒ weglassen (Konfiguration und Gast: C8).
- **Skills:** Anlegen verlangt **alle** aktiven Kategorien, Bearbeiten erlaubt eine Teilmenge; eine leere Karte löscht
  nichts und ein Körper ohne `name` und `skills` ist `400`; die Karte eines Profils kann **Lücken** haben.
- **Das Adminprofil steht in der Profilliste** (`rolle: ADMIN`): keine Aktionen; es wird über den Anmeldenamen umbenannt.
- **Gesperrte Profile sind in der Liste**, aber nicht auswählbar für die manuelle Generierung (`400`).
- **`401 NAME_PIN_FALSCH` ist kein Sitzungsende**; nur `SESSION_UNGUELTIG` beendet sie (der Client verzweigt über `code`).
- **Die PIN-Änderung beendet auch die eigene Sitzung** und alle anderen; der Client räumt auf, der Dialog sagt es vorher.
- **Die Namensänderung beendet nichts:** Die Sitzung bleibt, der Name gilt beim nächsten Login (zeichengenau, Randleerzeichen
  weg).
- **`202` hat keinen Rumpf** (zentral behandelt, `ANTWORT_OHNE_RUMPF`); nichts aus der Antwort lesen.
- **Eine Serie „angelegt“ zu melden, reicht nicht:** Übersprungene Zeitpunkte nennen; eine Serie ist danach nicht änderbar.
- **`ABGESAGT` setzt auch der Server selbst** (Vertrag, 18.10.2026): Hat ein geplanter Termin 30 Minuten nach Beginn weniger Zusagen
  als `minTeilnehmer`, wird er `ABGESAGT` statt `ABGESCHLOSSEN` – ohne Push, ohne dass jemand abgesagt hat. Ein abgesagter Termin
  ist darum nicht immer ein Absagen des Admins: Texte (Statusabschnitt, Dialoge) dürfen das nicht behaupten; Hallenabsage und
  Absagen-Aktion gelten nur für `GEPLANT`. Die Rückmeldungen bleiben stehen, `PROFIL_IN_VERWENDUNG`/`TERMIN_IN_VERWENDUNG` greifen weiter.
- **Die Absage ist endgültig**; Entfernen ist der einzige Weg zurück und scheitert, sobald etwas am Termin hängt.
  `datum`+`uhrzeit` sind global eindeutig, auch bei anderem Ort.
- **`status: 'GEPLANT'` in `aendern` ist `400`**; Absagen läuft über `absagen` (ohne `version`), Abschliessen über `aendern`.
- **Uhr im Render ist verboten** (react-hooks v7): `useState(() => heuteIso(new Date()))` (Fristen in C8 über `useZeitpunktErreicht`).
- **Fokus** nach Dialog, Absage, Abschluss, Entfernen und Weiterleitung gezielt setzen (Fokus landet sonst auf `body`).
- **`profile/neu` vor `profile/:spielerId`:** Router rankt statisch vor dynamisch; Test, damit es so bleibt.
- **Kategorien nicht verdrahten:** Schlüssel, Beschriftung, Grenzen und Reihenfolge kommen vom Server; die Beispielschlüssel
  der Mocks sind Beispiele.
- **Der Prototyp war für diese Anleitung nicht auswertbar:** vor jeder Stufe sichten, Abweichungen vermerken.

---

## 15. Zeitplan (27,5 h in drei Stufen; C8: 21,5 h, siehe `C8_UMSETZUNG.md`)

Jede Stufe endet **grün** (`lint`, `tsc`, `test`, `build`, E2E in drei Chromium-Projekten) und wird einzeln committet (auf
Aufforderung); so bleibt der Stand lieferbar, wenn die Zeit knapp wird.

| Stufe | Schritt | Abschnitt | h |
|---|---|---|---|
| **1 – Rahmen, Dashboard, Zugang** | Datenzugriff und Hooks (PIN, Name) | 3.1, 4.1 | 1,0 |
| | Pfade, Routen, Dashboard, `Bestaetigung`, `Verwaltungsliste`, `TerminAnsicht nurLesen` | 5.1, 5.2, 5.6, 6.1, 6.2 | 2,5 |
| | Zentrale PIN | 6.3 | 1,0 |
| | Anmeldename (zwei Ansichten) | 6.4 | 1,75 |
| | Tests, E2E | 11 | 1,25 |
| | Abnahme und Doku | 12 (Nr. 1 bis 4), 13 | 0,5 |
| | *Zwischensumme* | | *8,0* |
| **2 – Profile** | API, Mock, Schlüssel, Hooks | 3.1, 3.4, 7.1 | 1,25 |
| | `SkillFelder`, `ProfilListe`, Liste | 5.3, 5.4, 7.2 | 2,0 |
| | Formular, Sperren, Entfernen | 7.3, 7.4 | 2,75 |
| | Tests, E2E | 11 | 2,0 |
| | Abnahme | 12 (Nr. 5 bis 7) | 0,5 |
| | *Zwischensumme* | | *8,5* |
| **3 – Termine** | API, Mock, Hooks, `TerminKarte`-Fokusziel | 3.1, 3.4, 8.1 | 1,25 |
| | Terminliste | 8.2 | 1,25 |
| | Anlegen (Einzel, Serie, Ergebnisansicht) | 5.7, 8.3 | 2,75 |
| | Verwaltung: Ändern, Abschliessen, Absagen, Entfernen | 8.4, 8.5 | 2,5 |
| | Tests, E2E | 11 | 2,75 |
| | Abnahme, Gesamtdurchgang (Stand C7) | 12 (Nr. 8 bis 12) | 0,5 |
| | *Zwischensumme* | | *11,0* |
| **Summe C7** | | | **27,5** |

Die Stufen 4 (10,5 h) und 5 (11,0 h) stehen in `C8_UMSETZUNG.md`, 15; zusammen ergeben beide Pakete die ursprünglichen **49,0 h**.

**Reihenfolge:** Stufe 1 liefert `Bestaetigung`, den Rahmen und die Pfade, die alle weiteren brauchen. Stufe 2 liefert die
Profilliste, aus der die manuelle Generierung (C8) auswählt, und `skills.ts`. Stufe 3 liefert die Verwaltungsansicht, in die
C8 seine Abschnitte hängt (8.4). **Die Reihenfolge der drei Stufen ist zwingend; C8 beginnt erst, wenn Stufe 3 grün ist.**

**Warum die Schnittlinie hinter Stufe 3 liegt:** Die Stufen 1 bis 3 sind in sich lieferbar (Dashboard, Zugangsdaten, Profile,
Termine samt Serie und Absage) und lösen bereits die C5-Handprüfung Nr. 6 (Abschliessen). Die Stufen 4 und 5 hängen nur über
drei Punkte an ihnen, und alle drei sind klein: (1) `TerminVerwaltung` nimmt weitere Abschnitte auf (8.4), (2) die manuelle
Generierung liest `useProfile` und `skillsVollstaendig` aus Stufe 2, (3) die Verwaltungsliste verweist auf Routen, die bis C8
`Platzhalter` zeigen. Die Gast-Stufe (8.6) ist bewusst mit den Gastplätzen nach C8 gewandert: Sie braucht `useGastplaetze`
(Stufe 4); in C7 hätte sie dessen Lesehook vorziehen müssen.

**Warum 27,5 + 21,5 statt 20 h:** Der Plan von 20 h entstand aus Dashboard und Profilverwaltung. Danach kamen 22 neue
Operationen, drei Voll-Update-Formulare mit Versionskonflikt, eine Serie mit eigener Ergebnisansicht, die Hallenabsage mit
sieben Zuständen und die manuelle Generierung hinzu; jede Verwaltung braucht Lade-, Leer- und Fehlerzustand, Dialoge mit
Folgen, Mocks mit Zustand und E2E in drei Projekten. Die Bausteinzeiten (Tests rund 40 %) folgen den Erfahrungswerten aus C5,
wo 14 h auf 31,5 h anwuchsen.

**Risiken:** (1) Die **Termin-Verwaltung** trägt die meiste Fachlogik (Versionskonflikt, vier Aktionen) – zuerst mit Mocks und
Unit-Tests fertigstellen, dann die E2E. (2) **Handprüfung braucht einen Mailserver** (Name) und ändert einen gemeinsamen Zustand
(zentrale PIN): Reihenfolge und Rücksetzen in 12 beachten. (3) Der **Prototyp** war nicht auswertbar: Layout-Abweichungen kosten
Umbau; vor jeder Stufe sichten. (4) Das **Fenster der Terminliste** (60 Tage) begrenzt die Ergebniskorrektur in C8; ändert sich
die Anforderung, ist es eine Konstante, aber eine Entscheidung des Betriebs.
