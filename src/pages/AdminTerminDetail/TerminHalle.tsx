import { useId, useState, type ReactNode } from 'react'
import { ApiFehler } from '@/api/common/fehler'
import { zeitpunktKurz } from '@/api/termine/terminZeit'
import type { TerminDetails } from '@/api/termine/termine'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Textlink from '@/components/Textlink/Textlink'
import { useHalleAbsagen } from '@/hooks/admin/useHalleAbsagen'
import { useKonfiguration } from '@/hooks/admin/useKonfiguration'
import { useZeitpunktErreicht } from '@/hooks/useZeitpunktErreicht'
import style from './AdminTerminDetail.module.scss'

const FEHLER_ERSATZ = 'Die Absage konnte nicht gesendet werden. Bitte versuche es erneut.'
const TEXT_VERSAND = 'Es wurde nichts verändert; du kannst es erneut versuchen.'

/** Eigenschaften des Abschnitts. */
type TerminHalleEigenschaften = {
  termin: TerminDetails
  /** Der Termin hat den Status gewechselt: Die Aktion verschwindet, der Fokus gehört auf die Überschrift der Karte. */
  fokusAufUeberschrift: () => void
}

/**
 * Abschnitt „Hallenabsage“ der Terminverwaltung (C8 10.1, A23).
 *
 * Eine **echte E-Mail an den Hallenbetreiber**, die sich nicht zurücknehmen lässt; der Termin wird dabei ebenfalls
 * abgesagt. Quellen: der Termin (`halleAbsageMoeglichBis`, `halleAbgesagtAm`, `status`) und die Konfiguration
 * (`hallenModusAktiv`, `halleEmail`). Die Zustände, in der Reihenfolge der Prüfung:
 *
 * 1. `halleAbgesagtAm` gesetzt (jeder Status): „… wurde am … versandt.“, keine Aktion.
 * 2. Nicht `GEPLANT`: kein Abschnitt (abgeschlossen **und** abgesagt – `ABGESAGT` setzt auch der Server selbst, ohne dass
 *    jemand die Halle informiert hätte; die Absage gilt nur für einen geplanten Termin).
 * 3. Hallenmodus aus: kein Abschnitt („der Knopf gehört dann ausgeblendet“).
 * 4. Frist erreicht: Text, Aktion `aria-disabled`; der Rest des Terminverwaltung bleibt nutzbar.
 * 5. Keine Adresse: Text mit Link zur Konfiguration, Aktion `aria-disabled`.
 * 6. Sonst: „Absage möglich bis …“ und die Aktion.
 *
 * **`aria-disabled` statt `disabled`, mit dem Grund als Text** (C5-Muster): Der Fokus bleibt, der Grund wird vorgelesen.
 * **Die Frist kommt aus der Geräteuhr und ist nur Darstellung** (`useZeitpunktErreicht`): Sie schaltet von selbst um; der
 * Server entscheidet (`HALLE_FRIST_ABGELAUFEN`), und seine Antwort sperrt die Aktion ebenfalls.
 *
 * **`HALLE_BEREITS_ABGESAGT` ist kein Fehler**, sondern ein Doppelklick: Der Dialog schließt, der Abschnitt sagt „Die
 * Absage ist schon raus.“ und nennt den Zeitpunkt. Bei `503` bleibt der Dialog offen und nichts ist passiert.
 */
