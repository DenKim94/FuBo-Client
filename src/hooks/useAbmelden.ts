import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { sitzungBeenden } from '@/api/auth/auth'
import { sitzungsendeAusloesen } from '@/app/queryClient'

/**
 * Meldet die Person ab (`POST /auth/session/beenden`).
 *
 * Aufgerufen mit `mutate()`. **Erst der Server, dann der Client:** Der Widerruf
 * auf dem Server ist die eigentliche Abmeldung (der Token ist sofort wertlos,
 * auch wenn das Cookie bliebe). Nach dem Erfolg räumt `sitzungsendeAusloesen`
 * auf – derselbe Weg wie beim Ablauf: Cache leeren, zur PIN-Eingabe.
 *
 * **Schlägt der Aufruf fehl, bleibt die Person angemeldet** und bekommt den
 * Fehler zu sehen. Ein stilles Abmelden im Client bei weiter gültiger
 * Sitzung wäre schlimmer: Ein Gast behielte seinen Platz, und die Sitzung
 * bliebe auf dem Server offen, obwohl die Oberfläche etwas anderes sagt. Ist
 * die Sitzung dagegen schon weg (`401 SESSION_UNGUELTIG`), räumt die globale
 * Behandlung auf – der Nutzer ist am Ziel.
 *
 * Steht hier und nicht im Dialog: Dieselbe Abmeldung braucht die Schaltfläche
 * in der Kopfzeile (`AppLayout`).
 */
export function useAbmelden(): UseMutationResult<void, Error, void> {
  return useMutation({
    mutationFn: () => sitzungBeenden(),
    onSuccess: () => sitzungsendeAusloesen(),
  })
}
