import { hinweisErledigt } from './hinweisSpeicher'

/**
 * Installationsangebot (C9, 7.1, E32).
 *
 * `beforeinstallprompt` gibt es nur in Chromium-Browsern und es kommt **oft, bevor React steht** – deshalb wird es in
 * `main.tsx` vor `createRoot` abgefangen ({@link installationBeobachten}) und hier zurückgehalten. `prompt()` geht je
 * Ereignis genau einmal. iOS kennt das Ereignis nicht; dort zeigt die Oberfläche eine Anleitung.
 */

/** Das nicht standardisierte Ereignis aus Chromium. */
type InstallEreignis = Event & {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let zurueckgehalten: InstallEreignis | null = null
const beobachter = new Set<() => void>()
const melden = () => beobachter.forEach((f) => f())

/**
 * Fängt `beforeinstallprompt` und `appinstalled` ab. **In `main.tsx` vor `createRoot` aufrufen.**
 *
 * `preventDefault()` unterdrückt die Mini-Infoleiste des Browsers; das Angebot macht die Karte (Onboarding) bzw. die
 * Einstellungen. Nach `appinstalled` ist der Hinweis erledigt.
 *
 * @param w Das Fenster; Vorgabe das globale.
 */
export function installationBeobachten(w: Window = window): void {
  w.addEventListener('beforeinstallprompt', (ereignis) => {
    ereignis.preventDefault()
    zurueckgehalten = ereignis as InstallEreignis
    melden()
  })
  w.addEventListener('appinstalled', () => {
    zurueckgehalten = null
    hinweisErledigt('installation')
    melden()
  })
}

/**
 * Öffnet den Installationsdialog des Browsers.
 *
 * Muss aus einer Nutzergeste kommen. Das Ereignis wird vorher verworfen: `prompt()` geht nur einmal.
 */
export async function installieren(): Promise<'angenommen' | 'abgelehnt' | 'nichtMoeglich'> {
  const ereignis = zurueckgehalten
  if (!ereignis) return 'nichtMoeglich'
  zurueckgehalten = null
  melden()
  try {
    await ereignis.prompt()
    return (await ereignis.userChoice).outcome === 'accepted' ? 'angenommen' : 'abgelehnt'
  } catch {
    return 'nichtMoeglich'
  }
}

/** Meldet Änderungen (für `useSyncExternalStore`). */
export function installationAbonnieren(rueckruf: () => void): () => void {
  beobachter.add(rueckruf)
  return () => beobachter.delete(rueckruf)
}

/** Liegt ein zurückgehaltenes Ereignis vor (der Knopf „Installieren“ hätte eine Wirkung)? */
export function installationMoeglich(): boolean {
  return zurueckgehalten !== null
}

/** Nur für Tests: verwirft ein zurückgehaltenes Ereignis. */
export function installationZuruecksetzen(): void {
  zurueckgehalten = null
}
