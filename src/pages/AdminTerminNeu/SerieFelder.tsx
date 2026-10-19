import { useId } from 'react'
import {
  ORT_MAX,
  ORT_ZAEHLER_AB,
  TITEL_MAX,
  WOCHENTAGE,
  type NeuWerte,
  type SerieFehler,
} from '@/api/admin/terminEingabe'
import Feld from '@/components/Feld/Feld'
import Feldzeile from '@/components/Feldzeile/Feldzeile'
import Segmente from '@/components/Segmente/Segmente'
import style from './AdminTerminNeu.module.scss'

/** Eigenschaften der Serienfelder. */
type SerieFelderEigenschaften = {
  werte: NeuWerte
  beiAenderung: (feld: keyof NeuWerte, wert: string) => void
  /** Frühestes wählbares Datum (heute). */
  min: string
  /** Fehlertexte der Clientprüfung; erst nach dem ersten Versuch, abzusenden, gezeigt. */
  fehler: SerieFehler
  schreibgeschuetzt: boolean
}

/**
 * Felder einer Serie (C7, 8.3; Prototyp 10b): Titel, Wochentag, Startdatum und Enddatum nebeneinander, Uhrzeit und
 * Ort nebeneinander.
 *
 * Der Wochentag ist eine Reihe von sieben Segmenten („Mo“ bis „So“) und hat **keine Vorauswahl**: ein vorgewählter
 * „Montag“ ginge ungeprüft in eine Serie mit bis zu 52 Terminen. Der Titel steht zusätzlich zum Prototyp da: Der
 * Server verlangt ihn (Pflichtfeld). Der Hinweis zum Startdatum nennt die Regel des Servers: fällt es selbst auf
 * den Wochentag, gehört es zur Serie; er steht unter der Zeile und beschreibt das Startdatum für Screenreader. Das
 * Enddatum muss strikt nach dem Startdatum liegen; die Clientprüfung nennt es, der Server bleibt die Wahrheit.
 * Trägt ein Feld einer Zeile einen Fehlertext, stehen ihre Felder untereinander.
 */
export default function SerieFelder({ werte, beiAenderung, min, fehler, schreibgeschuetzt }: SerieFelderEigenschaften) {
  const ortLaenge = werte.ort.length
  const startHinweisId = useId()
  return (
    <div className={style.felder} data-testid="serie-formular">
      <Feld
        type="text"
        beschriftung="Titel"
        hinweis="Zum Beispiel „Training Dienstag“."
        value={werte.titel}
        maxLength={TITEL_MAX}
        autoComplete="off"
        onChange={(e) => {
          beiAenderung('titel', e.target.value)
        }}
        fehler={fehler.titel}
        readOnly={schreibgeschuetzt}
        data-testid="serie-titel"
      />
      <Segmente
        legende="Wochentag"
        optionen={WOCHENTAGE.map((t) => ({ wert: t.wert, text: t.kurz, lesetext: t.text }))}
        wert={werte.wochentag}
        beiAenderung={(wert) => {
          beiAenderung('wochentag', wert)
        }}
        schreibgeschuetzt={schreibgeschuetzt}
        data-testid="serie-wochentag"
      />
      <Feldzeile gestapelt={Boolean(fehler.startdatum) || Boolean(fehler.enddatum)}>
        <Feld
          type="date"
          beschriftung="Startdatum"
          beschriebenDurch={startHinweisId}
          value={werte.datum}
          min={min}
          onChange={(e) => {
            beiAenderung('datum', e.target.value)
          }}
          fehler={fehler.startdatum}
          readOnly={schreibgeschuetzt}
          data-testid="serie-startdatum"
        />
        <Feld
          type="date"
          beschriftung="Enddatum"
          value={werte.enddatum}
          min={werte.datum || min}
          onChange={(e) => {
            beiAenderung('enddatum', e.target.value)
          }}
          fehler={fehler.enddatum}
          readOnly={schreibgeschuetzt}
          data-testid="serie-enddatum"
        />
      </Feldzeile>
      <p id={startHinweisId} className={style.nebentext}>
        Fällt das Startdatum selbst auf den Wochentag, gehört es zur Serie.
      </p>
      <Feldzeile spalten="1fr 1.4fr" gestapelt={Boolean(fehler.uhrzeit)}>
        <Feld
          type="time"
          beschriftung="Uhrzeit"
          value={werte.uhrzeit}
          onChange={(e) => {
            beiAenderung('uhrzeit', e.target.value)
          }}
          fehler={fehler.uhrzeit}
          readOnly={schreibgeschuetzt}
          data-testid="serie-uhrzeit"
        />
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
          readOnly={schreibgeschuetzt}
          data-testid="serie-ort"
        />
      </Feldzeile>
    </div>
  )
}
