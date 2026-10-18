import { useRef } from 'react'
import TerminAnsicht from '@/components/TerminAnsicht/TerminAnsicht'
import Hinweis from '@/components/Hinweis/Hinweis'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useTerminParameter } from '@/hooks/useTerminParameter'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import TerminVerwaltung from './TerminVerwaltung'
import style from './AdminTerminDetail.module.scss'

/** Die Verwaltungsansicht für eine gültige Id. */
function Verwaltung({ terminId }: { terminId: number }) {
  const hinweis = useNavigationsHinweis()
  const ueberschrift = useRef<HTMLHeadingElement>(null)

  return (
    <section className={style.seite} data-testid="admin-termin-detail">
      {hinweis.hinweis !== null && <Hinweis data-testid="admin-termin-hinweis">{hinweis.hinweis}</Hinweis>}
      <TerminAnsicht terminId={terminId} eingeklappt={false} nurLesen ohneAktualisierung ueberschriftRef={ueberschrift}>
        <TerminVerwaltung terminId={terminId} ueberschriftRef={ueberschrift} />
      </TerminAnsicht>
    </section>
  )
}

/**
 * Verwaltungsansicht eines Termins (`/admin/termine/:terminId`, C7 8.4).
 *
 * **Die Adresse wird geprüft, bevor etwas abgerufen wird** (`useTerminParameter`): `termine/abc` oder `termine/0`
 * zeigen „nicht gefunden“, ohne Abruf.
 *
 * **Aufbau:** `TerminAnsicht` im Lesemodus (`nurLesen`: der Admin hat weder Zusagestatus noch Rückmeldeleiste) und ohne
 * Polling (`ohneAktualisierung`: an dem Stand hängt ein Formular), darunter als Kinder die Abschnitte von
 * `TerminVerwaltung`. Ein Hinweis aus der Navigation („Termin angelegt.“) steht oben.
 *
 * **Keine haftende `Aktionsleiste`:** Die Seite hat mehrere Abschnitte mit eigenen Schaltflächen; eine Leiste liesse
 * offen, auf welchen Abschnitt sie wirkt. Jede Aktion steht im Abschnitt, in dem sie wirkt.
 */
export default function AdminTerminDetail() {
  const { gueltig, terminId } = useTerminParameter()

  if (!gueltig || terminId === undefined) return <NichtGefunden />

  return <Verwaltung terminId={terminId} />
}
