import {
  ORT_MAX,
  ORT_ZAEHLER_AB,
  TITEL_MAX,
  WOCHENTAGE,
  type NeuWerte,
  type SerieFehler,
} from '@/api/admin/terminEingabe'
import Auswahlliste from '@/components/Auswahlliste/Auswahlliste'
import Feld from '@/components/Feld/Feld'
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
 * Felder einer Serie (C7, 8.3): Titel, Wochentag, Uhrzeit, Startdatum, Enddatum, Ort.
 *
 * Der Wochentag hat **keine Vorauswahl**: ein vorgewählter „Montag“ ginge ungeprüft in eine Serie mit bis zu
 * 52 Terminen. Der Hinweis am Startdatum nennt die Regel des Servers: fällt es selbst auf den Wochentag, gehört
 * es zur Serie. Das Enddatum muss strikt nach dem Startdatum liegen; die Clientprüfung nennt es, der Server
 * bleibt die Wahrheit.
 */
export default function SerieFelder({ werte, beiAenderung, min, fehler, schreibgeschuetzt }: SerieFelderEigenschaften) {
  const ortLaenge = werte.ort.length
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
      <Auswahlliste
        beschriftung="Wochentag"
        optionen={WOCHENTAGE.map((t) => ({ wert: t.wert, text: t.text }))}
        wert={werte.wochentag}
        beiAenderung={(wert) => {
          beiAenderung('wochentag', wert)
        }}
        deaktiviert={schreibgeschuetzt}
        data-testid="serie-wochentag"
      />
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
        type="date"
        beschriftung="Startdatum"
        hinweis="Fällt es selbst auf den Wochentag, gehört es zur Serie."
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
    </div>
  )
}
