import { useEffect, useId, useRef, type ReactNode } from 'react'
import CustomButton from '@/components/CustomButton/CustomButton'
import Dialog from '@/components/Dialog/Dialog'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import style from './Bestaetigung.module.scss'

/** Eigenschaften der Bestätigung. */
type BestaetigungEigenschaften = {
  /** Gesteuert von außen, wie bei {@link Dialog}. */
  offen: boolean
  /** Überschrift als Frage, die die Aktion nennt: „Termin absagen?“. */
  titel: string
  /** Beschriftung der Bestätigung: das **Verb** der Aktion („Termin absagen“), nicht „OK“. */
  bestaetigenText: string
  /**
   * Farbe der Bestätigung. `gefahr` für nicht umkehrbare Schritte: rote Bestätigung, **„Abbrechen“ hat den
   * Fokus**. `primaer` für Schritte mit Folgen, die sich aber erklären lassen. `akzent` (blau) für einen
   * Verwaltungsschritt, der nicht als Gefahr wirken soll („Termin abschließen“).
   */
  art?: 'gefahr' | 'primaer' | 'akzent'
  /**
   * Der Fokus beginnt auf „Abbrechen“. Vorgabe: nur bei `gefahr`. Ein endgültiger Schritt in anderer Farbe
   * („Termin abschließen“ in `akzent`) setzt es ausdrücklich: Die Farbe ändert nichts daran, dass ein
   * versehentliches Enter ihn nicht auslösen darf.
   */
  fokusAufAbbrechen?: boolean
  /** Ein Aufruf läuft: Bestätigung zeigt den Spinner, „Abbrechen“, Escape und Zurück-Geste sind gesperrt. */
  laedt?: boolean
  /** Fehler des Aufrufs: erscheint **im** Dialog, der Dialog bleibt offen. */
  fehler?: Error | null
  /** Rückfalltext für Fehler, die weder vom Server stammen noch Netzfehler sind. */
  fehlerErsatz?: string
  /** Löst die Aktion aus; schließt den Dialog nicht (das tut der Aufrufer nach dem Erfolg). */
  beiBestaetigen: () => void
  /** Bricht ab; der Aufrufer setzt seinen Zustand auf „geschlossen“. */
  beiAbbruch: () => void
  /** Beschriftung des Abbruchs; Vorgabe „Abbrechen“. */
  abbrechenText?: string
  /** Die Folgen in ganzen Sätzen. */
  children: ReactNode
  /** Präfix der Test-IDs: `<präfix>` am Dialog, `-bestaetigen`, `-abbrechen`, `-fehler`. */
  'data-testid'?: string
}

/**
 * Bestätigung vor einer Aktion mit Folgen (C7, 5.1, E8/E11/E12/E19).
 *
 * Dünner Baustein um {@link Dialog}: Acht Stellen der Verwaltung brauchen
 * denselben Aufbau (PIN, Profil entfernen oder sperren, Termin absagen, entfernen
 * oder abschließen, Serie anlegen, Gäste freigeben, Halle, Ergebnis). Ohne den
 * Baustein sähe jeder Dialog etwas anders aus und vergäße etwas anderes.
 *
 * **Der Dialog nennt die Folgen, nicht die Frage:** Die Kinder sind ganze Sätze
 * („Die Absage ist endgültig. …“), die Überschrift nennt die Aktion, die
 * Bestätigung trägt das Verb. „Sind Sie sicher?“ sagt nichts.
 *
 * **Bei Gefahr beginnt der Fokus auf „Abbrechen“:** Ein versehentliches Enter
 * oder Leerzeichen löst die unumkehrbare Aktion nicht aus. Bei `primaer` beginnt
 * er auf der Bestätigung.
 *
 * **Der Dialog bleibt bei einem Fehler offen** und zeigt ihn im Dialog – ein
 * Fehler hinter einem geschlossenen Dialog verlöre den Zusammenhang. Während des
 * Aufrufs (`laedt`) hält `festhalten` ihn fest; „Abbrechen“ ist dann `aria-disabled`
 * (der Fokus bleibt), wie im Ergebnisformular.
 *
 * Der Dialog gehört in den Behälter der `Aktionsleiste`, wo eine solche steht, damit
 * die haftende Leiste das letzte Element der Seite bleibt (C5).
 */
export default function Bestaetigung({
  offen,
  titel,
  bestaetigenText,
  art = 'primaer',
  fokusAufAbbrechen = art === 'gefahr',
  laedt = false,
  fehler = null,
  fehlerErsatz,
  beiBestaetigen,
  beiAbbruch,
  abbrechenText = 'Abbrechen',
  children,
  'data-testid': testId = 'bestaetigung',
}: BestaetigungEigenschaften) {
  const beschreibungId = useId()
  const abbrechenRef = useRef<HTMLButtonElement>(null)
  const bestaetigenRef = useRef<HTMLButtonElement>(null)

  // Nach dem Öffnen (`showModal` läuft im Effekt des Dialogs, der vor diesem läuft)
  // setzt der Effekt den Anfangsfokus. Ohne ihn nähme der Browser das erste
  // bedienbare Element – bei Gefahr wäre das die Bestätigung.
  useEffect(() => {
    if (!offen) return
    const ziel = fokusAufAbbrechen ? abbrechenRef.current : bestaetigenRef.current
    ziel?.focus()
  }, [offen, fokusAufAbbrechen])

  return (
    <Dialog
      offen={offen}
      titel={titel}
      festhalten={laedt}
      aufSchliessen={beiAbbruch}
      beschreibungId={beschreibungId}
      data-testid={testId}
    >
      <div id={beschreibungId} className={style.folgen}>
        {children}
      </div>

      {fehler && <Fehlermeldung fehler={fehler} ersatz={fehlerErsatz} data-testid={`${testId}-fehler`} />}

      <Knopfgruppe untereinander className={style.aktionen}>
        <CustomButton
          ref={bestaetigenRef}
          art={art}
          breit
          laedt={laedt}
          onClick={beiBestaetigen}
          data-testid={`${testId}-bestaetigen`}
        >
          {bestaetigenText}
        </CustomButton>
        <CustomButton
          ref={abbrechenRef}
          art="sekundaer"
          breit
          aria-disabled={laedt ? true : undefined}
          onClick={() => {
            if (!laedt) beiAbbruch()
          }}
          data-testid={`${testId}-abbrechen`}
        >
          {abbrechenText}
        </CustomButton>
      </Knopfgruppe>
    </Dialog>
  )
}
