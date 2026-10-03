import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { queryClient } from '@/app/queryClient'

/**
 * Stellt in Tests den Query-Client der Anwendung bereit.
 *
 * Bewusst der echte und kein eigens erzeugter: Nur so laufen die globale
 * 401-Behandlung und die Wiederholungsregel mit, auf die sich die Hooks
 * verlassen. Den Cache leert der jeweilige Test nach jedem Fall.
 */
export function QueryUmgebung({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