export default function TerminHalle({ termin, fokusAufUeberschrift }: TerminHalleEigenschaften) {
  const konfiguration = useKonfiguration()
  const absagen = useHalleAbsagen()
  const [dialogOffen, setDialogOffen] = useState(false)
  // Was der Server zuletzt entschieden hat und die Daten allein nicht zeigen.
  const [nachricht, setNachricht] = useState<string | null>(null)
  const [fristServer, setFristServer] = useState<string | null>(null)
  const grundId = useId()
  const fristErreicht = useZeitpunktErreicht(Date.parse(termin.halleAbsageMoeglichBis))

  if (termin.halleAbgesagtAm) {
    return (
      <Abschnitt>
        {nachricht && <Hinweis data-testid="admin-halle-nachricht">{nachricht}</Hinweis>}
        <p data-testid="admin-halle-versandt">Die Absage an die Halle wurde am {zeitpunktKurz(termin.halleAbgesagtAm)} versandt.</p>
      </Abschnitt>
    )
  }
  if (termin.status !== 'GEPLANT' && nachricht === null) return null

  const einstellungen = konfiguration.data
  if (!einstellungen) {
    return konfiguration.isPending ? null : (
      <Abschnitt>
        <Fehlerzustand fehler={konfiguration.error} erneut={() => void konfiguration.refetch()} data-testid="admin-halle-laden-fehler" />
      </Abschnitt>
    )
  }
  if (!einstellungen.hallenModusAktiv && nachricht === null) return null

  const frist = fristErreicht || fristServer !== null
  const adresseFehlt = !einstellungen.halleEmail
  // Die Aktion steht nur bei aktivem Hallenmodus und geplantem Termin da; dann sperren Frist und fehlende Adresse sie.
  const gesperrt = frist || adresseFehlt
  const bis = zeitpunktKurz(termin.halleAbsageMoeglichBis)

  /** Sendet die Absage; ein zweiter Tipp während des Aufrufs tut nichts. */
  async function senden() {
    if (absagen.isPending) return
    try {
      await absagen.mutateAsync(termin.terminId)
      setDialogOffen(false)
      fokusAufUeberschrift()
    } catch (fehler) {
      if (!(fehler instanceof ApiFehler)) return
      switch (fehler.code) {
        case 'HALLE_BEREITS_ABGESAGT':
          // Kein Fehler: Jemand war schneller. Die Daten sind neu gelesen und tragen den Zeitpunkt.
          setNachricht('Die Absage ist schon raus.')
          setDialogOffen(false)
          fokusAufUeberschrift()
          break
        case 'HALLE_MODUS_INAKTIV':
          setNachricht('Der Hallenmodus ist abgeschaltet.')
          setDialogOffen(false)
          break
        case 'TERMIN_GESCHLOSSEN':
          setNachricht('Der Termin ist abgeschlossen.')
          setDialogOffen(false)
          break
        case 'HALLE_FRIST_ABGELAUFEN':
          setFristServer(fehler.message)
          setDialogOffen(false)
          break
        case 'HALLE_NICHT_KONFIGURIERT':
          setDialogOffen(false)
          break
        default:
        // Der Fehler steht im Dialog (etwa `503`): kein automatischer Wiederholungsversuch.
      }
    }
  }

  return (
    <Abschnitt>
      {nachricht && <Hinweis data-testid="admin-halle-nachricht">{nachricht}</Hinweis>}

      {einstellungen.hallenModusAktiv && termin.status === 'GEPLANT' && (
        <>
          {frist ? (
            <div className={style.halleText} id={grundId} data-testid="admin-halle-frist">
              <p>Die Frist für die Hallenabsage ist abgelaufen (sie lief bis {bis}).</p>
              {fristServer && <p className={style.nebentext}>{fristServer}</p>}
              <p className={style.nebentext}>Den Termin kannst du weiterhin absagen; die Halle informierst du dann selbst.</p>
            </div>
          ) : adresseFehlt ? (
            <div className={style.halleText} id={grundId} data-testid="admin-halle-adresse-fehlt">
              <p>Es ist keine E-Mail-Adresse des Hallenbetreibers hinterlegt.</p>
              <Textlink to={ADMIN_PFADE.konfiguration} data-testid="admin-halle-zur-konfiguration">
                Zur Konfiguration
              </Textlink>
            </div>
          ) : (
            <p id={grundId} data-testid="admin-halle-moeglich">
              Absage möglich bis {bis}.
            </p>
          )}

          <CustomButton
            art="gefahr"
            aria-disabled={gesperrt ? true : undefined}
            aria-describedby={gesperrt ? grundId : undefined}
            onClick={() => {
              if (gesperrt) return
              absagen.reset()
              setNachricht(null)
              setDialogOffen(true)
            }}
            data-testid="admin-halle-absagen"
          >
            Halle per E-Mail absagen
          </CustomButton>
        </>
      )}

      <Bestaetigung
        offen={dialogOffen}
        titel="Absage an die Halle senden?"
        bestaetigenText="Absage senden"
        art="gefahr"
        laedt={absagen.isPending}
        fehler={dialogOffen ? absagen.error : null}
        fehlerErsatz={FEHLER_ERSATZ}
        beiBestaetigen={() => void senden()}
        beiAbbruch={() => {
          absagen.reset()
          setDialogOffen(false)
        }}
        data-testid="admin-halle-dialog"
      >
        <p>
          Die Absage geht <strong>sofort</strong> per E-Mail an den Hallenbetreiber und lässt sich nicht zurücknehmen. Der Termin
          wird dabei ebenfalls abgesagt.
        </p>
        {absagen.error instanceof ApiFehler && absagen.error.code === 'VERSAND_FEHLGESCHLAGEN' && (
          <p data-testid="admin-halle-dialog-versand">{TEXT_VERSAND}</p>
        )}
      </Bestaetigung>
    </Abschnitt>
  )
}

/** Rahmen des Abschnitts mit Überschrift. */
function Abschnitt({ children }: { children: ReactNode }) {
  return (
    <section className={style.abschnitt} aria-labelledby="admin-halle-titel" data-testid="admin-halle-abschnitt">
      <h2 id="admin-halle-titel" className={style.abschnittTitel}>
        Hallenabsage
      </h2>
      {children}
    </section>
  )
}
