import { useCallback, useSyncExternalStore } from 'react'
import { hinweisOffen, hinweiseAbonnieren, type HinweisArt } from '@/pwa/hinweisSpeicher'

/**
 * Ob ein Onboarding-Hinweis auf diesem Gerät noch offen ist (C9, 7.2). Ändert sich, sobald er irgendwo erledigt wird
 * (auch über `appinstalled`).
 */
export function useHinweisOffen(art: HinweisArt): boolean {
  const lesen = useCallback(() => hinweisOffen(art), [art])
  return useSyncExternalStore(hinweiseAbonnieren, lesen, () => false)
}
