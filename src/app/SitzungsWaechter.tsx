import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { sitzungsendeBehandeln } from '@/app/queryClient'

/**
 * Verbindet die globale `401`-Behandlung mit dem Router. Rendert nichts.
 *
 * Gehört genau einmal in den Baum, innerhalb des `RouterProvider` – sonst gäbe
 * es kein `useNavigate`. Die Umleitung ersetzt den Eintrag im Verlauf
 * (`replace`), damit „Zurück" nicht auf die Ansicht führt, deren Sitzung gerade
 * abgelaufen ist.
 */
export default function SitzungsWaechter() {
  const navigate = useNavigate()

  useEffect(() => {
    sitzungsendeBehandeln(() => void navigate('/anmelden', { replace: true }))
  }, [navigate])

  return null
}
