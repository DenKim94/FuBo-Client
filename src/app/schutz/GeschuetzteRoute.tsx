import { Navigate, Outlet, useLocation } from 'react-router'
import { zielFuerStufe } from '@/app/schutz/zielpfad'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useSitzung } from '@/hooks/useSitzung'

/**
 * Pfadlose Layout-Route: gibt ihre Unterrouten nur bei abgeschlossener
 * Anmeldung frei (`stage = PROFILE_AUTHENTICATED`).
 *
 * **Eine Sitzung in der Stufe `PIN_VERIFIED` gilt hier als nicht angemeldet.**
 * Wer die zentrale PIN eingegeben, aber noch keinen Namen gewaehlt hat, darf
 * serverseitig ausschliesslich die Namensliste lesen und die Auswahl absenden;
 * jeder andere Aufruf liefert `403`. Wohin umgeleitet wird, bestimmt die Stufe
 * (`zielFuerStufe`): ohne Sitzung zur PIN-Eingabe, in `PIN_VERIFIED` zur
 * Namensauswahl.
 *
 * **Das ist Bedienkomfort, keine Sicherheitsmassnahme.** Die Autoritaet ist die
 * Filterchain des Servers, die nach dem Prinzip „deny by default" arbeitet. Der
 * Guard verhindert eine Ansicht, die ohnehin nur Fehlermeldungen zeigen wuerde –
 * nicht den Zugriff auf Daten.
 */
export default function GeschuetzteRoute() {
  const zustand = useSitzung()
  const ort = useLocation()

  // Solange der Sitzungszustand unbekannt ist, nicht umleiten: Eine Umleitung
  // auf Verdacht wuerde einen angemeldeten Nutzer bei jedem Neuladen kurz auf
  // die PIN-Eingabe werfen. Statt einer leeren Flaeche erscheint der
  // (verzoegerte) Ladespinner.
  if (zustand.laedt) return <Ladespinner groesse="gross" zentriert />

  if (!zustand.angemeldet) {
    // `replace`, damit die Zurueck-Navigation nicht erneut auf die gesperrte
    // Ansicht fuehrt. Der urspruengliche Pfad wandert in den Navigationszustand,
    // damit die Anmeldung spaeter dorthin zurueckkehren kann.
    return <Navigate to={zielFuerStufe(zustand)} replace state={{ von: ort.pathname }} />
  }

  return <Outlet />
}
