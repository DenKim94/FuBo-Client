import { Navigate, Outlet, useLocation } from 'react-router'
import { LOGIN_PFADE, zielFuerStufe } from '@/app/schutz/zielpfad'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useSitzung } from '@/hooks/useSitzung'

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
 * wird bei der Umleitung mitgenommen, damit die Anmeldung am Ende dorthin
 * zurückführen kann.
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
    return <Navigate to={ziel} replace state={ort.state} />
  }

  return <Outlet />
}
