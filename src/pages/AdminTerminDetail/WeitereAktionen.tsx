import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiFehler } from '@/api/common/fehler'
import type { TerminDetails } from '@/api/termine/termine'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Hinweis from '@/components/Hinweis/Hinweis'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import { useTerminAbsagen } from '@/hooks/admin/useTerminAbsagen'
import { useTerminEntfernen } from '@/hooks/admin/useTerminEntfernen'
import style from './AdminTerminDetail.module.scss'

const FEHLER_ERSATZ_ABSAGEN = 'Der Termin konnte nicht abgesagt werden. Bitte versuche es erneut.'
const FEHLER_ERSATZ_ENTFERNEN = 'Der Termin konnte nicht entfernt werden. Bitte versuche es erneut.'

type Dialog = 'absagen' | 'entfernen' | null

/** Eigenschaften der weiteren Aktionen. */
type WeitereAktionenEigenschaften = {
  termin: TerminDetails
  /** Der Termin hat den Status gewechselt: Die Aktionen verschwinden, der Fokus gehört auf die Überschrift der Karte. */
  fokusAufUeberschrift: () => void
}

/**
 * Abschnitt „Weitere Aktionen“ (C7 8.5): Termin absagen, entfernen. Jede Aktion fragt mit einer `Bestaetigung`, die
 * die **Folgen** nennt; der Dialog bleibt bei einem Fehler offen und zeigt ihn.
 *
 * **Kein „Termin abschließen“ mehr (seit 24.10.2026, Entscheidung des Entwicklers):** Der Server schließt jeden Termin
 * 25 Minuten nach Beginn selbst ab (`TerminService.abgelaufeneAbschliessen`, alle 5 Minuten; unter der Mindestzahl wird
 * er stattdessen abgesagt). Ein Knopf dafür wirkte irreführend, als sei der Abschluss Aufgabe des Admins.
 * `terminAendern` kann `status` weiter senden; die Oberfläche nutzt es nicht.
 *
 * - **Absagen** (`GEPLANT`): endgültig; der Zeitpunkt bleibt belegt, bis der Termin entfernt wird.
 * - **Entfernen** (`GEPLANT`, `ABGESAGT`): nur, solange nichts darauf verweist. `409 TERMIN_IN_VERWENDUNG` schliesst den
 *   Dialog und nennt den Grund; bei `GEPLANT` führt „Stattdessen absagen“ zum richtigen Weg. Erfolg: `mutateAsync`, dann
 *   zur Liste (die Seite wird ausgehängt).
 *
 * **Farben (seit 24.10.2026):** „Absagen“ und „Entfernen“ sind rot **umrandet** (beide endgültig); gefüllt rot ist erst
 * die Bestätigung im Dialog, der Moment der Entscheidung. Vorher standen drei gefüllte Flächen untereinander, zwei davon
 * rot.
 *
 * **Fokus:** Mit dem Statuswechsel verschwinden die Aktionen samt der gedrückten Schaltfläche; der Fokus wandert auf die
 * Überschrift der Karte (C5-Falle: sonst liegt er auf `body`).
 */
export default function WeitereAktionen({ termin, fokusAufUeberschrift }: WeitereAktionenEigenschaften) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const absagen = useTerminAbsagen()
  const entfernen = useTerminEntfernen()
  const navigate = useNavigate()

  const geplant = termin.status === 'GEPLANT'
  const entfernbar = geplant || termin.status === 'ABGESAGT'
  const inVerwendung = entfernen.error instanceof ApiFehler && entfernen.error.code === 'TERMIN_IN_VERWENDUNG'

  function oeffnen(art: Exclude<Dialog, null>) {
    absagen.reset()
    entfernen.reset()
    setDialog(art)
  }

  async function absagenAusfuehren() {
    if (absagen.isPending) return
    try {
      await absagen.mutateAsync(termin.terminId)
      setDialog(null)
      fokusAufUeberschrift()
    } catch {
      // Der Fehler steht im Dialog.
    }
  }

  async function entfernenAusfuehren() {
    if (entfernen.isPending) return
    try {
      await entfernen.mutateAsync(termin.terminId)
      void navigate(ADMIN_PFADE.termine, { replace: true, state: { hinweis: 'Termin entfernt.' } })
    } catch (fehler) {
      if (!(fehler instanceof ApiFehler)) return
      if (fehler.code === 'TERMIN_IN_VERWENDUNG') setDialog(null)
      if (fehler.status === 404) {
        void navigate(ADMIN_PFADE.termine, { replace: true, state: { hinweis: 'Der Termin existiert nicht mehr.' } })
      }
    }
  }

  if (!geplant && !entfernbar) return null

  return (
    <section className={style.abschnitt} aria-labelledby="admin-termin-aktionen-titel" data-testid="admin-termin-aktionen">
      <h2 id="admin-termin-aktionen-titel" className={style.abschnittTitel}>
        Weitere Aktionen
      </h2>

      {inVerwendung && (
        <Hinweis data-testid="admin-termin-in-verwendung">
          Am Termin hängen Rückmeldungen oder Teams; er lässt sich nicht entfernen.
        </Hinweis>
      )}

      <Knopfgruppe untereinander>
        {geplant && (
          <CustomButton
            art="gefahrUmriss"
            symbol="cancel_circle_icon_dark"
            onClick={() => {
              oeffnen('absagen')
            }}
            data-testid="admin-termin-absagen"
          >
            Termin absagen
          </CustomButton>
        )}
        {inVerwendung && geplant && (
          <CustomButton
            art="sekundaer"
            onClick={() => {
              oeffnen('absagen')
            }}
            data-testid="admin-termin-stattdessen-absagen"
          >
            Stattdessen absagen
          </CustomButton>
        )}
        {entfernbar && (
          <CustomButton
            art="gefahrUmriss"
            symbol="delete_icon_dark"
            onClick={() => {
              oeffnen('entfernen')
            }}
            data-testid="admin-termin-entfernen"
          >
            Termin entfernen
          </CustomButton>
        )}
      </Knopfgruppe>

      <Bestaetigung
        offen={dialog === 'absagen'}
        titel="Termin absagen?"
        bestaetigenText="Termin absagen"
        art="gefahr"
        laedt={absagen.isPending}
        fehler={dialog === 'absagen' ? absagen.error : null}
        fehlerErsatz={FEHLER_ERSATZ_ABSAGEN}
        beiBestaetigen={() => void absagenAusfuehren()}
        beiAbbruch={() => {
          setDialog(null)
        }}
        data-testid="admin-absagen-dialog"
      >
        <p>
          Die Absage ist endgültig. Der Zeitpunkt bleibt belegt; einen neuen Termin zu diesem Zeitpunkt gibt es erst,
          wenn du diesen entfernst – und das geht nur, solange niemand geantwortet hat.
        </p>
      </Bestaetigung>

      <Bestaetigung
        offen={dialog === 'entfernen'}
        titel="Termin entfernen?"
        bestaetigenText="Termin entfernen"
        art="gefahr"
        laedt={entfernen.isPending}
        fehler={dialog === 'entfernen' && !inVerwendung ? entfernen.error : null}
        fehlerErsatz={FEHLER_ERSATZ_ENTFERNEN}
        beiBestaetigen={() => void entfernenAusfuehren()}
        beiAbbruch={() => {
          setDialog(null)
        }}
        data-testid="admin-entfernen-dialog"
      >
        <p>Das lässt sich nicht rückgängig machen.</p>
      </Bestaetigung>
    </section>
  )
}
