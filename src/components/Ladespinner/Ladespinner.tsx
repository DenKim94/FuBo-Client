import style from './Ladespinner.module.scss'

/** Eigenschaften des Ladespinners. */
type LadespinnerEigenschaften = {
  /** Kantenlänge: `klein` für Schaltflächen, `mittel` im Fliesstext, `gross` für ganze Ansichten. */
  groesse?: 'klein' | 'mittel' | 'gross'
  /**
   * `primaer` färbt den Kreis in der Primärfarbe; `erben` übernimmt die
   * Textfarbe der Umgebung – nötig auf der grünen Primärschaltfläche, wo der
   * Kreis weiss sein muss.
   */
  farbe?: 'primaer' | 'erben'
  /** Sichtbarer Text unter dem Kreis, z. B. „Teams werden erstellt". */
  text?: string
  /**
   * Rein schmückend: kein `role="status"`, für Screenreader ausgeblendet. Für
   * den Einsatz in einer Schaltfläche, die ihren Zustand bereits über
   * `aria-busy` meldet – sonst ginge „Wird geladen" in ihren Namen ein.
   */
  dekorativ?: boolean
  /**
   * Nimmt die verfügbare Fläche ein und zentriert den Kreis darin (Ladezustand
   * einer Ansicht). Im `AppLayout` ist das die Resthöhe des Fensters, der Kreis
   * liegt also dort, wo auch die Ladeanzeige aus `index.html` steht.
   */
  zentriert?: boolean
  /**
   * Erscheint erst nach 150 ms. Eine Antwort nach 80 ms mit einem aufblitzenden
   * Kreis dazwischen wirkt langsamer als dieselbe Antwort ohne.
   *
   * **Vorgabe:** verzögert für Spinner im Fliesstext und in Teilbereichen;
   * **sofort bei `zentriert`**: Dort steht sonst nach dem Neuladen
   * für 150 ms eine leere Fläche, obwohl die Ladeanzeige aus `index.html` schon
   * zu sehen war.
   */
  verzoegert?: boolean
}

/**
 * Kreisförmige Ladeanzeige für die Wartezeit nach einem API-Aufruf.
 *
 * Reines CSS (ein Rand mit einem farbigen Viertel, der sich dreht) statt eines
 * Bildes: Die Farbe folgt den Tokens, und es entsteht kein zusätzlicher Abruf
 * – ausgerechnet beim Laden.
 *
 * Für Screenreader trägt der Spinner `role="status"` mit einem Text, der den
 * Zustand benennt. Die Drehung allein sagt einem blinden Nutzer nichts.
 * Bei `prefers-reduced-motion` hält die globale Regel aus `_reset.scss` die
 * Drehung an; der Kreis bleibt dann als ruhendes Zeichen stehen.
 */
export default function Ladespinner({
  groesse = 'mittel',
  farbe = 'primaer',
  text,
  dekorativ = false,
  zentriert = false,
  verzoegert,
}: LadespinnerEigenschaften) {
  const mitVerzoegerung = verzoegert ?? !zentriert
  const klassen = [
    style.spinner,
    style[groesse],
    farbe === 'erben' ? style.erben : style.primaer,
    zentriert && style.zentriert,
    mitVerzoegerung && style.verzoegert,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span
      className={klassen}
      role={dekorativ ? undefined : 'status'}
      aria-hidden={dekorativ || undefined}
      data-verzoegert={mitVerzoegerung}
      data-testid="ladespinner"
    >
      <span className={style.kreis} />
      {text ? (
        <span className={style.text}>{text}</span>
      ) : (
        !dekorativ && <span className="nurFuerScreenreader">Wird geladen</span>
      )}
    </span>
  )
}
