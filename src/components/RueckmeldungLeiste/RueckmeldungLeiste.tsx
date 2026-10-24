import { useEffect, useRef } from 'react'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import { useRueckmeldung } from '@/hooks/useRueckmeldung'
import style from './RueckmeldungLeiste.module.scss'

/** Eigenschaften der Rückmeldeleiste. */
type RueckmeldungLeisteEigenschaften = {
  /** Die eigene Rückmeldung, dreiwertig (`true`, `false`, `null`). */
  eigeneRueckmeldung: boolean | null
  /** Technischer Schlüssel des Termins. */
  terminId: number
}

/** Rückfalltext für Fehler, die weder vom Server stammen noch Netzfehler sind. */
const FEHLER_ERSATZ = 'Die Rückmeldung konnte nicht gesendet werden. Bitte versuche es erneut.'

/**
 * Die große Aktion zum nächsten Termin: zu- oder absagen (A7, E5).
 *
 * | Rückmeldung | Aktionen |
 * |---|---|
 * | `null` | „Ich kann nicht“ (sekundär) und „Ich bin dabei“ (primär) |
 * | `true` | „Absagen“ (sekundär) |
 * | `false` | „Doch zusagen“ (primär) |
 *
 * Keine Rückfrage vor der Absage: Sie ist umkehrbar, und die Rückfrage kostet
 * mehr, als sie schützt. **Keine optimistische Anzeige** (E4): Die gedrückte
 * Schaltfläche zeigt den Ladezustand, die andere ist gesperrt – per
 * `aria-disabled`, damit der Fokus bleibt.
 *
 * **Fokus nach Erfolg:** Entfällt die gedrückte Schaltfläche, wandert der Fokus
 * auf die verbleibende Aktion. Ohne das landete er auf `body`, und die
 * Tastatur begänne wieder oben in der Ansicht. Die Ansicht rendert die Leiste
 * nicht mehr, sobald der Termin begonnen hat (E8).
 *
 * Ein Fehler steht als `Fehlermeldung` über der Leiste. Bei Netzfehlern und
 * `≥ 500` bleibt der Stand; der zweite Tipp auf dieselbe Schaltfläche wiederholt.
 */
export default function RueckmeldungLeiste({ eigeneRueckmeldung, terminId }: RueckmeldungLeisteEigenschaften) {
  const rueckmeldung = useRueckmeldung(terminId)
  const absagenRef = useRef<HTMLButtonElement>(null)
  const zusagenRef = useRef<HTMLButtonElement>(null)
  // Gesetzt, sobald eine Schaltfläche gedrückt wurde: Nur dann wandert der Fokus.
  // Ein Wechsel durch ein anderes Gerät soll ihn nicht an sich reißen.
  const gedrueckt = useRef(false)

  useEffect(() => {
    if (!gedrueckt.current) return
    gedrueckt.current = false
    // Die gedrückte Schaltfläche ist entfallen und hat den Fokus mitgenommen.
    const verloren = document.activeElement === null || document.activeElement === document.body
    if (verloren) (absagenRef.current ?? zusagenRef.current)?.focus()
  }, [eigeneRueckmeldung])

  const laedt = rueckmeldung.isPending
  const gesendet = rueckmeldung.variables

  /** Sendet die Rückmeldung; während eines Aufrufs tut ein zweiter Tipp nichts. */
  function senden(zusage: boolean) {
    if (laedt) return
    gedrueckt.current = true
    rueckmeldung.mutate(zusage, {
      onError: () => {
        gedrueckt.current = false
      },
    })
  }

  return (
    <>
      {rueckmeldung.isError && (
        <div className={style.fehler}>
          <Fehlermeldung fehler={rueckmeldung.error} ersatz={FEHLER_ERSATZ} data-testid="rueckmeldung-fehler" />
        </div>
      )}
      <Aktionsleiste>
        {eigeneRueckmeldung !== false && (
          <CustomButton
            key="absagen"
            ref={absagenRef}
            art="sekundaer"
            breit
            className={style.aktion}
            laedt={laedt && gesendet === false}
            aria-disabled={laedt && gesendet !== false ? true : undefined}
            onClick={() => senden(false)}
            data-testid="rueckmeldung-absagen"
            style={{ backgroundColor: 'var(--farbe-flaeche)' }}
          >
            {eigeneRueckmeldung === null ? 'Ich kann nicht' : 'Absagen'}
          </CustomButton>
        )}
        {eigeneRueckmeldung !== true && (
          <CustomButton
            key="zusagen"
            ref={zusagenRef}
            art="primaer"
            breit
            className={style.aktion}
            laedt={laedt && gesendet === true}
            aria-disabled={laedt && gesendet !== true ? true : undefined}
            onClick={() => senden(true)}
            data-testid="rueckmeldung-zusagen"
          >
            {eigeneRueckmeldung === false ? 'Doch zusagen' : 'Ich bin dabei'}
          </CustomButton>
        )}
      </Aktionsleiste>
    </>
  )
}
