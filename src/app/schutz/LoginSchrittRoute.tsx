import { Navigate, Outlet, useLocation } from 'react-router'
import { LOGIN_PFADE, zielFuerStufe } from '@/app/schutz/zielpfad'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useSitzung } from '@/hooks/useSitzung'

/**
 * Liest die ursprünglich angesteuerte Ansicht aus dem Navigationszustand.
 *
 * Nur ein Pfad innerhalb der Anwendung gilt: Er muss mit genau einem `/`
 * beginnen. `//host` wäre eine Adresse ohne Schema und führte aus der
 * Anwendung hinaus.
 *
 * @param zustand Der Navigationszustand (`location.state`), beliebigen Typs.
 * @returns Der Pfad oder `null`.
 */
function urspruenglichesZiel(zustand: unknown): string | null {
  const von = (zustand as { von?: unknown } | null)?.von
  if (typeof von !== 'string' || !von.startsWith('/') || von.startsWith('//')) return null
  return von
}

/** Eigenschaften des Guards. */
type LoginSchrittRouteEigenschaften = {
  /** Der Schritt, den die Unterrouten abbilden: `pin` (ohne Sitzung) oder `name` (`PIN_VERIFIED`). */
  schritt: 'pin' | 'name'
}

/**
 * Pfadlose Layout-Route: gibt einen Login-Schritt nur in der passenden Stufe frei.
 *
 * Sie ist das Gegenstück zu `GeschuetzteRoute` für die Zeit vor der Anmeldung
 * und sorgt dafür, dass jede Stufe genau eine Ansicht hat:
 *
 * - ohne Sitzung → PIN-Eingabe,
 * - `PIN_VERIFIED` → Namensauswahl,
 * - `PROFILE_AUTHENTICATED` → Startseite.
 *
 * **Daraus folgt auch der Übergang zwischen den Schritten.** Nach einer
 * erfolgreichen PIN-Prüfung meldet `useSitzung` die Stufe `PIN_VERIFIED`, und
 * dieser Guard leitet von selbst auf die Namensauswahl um. Die PIN-Ansicht
 * muss dafür nicht navigieren – die Sitzung des Servers bestimmt den Schritt,
 * nicht ein Klick im Client.
 *
 * Ein vorhandener Navigationszustand (`von`, gesetzt von `GeschuetzteRoute`)
 * wird von Schritt zu Schritt mitgenommen. **Ist die Anmeldung abgeschlossen,
 * führt die Umleitung dorthin zurück** statt zur Startseite – wer über einen
 * Link auf eine Teamansicht kam, landet nach PIN und Namen auch dort.
 *
 * **Bedienkomfort, keine Sicherheitsmassnahme** – wie die übrigen Guards.
 */
export default function LoginSchrittRoute({ schritt }: LoginSchrittRouteEigenschaften) {
  const zustand = useSitzung()
  const ort = useLocation()

  // Erst entscheiden, wenn der Zustand bekannt ist – eine Umleitung auf
  // Verdacht schickte eine angemeldete Person beim Neuladen kurz zur PIN.
  if (zustand.laedt) return <Ladespinner groesse="gross" zentriert />

  const ziel = zielFuerStufe(zustand)
  if (ziel !== LOGIN_PFADE[schritt]) {
    const von = urspruenglichesZiel(ort.state)
    if (ziel === LOGIN_PFADE.start && von) return <Navigate to={von} replace />
    return <Navigate to={ziel} replace state={ort.state} />
  }

  return <Outlet />
}
