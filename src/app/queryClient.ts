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
 * Erkennt, ob ein Fehler das Ende der Sitzung meldet.
 *
 * **Nicht jeder `401` ist ein Sitzungsende.** Der Kontrakt antwortet auch auf
 * falsche Zugangsdaten mit `401`: `PIN_FALSCH`, `ADMIN_PASSWORT_FALSCH` und
 * `RESET_PIN_FALSCH`. `ADMIN_PASSWORT_FALSCH` kommt dabei auch beim
 * Passwortwechsel vor, also mitten in einer gültigen Sitzung. Würden diese Fälle
 * als Sitzungsende behandelt, löste eine vertippte PIN die Abmeldung aus, und
 * ein falsches Admin-Passwort leitete von `/admin/anmelden` auf `/anmelden` um.
 *
 * Verzweigt wird deshalb über `code`, nicht über den Status allein:
 * `SESSION_UNGUELTIG` ist der Code des Vertrags für eine fehlende oder
 * abgelaufene Sitzung. `UNBEKANNT` zählt mit, weil ein `401` ohne lesbaren Rumpf
 * nicht vom Server selbst stammt (etwa von einem vorgeschalteten Proxy) und
 * die Sitzung dann ebenso wenig belegt ist.
 *
 * @param fehler Der Fehler einer Abfrage oder Mutation.
 */
function istSitzungsende(fehler: unknown): boolean {
  return (
    fehler instanceof ApiFehler &&
    fehler.status === 401 &&
    (fehler.code === 'SESSION_UNGUELTIG' || fehler.code === 'UNBEKANNT')
  )
}

/**
 * Beendet die Sitzung clientseitig: Cache leeren, zur PIN-Eingabe.
 *
 * Der Cache wird geleert und nicht nur verworfen: Er überlebt den Wechsel der
 * Route. Ohne das Leeren sähe die nächste angemeldete Person kurz die Daten der
 * vorigen – auf einem Gerät, das am Spielfeldrand herumgereicht wird, ist das
 * kein theoretischer Fall.
 *
 * Eine Funktion für beide Wege, die dahin führen: den `401` an irgendeinem
 * Aufruf (`pruefeSitzung`) und die ausdrückliche Abmeldung (`useAbmelden`). Die
 * Abmeldung räumt so genauso auf wie ein Ablauf – zwei Kopien liefen irgendwann
 * auseinander.
 */
export function sitzungsendeAusloesen() {
  queryClient.clear()
  beiSitzungsende()
}

/**
 * Behandelt den Sitzungsablauf an genau einer Stelle (A14).
 *
 * `401` steht im Kontrakt an allen 44 Operationen. Ohne zentrale Behandlung
 * stünde die Abfrage in jeder Ansicht – und fehlte irgendwann in einer.
 */
function pruefeSitzung(fehler: unknown) {
  if (istSitzungsende(fehler)) sitzungsendeAusloesen()
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
