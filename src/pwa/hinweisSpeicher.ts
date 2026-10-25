/**
 * Merkt sich je Gerät, welche Onboarding-Hinweise erledigt oder weggeklickt sind (C9, 7.2, E33).
 *
 * **Nur eine Bedienhilfe, keine Daten:** kein Token, keine Personendaten (AGENT_CLIENT.md: „Kein Token im
 * `localStorage`“ bleibt unberührt). Die Installation ist eine Eigenschaft des Geräts, nicht der Person; deshalb
 * gilt der Vermerk für jeden, der sich auf diesem Gerät anmeldet. Die Einstellungen bleiben der Weg für später.
 *
 * **Jeder Zugriff in `try/catch`:** Safari im privaten Modus und gesperrte Website-Daten werfen beim Lesen oder
 * Schreiben. Scheitert der Speicher, gilt ein Hinweis für diesen Seitenaufruf als erledigt, sobald er weggeklickt ist
 * (Zustand im Speicher des Moduls).
 */

/** Die beiden Schritte des Onboardings. */
export type HinweisArt = 'installation' | 'benachrichtigungen'

/** Schlüssel im `localStorage`. Für Menschen unsichtbar; der Name folgt der Anleitung. */
export const HINWEIS_SCHLUESSEL = 'fubo.hinweise'

type Vermerke = Partial<Record<HinweisArt, true>>

/** Rückfall, wenn der Speicher nicht geht, und Spiegel des gespeicherten Stands. */
let imModul: Vermerke = {}
const beobachter = new Set<() => void>()

function lesen(): Vermerke {
  try {
    const roh = window.localStorage.getItem(HINWEIS_SCHLUESSEL)
    const gelesen = roh ? (JSON.parse(roh) as unknown) : {}
    return typeof gelesen === 'object' && gelesen !== null ? { ...(gelesen as Vermerke), ...imModul } : { ...imModul }
  } catch {
    return { ...imModul }
  }
}

/** Ist der Hinweis noch offen (weder erledigt noch weggeklickt)? */
export function hinweisOffen(art: HinweisArt): boolean {
  return lesen()[art] !== true
}

/** Vermerkt einen Hinweis als erledigt; er wird auf diesem Gerät nicht wieder angeboten. */
export function hinweisErledigt(art: HinweisArt): void {
  imModul = { ...imModul, [art]: true }
  try {
    window.localStorage.setItem(HINWEIS_SCHLUESSEL, JSON.stringify(lesen()))
  } catch {
    // Speicher gesperrt: Der Vermerk gilt bis zum Neuladen (oben im Modul).
  }
  beobachter.forEach((f) => f())
}

/** Meldet Änderungen (für `useSyncExternalStore`). */
export function hinweiseAbonnieren(rueckruf: () => void): () => void {
  beobachter.add(rueckruf)
  return () => beobachter.delete(rueckruf)
}

/** Nur für Tests: vergisst den Stand des Moduls (der `localStorage` bleibt, wie er ist). */
export function hinweiseZuruecksetzen(): void {
  imModul = {}
}
