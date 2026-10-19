import type { Ref } from 'react'
import { ORT_MAX, ORT_ZAEHLER_AB, type TerminWerte } from '@/api/admin/terminEingabe'
import Feld from '@/components/Feld/Feld'
import Feldzeile from '@/components/Feldzeile/Feldzeile'
import style from './TerminFormular.module.scss'

/** Fehlertexte je Feld; `null`/fehlend heisst: kein Fehler. */
export type TerminFormularFehler = Partial<Record<keyof TerminWerte, string | null>>

/** Eigenschaften des Termin-Formulars. */
type TerminFormularEigenschaften = {
  /** Die Eingaben, als Text bis zum Senden. */
  werte: TerminWerte
  /** Meldet die Eingabe eines Feldes. */
  beiAenderung: (feld: keyof TerminWerte, wert: string) => void
  /** Frühestes wählbares Datum (heute) als `YYYY-MM-DD`; vom Elternbaustein einmalig gebildet, nie im Render. */
  min: string
  /** Fehlertexte je Feld (Server und Clientprüfung). */
  fehler?: TerminFormularFehler
  /** Während eines Aufrufs gesperrt: `readOnly`, damit der Fokus nicht verloren geht. */
  schreibgeschuetzt?: boolean
  /** Fokusziel für das Uhrzeitfeld (nach `TERMIN_BELEGT`). */
  uhrzeitRef?: Ref<HTMLInputElement>
  /** Fokusziel für das Datumsfeld (nach einem Fehler am Datum). */
  datumRef?: Ref<HTMLInputElement>
  /** Test-ID-Vorsatz; Felder heissen `<vorsatz>-datum`, `-uhrzeit`, `-ort`. */
  vorsatz?: string
}

/**
 * Gemeinsame Felder von „Einzeltermin anlegen“ und „Termin ändern“ (C7, 5.7): Datum, Uhrzeit, Ort.
 *
 * **Datum und Uhrzeit stehen nebeneinander** (Prototyp 10c: das Datum nimmt den Rest, die Uhrzeit ein festes Maß),
 * der Ort darunter über die ganze Breite.
 *
 * **Controlled, ohne Wissen über Senden oder Diff:** Der Elternbaustein hält die Werte und entscheidet, was
 * hinausgeht. Er prüft auch, ob der Zeitpunkt in der Vergangenheit liegt – **im Submit-Handler mit
 * `Date.now()`**; das Formular liest keine Uhr. `min` am Datumsfeld ist nur eine Eingabehilfe (die
 * Server-Prüfung bleibt die Wahrheit).
 *
 * **Ort:** höchstens {@link ORT_MAX} Zeichen, ein Zähler ab {@link ORT_ZAEHLER_AB} Zeichen. Der Zähler steht
 * im Hilfetext des Feldes, damit ihn ein Screenreader mit dem Feld zusammen liest.
 */
export default function TerminFormular({
  werte,
  beiAenderung,
  min,
  fehler = {},
  schreibgeschuetzt = false,
  uhrzeitRef,
  datumRef,
  vorsatz = 'termin',
}: TerminFormularEigenschaften) {
  const ortLaenge = werte.ort.length
  return (
    <div className={style.felder} data-testid={`${vorsatz}-formular`}>
      <Feldzeile spalten="1fr 7.5rem" gestapelt={Boolean(fehler.datum) || Boolean(fehler.uhrzeit)} data-testid={`${vorsatz}-datum-uhrzeit`}>
        <Feld
          ref={datumRef}
          type="date"
          beschriftung="Datum"
          value={werte.datum}
          min={min}
          onChange={(e) => {
            beiAenderung('datum', e.target.value)
          }}
          fehler={fehler.datum}
          readOnly={schreibgeschuetzt}
          data-testid={`${vorsatz}-datum`}
        />
        <Feld
          ref={uhrzeitRef}
          type="time"
          beschriftung="Uhrzeit"
          value={werte.uhrzeit}
          onChange={(e) => {
            beiAenderung('uhrzeit', e.target.value)
          }}
          fehler={fehler.uhrzeit}
          readOnly={schreibgeschuetzt}
          data-testid={`${vorsatz}-uhrzeit`}
        />
      </Feldzeile>
      <Feld
        type="text"
        beschriftung="Ort (optional)"
        value={werte.ort}
        maxLength={ORT_MAX}
        autoComplete="off"
        onChange={(e) => {
          beiAenderung('ort', e.target.value)
        }}
        hinweis={ortLaenge >= ORT_ZAEHLER_AB ? `${String(ortLaenge)} von ${String(ORT_MAX)} Zeichen` : undefined}
        fehler={fehler.ort}
        readOnly={schreibgeschuetzt}
        data-testid={`${vorsatz}-ort`}
      />
    </div>
  )
}
