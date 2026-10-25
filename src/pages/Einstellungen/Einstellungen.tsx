import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useSitzung } from '@/hooks/useSitzung'
import InstallationBereich from './InstallationBereich'
import ProbeversandBereich from './ProbeversandBereich'
import PushBereich from './PushBereich'
import style from './Einstellungen.module.scss'

/**
 * Einstellungen (`/einstellungen`, C9 6.2, A25c/f, DESIGN.md Ansicht 20).
 *
 * Für jede angemeldete Person erreichbar, deshalb **nicht** im Admin-Paket. Aufbau:
 *
 * - **Benachrichtigungen** (USER, ADMIN): Zustand in drei Ebenen, Personenschalter (nur USER), Gerätebereich.
 * - **Probeversand** (nur ADMIN), mit dem Anlagenschalter daneben.
 * - **App installieren** (nur wenn die App nicht schon als App läuft; unabhängig vom Vermerk des Onboardings).
 *
 * **GAST** sieht nur einen Satz (E23): Die Push-Endpunkte antworten ihm mit `403` (A25d), und eine leere Seite ließe
 * ihn suchen. Er erreicht die Seite nur über die Adresse; das Symbol in der Kopfzeile bekommt er nicht.
 *
 * Solange die Rolle nicht bekannt ist, steht nur der Ladespinner: Sonst liefen die Push-Abrufe einen Augenblick auch
 * für einen Gast (in der Anwendung wartet schon `GeschuetzteRoute`, die Seite verlässt sich aber nicht darauf).
 */
export default function Einstellungen() {
  const { laedt, istGast, istAdmin } = useSitzung()
  if (laedt) return <Ladespinner groesse="gross" zentriert text="Einstellungen werden geladen" />

  return (
    <section className={style.seite} data-testid="einstellungen">
      <h1 className={style.titel}>Einstellungen</h1>
      {istGast ? (
        <p className={style.satz} data-testid="einstellungen-gast">
          Für Gäste gibt es keine Einstellungen.
        </p>
      ) : (
        <>
          <PushBereich istAdmin={istAdmin} />
          {istAdmin && <ProbeversandBereich />}
          <InstallationBereich />
        </>
      )}
    </section>
  )
}
