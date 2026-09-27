import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiFehler } from '@/api/common/fehler'

/**
 * Rückruf für den Sitzungsablauf.
 *
 * Vorbelegt mit einer wirkungslosen Funktion, damit ein `401` vor dem Start des
 * Routers nicht ins Leere greift.
 */
let beiSitzungsende: () => void = () => {}

/**
 * Hinterlegt, was bei einem `401` geschehen soll.
 *
 * Wird einmal beim Start aufgerufen (siehe `SitzungsWaechter`). Das Umleiten
 * bleibt bewusst beim Router: Ein harter Seitenwechsel über `window.location`
 * würfe die ganze Anwendung weg, lüde sie neu und zeigte dem Nutzer dazwischen
 * ein weißes Bild.
 *
 * @param rueckruf Wird nach dem Leeren des Caches aufgerufen.
 */
export function sitzungsendeBehandeln(rueckruf: () => void) {
  beiSitzungsende = rueckruf
}

/**
 * Behandelt den Sitzungsablauf an genau einer Stelle (A14).
 *
 * `401` steht im Kontrakt an allen 44 Operationen. Ohne zentrale Behandlung
 * stünde die Abfrage in jeder Ansicht – und fehlte irgendwann in einer.
 *
 * Der Cache wird geleert und nicht nur verworfen: Er überlebt den Wechsel der
 * Route. Ohne das Leeren sähe die nächste angemeldete Person kurz die Daten der
 * vorigen – auf einem Gerät, das am Spielfeldrand herumgereicht wird, ist das
 * kein theoretischer Fall.
 */
function pruefeSitzung(fehler: unknown) {
  if (fehler instanceof ApiFehler && fehler.status === 401) {
    queryClient.clear()
    beiSitzungsende()
  }
}

/**
 * Der Query-Client der Anwendung.
 *
 * Bewusst in einer eigenen Datei und nicht neben der Provider-Komponente: Die
 * globale Fehlerbehandlung braucht direkten Zugriff darauf, und eine Datei, die
 * sowohl eine Komponente als auch einen Wert ausgibt, bricht das Hot-Reloading.
 *
 * Die Vorgaben sind zurückhaltend, weil der Server die Autorität ist und der
 * Client Daten nur kurz hält.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: pruefeSitzung }),
  mutationCache: new MutationCache({ onError: pruefeSitzung }),
  defaultOptions: {
    queries: {
      // Kurz genug, dass Zu- und Absagen zeitnah sichtbar werden, lang genug,
      // dass die Ansicht nicht bei jeder Bewegung neu lädt.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (versuch: number, fehler: Error) => {
        // Fachliche Ablehnungen sind endgültig: Ein zweiter Versuch ändert
        // nichts und verschärft bei 429 (PIN-Sperre) sogar die Sperre.
        if (fehler instanceof ApiFehler && fehler.status < 500) return false
        return versuch < 1
      },
    },
    mutations: {
      // Nicht Bequemlichkeit, sondern fachlich geboten: A21 legt fest, dass der
      // zuerst eingetragene Ergebniseintrag gilt, und A15 zählt
      // Generierungsläufe gegen ein Kontingent. Ein automatischer zweiter
      // Versuch nach einer Zeitüberschreitung verbrauchte stillschweigend ein
      // Kontingent oder erzeugte einen Eintrag, der nicht mehr änderbar ist.
      retry: 0,
    },
  },
})
