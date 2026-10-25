import { usePushAbgleich } from '@/hooks/push/usePushAbgleich'

/**
 * Start-Abgleich des Push-Abonnements (C9, E29). Rendert nichts.
 *
 * Steht wie der `SitzungsWaechter` einmal im `AppLayout`: Jeder Seitenaufruf beginnt dort, gleich auf welcher Route.
 * Die Logik liegt in `usePushAbgleich`.
 */
export default function PushAbgleich() {
  usePushAbgleich()
  return null
}
