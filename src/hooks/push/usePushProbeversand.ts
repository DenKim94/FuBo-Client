import { useMutation } from '@tanstack/react-query'
import { pushProbeversand } from '@/api/push/push'

/**
 * Probeversand an die eigenen Geräte des Admins (C9, 6.3, P6).
 *
 * Das Ergebnis lebt im Zustand der Mutation, nicht im Cache: Es ist eine Momentaufnahme. Wie jede Mutation **ohne
 * Wiederholung** – ein zweiter Versuch schickte eine zweite Nachricht.
 */
export function usePushProbeversand() {
  return useMutation({ mutationFn: () => pushProbeversand() })
}
