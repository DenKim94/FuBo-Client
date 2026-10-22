import type { AlgorithmType, AuswechselModus, Konfiguration, KonfigurationAnfrage } from '@/api/admin/adminKonfiguration'

/**
 * Reine Hilfen für das Konfigurationsformular (C8, Stufe 4): Formularzustand, Umwandlung in den Körper des
 * Voll-Updates und die Prüfung der Eingaben. Ohne React und ohne Uhr.
 *
 * **Der Formularzustand besteht aus Text** (außer Auswahl und Haken): Ein leeres Zahlenfeld ist ein Zustand, den
 * eine Zahl nicht ausdrücken kann. Die Umwandlung geschieht in **einer** Funktion ({@link konfigurationAnfrage}).
 */

/** Höchstlänge der Adresse des Hallenbetreibers (Vertrag). */
export const HALLE_EMAIL_MAX = 120

/** Unter dieser Leerlauf-Dauer (Minuten) erscheint der Ablauf-Dialog fast ununterbrochen; die Maske warnt, sperrt aber nicht. */
export const LEERLAUF_WARNUNG_MINUTEN = 5

/** Grenzen der Zahlenfelder (Vertrag, `Konfiguration`). `bis: null` heißt: nach oben offen. */
export const GRENZEN = {
  minTeilnehmer: { von: 1, bis: null },
  maxTeilnehmer: { von: 1, bis: null },
  anzGuests: { von: 0, bis: 22 },
  anzTeamGenerator: { von: 1, bis: null },
  sessionLeerlaufMinuten: { von: 1, bis: 1440 },
  sessionMaximalStunden: { von: 1, bis: 24 },
  halleVorlaufStunden: { von: 0, bis: null },
  pushErinnerungStunden: { von: 1, bis: 168 },
} as const

/** Die Zahlenfelder des Formulars. */
export type ZahlFeld = keyof typeof GRENZEN

/** Die Felder des Formulars, in der Reihenfolge der Gruppen (für „Fokus auf das erste fehlerhafte Feld“). */
export const KONFIGURATION_FELDER = [
  'minTeilnehmer',
  'maxTeilnehmer',
  'anzGuests',
  'algorithmType',
  'anzTeamGenerator',
  'auswechselModus',
  'sessionLeerlaufMinuten',
  'sessionMaximalStunden',
  'hallenModusAktiv',
  'halleEmail',
  'halleVorlaufStunden',
  'halleAbsageVorlage',
  'pushAktiv',
  'pushErinnerungStunden',
] as const

/** Name eines Feldes des Formulars. */
export type KonfigurationFeld = (typeof KONFIGURATION_FELDER)[number]

/** Alle änderbaren Felder als Formularzustand. */
export type KonfigurationForm = {
  minTeilnehmer: string
  maxTeilnehmer: string
  anzGuests: string
  algorithmType: AlgorithmType
  auswechselModus: AuswechselModus
  anzTeamGenerator: string
  sessionLeerlaufMinuten: string
  sessionMaximalStunden: string
  halleEmail: string
  halleAbsageVorlage: string
  halleVorlaufStunden: string
  hallenModusAktiv: boolean
  pushAktiv: boolean
  pushErinnerungStunden: string
}

/** Fehlertexte je Feld; ein fehlender Eintrag heißt „gültig“. */
export type KonfigurationFehler = Partial<Record<KonfigurationFeld, string>>

/**
 * Baut den Formularzustand aus dem gelesenen Stand. `null` bei Adresse und Vorlage wird zum leeren Text.
 *
 * @param konfiguration Der Stand aus `GET /admin/config/lesen`.
 */
export function formAus(konfiguration: Konfiguration): KonfigurationForm {
  return {
    minTeilnehmer: String(konfiguration.minTeilnehmer),
    maxTeilnehmer: String(konfiguration.maxTeilnehmer),
    anzGuests: String(konfiguration.anzGuests),
    algorithmType: konfiguration.algorithmType,
    auswechselModus: konfiguration.auswechselModus,
    anzTeamGenerator: String(konfiguration.anzTeamGenerator),
    sessionLeerlaufMinuten: String(konfiguration.sessionLeerlaufMinuten),
    sessionMaximalStunden: String(konfiguration.sessionMaximalStunden),
    halleEmail: konfiguration.halleEmail ?? '',
    halleAbsageVorlage: konfiguration.halleAbsageVorlage ?? '',
    halleVorlaufStunden: String(konfiguration.halleVorlaufStunden),
    hallenModusAktiv: konfiguration.hallenModusAktiv,
    pushAktiv: konfiguration.pushAktiv,
    pushErinnerungStunden: String(konfiguration.pushErinnerungStunden),
  }
}

/**
 * Liest einen Text als ganze Zahl; alles andere (leer, Dezimalstellen, Buchstaben, Exponent) ist `null`.
 *
 * @param text Der Inhalt des Feldes.
 */
