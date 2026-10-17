import TerminAnsicht from '@/components/TerminAnsicht/TerminAnsicht'
import { useTerminParameter } from '@/hooks/useTerminParameter'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import style from './TerminDetail.module.scss'

/**
 * Ansicht eines gewählten Termins (`termine/:terminId`, C5, 8): derselbe
 * Baustein wie das Dashboard, aber mit offener Teilnehmerliste und Verweisen auf
 * Teams und Ergebnis.
 *
 * **Die Adresse wird geprüft, bevor etwas abgerufen wird:** `termine/abc` liefe
 * sonst als `400` an den Server, `termine/0` als `404`. Ungültig heißt „nicht
 * gefunden“ und löst keinen Abruf aus. Ein entfernter Termin (`404`) zeigt die
 * Ansicht selbst als Leerzustand mit Rückweg. Ein Direktaufruf (Lesezeichen,
 * später Push) funktioniert: Guard und Daten kommen aus Sitzung und Server.
 */
export default function TerminDetail() {
  const { gueltig, terminId } = useTerminParameter()

  if (!gueltig || terminId === undefined) return <NichtGefunden />

  return (
    <section className={style.detail} data-testid="termin-detail">
      <TerminAnsicht terminId={terminId} eingeklappt={false} verweise />
    </section>
  )
}
