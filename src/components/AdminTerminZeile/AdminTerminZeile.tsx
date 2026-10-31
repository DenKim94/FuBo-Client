import { useId } from 'react'
import { useNavigate } from 'react-router'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import { datumLang, datumListe, uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminUebersicht } from '@/api/termine/termine'
import CustomButton from '@/components/CustomButton/CustomButton'
import Icon from '@/components/Icon/Icon'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import { useBegonnen } from '@/hooks/useBegonnen'
import style from './AdminTerminZeile.module.scss'

/** Eigenschaften einer Terminkarte. */
type AdminTerminZeileEigenschaften = {
  termin: TerminUebersicht
  /** Der Admin möchte den Termin entfernen: Die Liste öffnet die Bestätigung. */
  beiEntfernen: (termin: TerminUebersicht) => void
}

/** Symbol und Text je Status; die Aussage steht im Wort, nicht in der Farbe. */
const STATUS = {
  GEPLANT: { symbol: 'info_circle_icon', text: 'Geplant' },
  ABGESAGT: { symbol: 'block_icon_red', text: 'Abgesagt' },
  ABGESCHLOSSEN: { symbol: 'check_circle_icon', text: 'Abgeschlossen' },
} as const

/**
 * Ein geplanter Termin, dessen Beginn erreicht ist (Vorgabe des Entwicklers vom 31.10.2026): Der Server führt ihn noch
 * als `GEPLANT`, bis er ihn nach Spielende abschließt oder mangels Zusagen absagt; „Geplant“ wäre dazwischen irreführend.
 */
const LAUFEND = { symbol: 'football_icon_dark', text: 'Termin läuft' } as const

/**
 * Eine Karte der Terminliste des Admins (C7, 8.2; Prototyp 10): „Di., 20.10. · 20:00 Uhr“ mit der Marke
 * „Serie“ oder „Einzeltermin“, Ort, Status, Zusagen und die Aktionen **in der Karte**.
 *
 * **Aktionen je Termin direkt in der Karte** (Prototyp: „Bearbeiten“ und „Entfernen“ nebeneinander, gleich breit):
 * - „Bearbeiten“ führt zur Verwaltung des Termins (`GEPLANT`). Bei einem abgesagten oder abgeschlossenen Termin
 *   gibt es nichts mehr zu ändern; die Schaltfläche heisst dort „Öffnen“, weil sie nur die Verwaltung öffnet
 *   (dort wird er entfernt bzw. später das Ergebnis korrigiert, C8). Keine Karte führt ins Leere.
 * - „Entfernen“ nur für `GEPLANT` und `ABGESAGT` (die Server-Regel); die Bestätigung mit den Folgen und das
 *   Entfernen selbst gehören der Liste (`beiEntfernen`).
 *
 * **Die Schaltflächen nennen den Termin für Screenreader** („Bearbeiten: Dienstag, 6. Januar, 20:00 Uhr“), sonst
 * hörte man in einer Liste nur „Bearbeiten, Bearbeiten, …“. Der sichtbare Text steht am Anfang des Namens.
 *
 * **„Termin läuft“ statt „Geplant“**, sobald der Beginn erreicht ist (`useBegonnen`: Geräteuhr über einen Timer, nie im
 * Render; springt ohne Neuladen um). Nur Anzeige: Status und Aktionen folgen weiter dem Server-Status `GEPLANT`.
 *
 * **Die Zahl der Zusagen steht nur bei `GEPLANT` und `ABGESCHLOSSEN`:** Eine Absage leert die Liste
 * nicht, aber „0 Zusagen“ wäre bei einem abgesagten Termin eine falsche Auskunft. Der Screenreader hört die
 * ausgeschriebene Form des Datums.
 */
export default function AdminTerminZeile({ termin, beiEntfernen }: AdminTerminZeileEigenschaften) {
  const navigate = useNavigate()
  const titelId = useId()
  const begonnen = useBegonnen(termin)
  const status = termin.status === 'GEPLANT' && begonnen ? LAUFEND : STATUS[termin.status]
  const ort = termin.ort?.trim()
  const uhrzeit = uhrzeitKurz(termin.uhrzeit)
  const mitZusagen = termin.status !== 'ABGESAGT'
  const istSerie = termin.serieId !== null && termin.serieId !== undefined
  const id = String(termin.terminId)
  const geplant = termin.status === 'GEPLANT'
  const entfernbar = geplant || termin.status === 'ABGESAGT'
  const wann = `${datumLang(termin.datum)}, ${uhrzeit} Uhr`
  const oeffnenText = geplant ? 'Bearbeiten' : 'Öffnen'

  return (
    <article className={style.karte} aria-labelledby={titelId} data-testid={`admin-termin-zeile-${id}`}>
      <div className={style.kopf}>
        <span id={titelId} className={style.datum}>
          <span aria-hidden="true">
            {datumListe(termin.datum)} · {uhrzeit} Uhr
          </span>
          <span className="nurFuerScreenreader">{wann}</span>
        </span>
        <span className={style.marke} data-testid={istSerie ? `admin-termin-serie-${id}` : `admin-termin-einzel-${id}`}>
          {istSerie ? 'Serie' : 'Einzeltermin'}
        </span>
      </div>
      {ort && <span className={style.ort}>{ort}</span>}
      <span className={style.stand}>
        <span className={style.status} data-testid={`admin-termin-status-${id}`}>
          <Icon name={status.symbol} />
          <span>{status.text}</span>
        </span>
        {mitZusagen && (
          <span className={style.zusagen} data-testid={`admin-termin-zusagen-${id}`}>
            {termin.zusagen === 1 ? '1 Zusage' : `${String(termin.zusagen)} Zusagen`}
          </span>
        )}
      </span>
      <Knopfgruppe className={style.aktionen}>
        <CustomButton
          art="akzent"
          onClick={() => void navigate(ADMIN_PFADE.terminVerwaltung(termin.terminId))}
          aria-label={`${oeffnenText}: ${wann}`}
          data-testid={`admin-termin-bearbeiten-${id}`}
        >
          {oeffnenText}
        </CustomButton>
        {entfernbar && (
          <CustomButton
            art="gefahr"
            onClick={() => {
              beiEntfernen(termin)
            }}
            aria-label={`Entfernen: ${wann}`}
            data-testid={`admin-termin-entfernen-${id}`}
          >
            Entfernen
          </CustomButton>
        )}
      </Knopfgruppe>
    </article>
  )
}
