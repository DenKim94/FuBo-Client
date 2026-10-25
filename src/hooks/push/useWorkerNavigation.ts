import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { navigationsNachrichtenHoeren } from '@/pwa/pushGeraet'

/**
 * Navigiert in der Anwendung, wenn der Service Worker es nach dem Antippen einer Benachrichtigung meldet (C9, 6.5).
 *
 * Die Navigation in der SPA spart das Neuladen. Ist die Sitzung abgelaufen, führt `GeschuetzteRoute` über die
 * Anmeldung zum Ziel zurück (C3). Steht einmal im `AppLayout`.
 */
export function useWorkerNavigation() {
  const navigate = useNavigate()
  useEffect(() => navigationsNachrichtenHoeren((pfad) => void navigate(pfad)), [navigate])
}