export function ganzeZahl(text: string): number | null {
  const bereinigt = text.trim()
  return /^-?\d+$/.test(bereinigt) ? Number(bereinigt) : null
}

/** Eine Adresse sieht gültig aus: etwas, ein `@`, etwas, ein Punkt, etwas – ohne Leerraum. Der Server bleibt die Wahrheit. */
function siehtAusWieAdresse(text: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
}

/** Fehlertext einer Zahl außerhalb ihrer Grenzen. */
function zahlText(feld: ZahlFeld): string {
  const { von, bis } = GRENZEN[feld]
  return bis === null
    ? `Bitte gib eine ganze Zahl ab ${String(von)} ein.`
    : `Bitte gib eine ganze Zahl von ${String(von)} bis ${String(bis)} ein.`
}

/**
 * Prüft die Eingaben wie der Server (der bleibt die Wahrheit) und nennt je Feld den Grund.
 *
 * **Die Warnung unter fünf Minuten Leerlauf gehört nicht hierher:** Sie sperrt nicht (siehe {@link leerlaufWarnung}).
 *
 * @param form Der Formularzustand.
 */
export function konfigurationFehler(form: KonfigurationForm): KonfigurationFehler {
  const fehler: KonfigurationFehler = {}
  for (const feld of Object.keys(GRENZEN) as ZahlFeld[]) {
    const zahl = ganzeZahl(form[feld])
    const { von, bis } = GRENZEN[feld]
    if (zahl === null || zahl < von || (bis !== null && zahl > bis)) fehler[feld] = zahlText(feld)
  }

  const min = ganzeZahl(form.minTeilnehmer)
  const max = ganzeZahl(form.maxTeilnehmer)
  if (fehler.maxTeilnehmer === undefined && fehler.minTeilnehmer === undefined && min !== null && max !== null && max < min) {
    fehler.maxTeilnehmer = 'Die Höchstzahl darf nicht unter der Mindestzahl liegen.'
  }

  const adresse = form.halleEmail.trim()
  if (adresse !== '' && (adresse.length > HALLE_EMAIL_MAX || !siehtAusWieAdresse(adresse))) {
    fehler.halleEmail =
      adresse.length > HALLE_EMAIL_MAX
        ? `Die Adresse darf höchstens ${String(HALLE_EMAIL_MAX)} Zeichen lang sein.`
        : 'Bitte gib eine gültige E-Mail-Adresse ein oder lass das Feld leer.'
  }
  return fehler
}

/**
 * Das erste fehlerhafte Feld in der Reihenfolge der Gruppen, oder `null`: Dorthin gehört der Fokus nach dem Absenden.
 *
 * @param fehler Das Ergebnis von {@link konfigurationFehler}.
 */
export function ersterFehler(fehler: KonfigurationFehler): KonfigurationFeld | null {
  return KONFIGURATION_FELDER.find((feld) => fehler[feld] !== undefined) ?? null
}

/**
 * Warnt, wenn das Leerlauf-Fenster so kurz ist, dass der Ablauf-Dialog nach jedem Verlängern sofort wiederkäme
 * (die Warnzeit beträgt zwei Minuten). Nur bei gültiger Zahl; die Warnung sperrt nichts.
 *
 * @param text Inhalt des Feldes `sessionLeerlaufMinuten`.
 */
export function leerlaufWarnung(text: string): boolean {
  const minuten = ganzeZahl(text)
  return minuten !== null && minuten >= GRENZEN.sessionLeerlaufMinuten.von && minuten < LEERLAUF_WARNUNG_MINUTEN
}

/**
 * Unterscheidet sich der Formularzustand vom gelesenen Stand? Gespeichert wird erst nach einer Änderung.
 *
 * @param form Der Formularzustand.
 * @param konfiguration Der Stand, mit dem das Formular aufgebaut wurde.
 */
export function konfigurationGeaendert(form: KonfigurationForm, konfiguration: Konfiguration): boolean {
  const ursprung = formAus(konfiguration)
  return KONFIGURATION_FELDER.some((feld) => form[feld] !== ursprung[feld])
}

/**
 * Baut den Körper des Voll-Updates. **Die einzige Stelle**, die ihn baut.
 *
 * - Alle **vierzehn** änderbaren Felder und die `version` – der Rückgabetyp verhindert ein fehlendes Pflichtfeld.
 * - `halleAbsageVorlageEffektiv` und `geaendertAm` sind nur lesbar und gehören **nie** hinein.
 * - Eine leere Adresse oder Vorlage (auch nur Leerraum) wird `null`; die Vorlage geht sonst **unverändert** hinaus
 *   (Absätze zählen), die Adresse getrimmt.
 * - Zahlen gehen als Zahlen hinaus; die Prüfung vorher ({@link konfigurationFehler}) stellt sicher, dass kein Feld
 *   `NaN` wird.
 *
 * @param form Der geprüfte Formularzustand.
 * @param version Die `version` des Standes, mit dem das Formular aufgebaut wurde.
 */
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
