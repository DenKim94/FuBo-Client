import { QueryClient } from '@tanstack/react-query'

/**
 * Der Query-Client der Anwendung.
 *
 * Bewusst in einer eigenen Datei und nicht neben der Provider-Komponente: Die
 * globale Fehlerbehandlung braucht spaeter direkten Zugriff darauf (bei `401`
 * den Cache leeren), und eine Datei, die sowohl eine Komponente als auch einen
 * Wert ausgibt, bricht das Hot-Reloading.
 *
 * Die Vorgaben sind zurueckhaltend, weil der Server die Autoritaet ist und der
 * Client Daten nur kurz haelt.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Kurz genug, dass Zu- und Absagen zeitnah sichtbar werden, lang genug,
      // dass die Ansicht nicht bei jeder Bewegung neu laedt.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      // Nicht Bequemlichkeit, sondern fachlich geboten: A21 legt fest, dass der
      // zuerst eingetragene Ergebniseintrag gilt, und A15 zaehlt
      // Generierungslaeufe gegen ein Kontingent. Ein automatischer zweiter
      // Versuch nach einer Zeitueberschreitung verbrauchte stillschweigend ein
      // Kontingent oder erzeugte einen Eintrag, der nicht mehr aenderbar ist.
      retry: 0,
    },
  },
})
