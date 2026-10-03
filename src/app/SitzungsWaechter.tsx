import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { sitzungsendeBehandeln } from '@/app/queryClient'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'

/**
 * Verbindet die globale Behandlung des Sitzungsendes mit dem Router. Rendert nichts.
 *
 * **Abgrenzung zu `GeschuetzteRoute`:** Der Guard prüft beim **Betreten** einer
 * Route den Sitzungszustand, den `useSitzung` gerade kennt. Läuft die Sitzung
 * **während** der Nutzung ab – der Nutzer steht auf der Teamansicht, und die
 * nächste Abfrage oder Mutation antwortet mit `401 SESSION_UNGUELTIG` –, merkt
 * der Guard davon nichts: Sein Zustand wird erst beim nächsten Neulesen der
 * Sitzung aktualisiert. Diese Lücke schliesst der Wächter. `queryClient.ts`
 * erkennt das Sitzungsende an jedem beliebigen Aufruf, leert den Cache und
 * ruft den hier hinterlegten Rückruf auf; der leitet dann um.
 *
 * Der Wächter existiert, weil `queryClient.ts` ausserhalb von React liegt und
 * kein `useNavigate` hat. Er ist die Brücke dorthin und gehört genau einmal in
 * den Baum, innerhalb des `RouterProvider`.
 *
 * Ziel ist die PIN-Eingabe: Nach einem Sitzungsende gibt es keine Sitzung mehr,
 * auch keine in der Stufe `PIN_VERIFIED`. Die Umleitung ersetzt den Eintrag im
 * Verlauf (`replace`), damit „Zurück" nicht auf die Ansicht führt, deren
 * Sitzung gerade abgelaufen ist.
 */
export default function SitzungsWaechter() {
  const navigate = useNavigate()

  useEffect(() => {
    sitzungsendeBehandeln(() => void navigate(LOGIN_PFADE.pin, { replace: true }))
  }, [navigate])

  return null
}
