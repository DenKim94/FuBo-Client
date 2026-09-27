/**
 * Beobachteter Verbindungszustand aus Sicht der tatsächlichen Aufrufe.
 *
 * **Warum es diesen Zustand zusätzlich zu `navigator.onLine` gibt:** Der
 * Browserwert ist notorisch optimistisch. Er meldet `true`, sobald eine
 * Verbindung zu irgendeinem Netz besteht – auch zu einem WLAN ohne Weg ins
 * Internet, dem Alltagsfall am Sportplatz. Zuverlässig ist nur die eine
 * Richtung: `false` heißt sicher „offline", `true` heißt nur „vielleicht".
 *
 * Den Gegenbeweis liefert die Praxis: Die HTTP-Schicht meldet hier jeden
 * Aufruf, der gar keine Antwort bekommen hat, und jeden, der wieder eine bekam.
 *
 * Bewusst ohne React: Der Zustand entsteht in der API-Schicht, und ein Modul,
 * das beides vermischt, wäre aus `httpService.ts` nicht mehr aufrufbar, ohne
 * React mitzuziehen.
 */
let gestoert = false

const abonnenten = new Set<() => void>()

/**
 * Meldet das Ergebnis eines Aufrufs.
 *
 * @param intakt `true`, wenn eine Antwort kam – gleich welchen Status sie trug.
 *   Ein `403` beweist eine funktionierende Verbindung genauso wie ein `200`.
 */
export function verbindungMelden(intakt: boolean) {
  const neuerZustand = !intakt
  if (neuerZustand === gestoert) return
  gestoert = neuerZustand
  abonnenten.forEach((benachrichtigen) => benachrichtigen())
}

/** Sagt, ob zuletzt ein Aufruf ohne Antwort geblieben ist. */
export function verbindungGestoert(): boolean {
  return gestoert
}

/**
 * Meldet einen Beobachter an.
 *
 * @param rueckruf Wird bei jeder Änderung des Zustands aufgerufen.
 * @returns Funktion zum Abmelden.
 */
export function verbindungAbonnieren(rueckruf: () => void): () => void {
  abonnenten.add(rueckruf)
  return () => {
    abonnenten.delete(rueckruf)
  }
}
