import { useLayoutEffect, useSyncExternalStore } from 'react'

/**
 * Zahl der gerade sichtbaren Meldungen, die einen Verbindungsfehler anzeigen.
 *
 * **Warum es diesen Zähler gibt:** Ohne Verbindung meldeten sonst zwei Stellen
 * dasselbe – der globale `OfflineHinweis` und die Fehlermeldung der Ansicht,
 * deren Aufruf gerade gescheitert ist. Es soll immer nur **eine** Meldung
 * sichtbar sein, und zwar die der Ansicht: Sie steht dort, wo der Nutzer
 * gerade handelt, und bietet ggf. „Erneut versuchen“ an. Der Streifen bleibt
 * der Rückfall für Ansichten, die selbst nichts melden (Entscheidung vom
 * 04.10.2026).
 *
 * Ein Zähler statt eines Schalters, weil mehrere Meldungen zugleich im Baum
 * stehen können; erst wenn die letzte verschwindet, darf der Streifen zurück.
 * Bewusst ausserhalb von React – nach demselben Muster wie
 * `verbindungsStatus.ts` –, damit `OfflineHinweis` im Layout und die Meldung
 * tief in der Ansicht keinen gemeinsamen Kontext brauchen.
 */
let anzahl = 0

const abonnenten = new Set<() => void>()

/** Benachrichtigt alle Beobachter über eine geänderte Anzahl. */
function benachrichtigen() {
  abonnenten.forEach((rueckruf) => rueckruf())
}

/** Meldet einen Beobachter an; liefert die Abmeldung. */
function abonnieren(rueckruf: () => void): () => void {
  abonnenten.add(rueckruf)
  return () => {
    abonnenten.delete(rueckruf)
  }
}

/**
 * Meldet, solange `aktiv` gilt und die Komponente eingehängt ist, einen
 * sichtbaren Verbindungsfehler an.
 *
 * `useLayoutEffect` statt `useEffect`: Die Meldung und der Streifen entstehen
 * aus demselben gescheiterten Aufruf. Mit `useEffect` stünden beide für einen
 * gezeichneten Frame gleichzeitig da, und das Layout zuckte.
 *
 * @param aktiv `true`, wenn die Meldung gerade einen Netzfehler anzeigt.
 */
export function useNetzfehlerMelden(aktiv: boolean) {
  useLayoutEffect(() => {
    if (!aktiv) return
    anzahl += 1
    benachrichtigen()
    return () => {
      anzahl -= 1
      benachrichtigen()
    }
  }, [aktiv])
}

/** Sagt, ob gerade eine Ansicht selbst einen Verbindungsfehler anzeigt. */
export function useNetzfehlerGemeldet(): boolean {
  return useSyncExternalStore(abonnieren, () => anzahl > 0)
}
