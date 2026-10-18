import type { Ref } from 'react'
import { Link } from 'react-router'
import type { SerieAngelegt } from '@/api/admin/adminTermine'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import { datumKurz, datumLang, uhrzeitKurz } from '@/api/termine/terminZeit'
import Textlink from '@/components/Textlink/Textlink'
import style from './SerieErgebnis.module.scss'

/** Eigenschaften des Serienergebnisses. */
type SerieErgebnisEigenschaften = {
  /** Die Antwort des Servers. */
  ergebnis: SerieAngelegt
  /** Fokusziel: Die Überschrift bekommt den Fokus, wenn das Ergebnis das Formular ersetzt. */
  ueberschriftRef?: Ref<HTMLHeadingElement>
}

/**
 * Ergebnis einer angelegten Serie (C7, 8.3): wie viele Termine entstanden, **welche Zeitpunkte
 * übersprungen wurden** und Links zu den neuen Terminen.
 *
 * **Der Absatz zu den übersprungenen Zeitpunkten ist immer da** (DESIGN.md, Ansicht 11): Liegt an einem
 * Zeitpunkt schon ein Termin, lässt der Server ihn aus, statt die Serie abzulehnen. Ohne diese Auskunft
 * fiele eine unvollständige Serie erst beim Nachzählen auf. Gibt es nichts zu überspringen, steht das
 * ausdrücklich da – die Leere ist eine Aussage, kein fehlender Absatz.
 *
 * Die Überschrift ist ein Fokusziel (`tabIndex={-1}`): Das Ergebnis ersetzt das Formular, und der Fokus
 * läge sonst auf `body`.
 */
export default function SerieErgebnis({ ergebnis, ueberschriftRef }: SerieErgebnisEigenschaften) {
  const anzahl = ergebnis.angelegteTermine.length
  const uebersprungen = ergebnis.uebersprungeneTermine

  return (
    <section className={style.ergebnis} aria-labelledby="serie-ergebnis-titel" data-testid="serie-ergebnis">
      <h2 id="serie-ergebnis-titel" ref={ueberschriftRef} tabIndex={-1} className={style.titel} data-testid="serie-ergebnis-titel">
        Serie angelegt
      </h2>
      <p data-testid="serie-angelegt-anzahl">
        {anzahl === 1 ? '1 Termin angelegt.' : `${String(anzahl)} Termine angelegt.`}
      </p>

      {uebersprungen.length > 0 ? (
        <div data-testid="serie-uebersprungen">
          <p>Übersprungen, weil zu diesem Zeitpunkt bereits ein Termin liegt:</p>
          <ul className={style.uebersprungen}>
            {uebersprungen.map((datum) => (
              <li key={datum} data-testid={`serie-uebersprungen-${datum}`}>
                {datumLang(datum)}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p data-testid="serie-uebersprungen-leer">Es wurde kein Zeitpunkt übersprungen.</p>
      )}

      {anzahl > 0 && (
        <ul className={style.termine} data-testid="serie-termine">
          {ergebnis.angelegteTermine.map((termin) => (
            <li key={termin.terminId}>
              <Link
                to={ADMIN_PFADE.terminVerwaltung(termin.terminId)}
                className={style.zeile}
                data-testid={`serie-termin-${String(termin.terminId)}`}
              >
                {datumKurz(termin.datum)} · {uhrzeitKurz(termin.uhrzeit)} Uhr
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Textlink to={ADMIN_PFADE.termine} data-testid="serie-zu-den-terminen">
        Zu den Terminen
      </Textlink>
    </section>
  )
}
