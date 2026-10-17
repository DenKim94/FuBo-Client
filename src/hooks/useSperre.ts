import { useEffect, useEffectEvent, useState } from 'react'
import { ApiFehler } from '@/api/common/fehler'

/** Eigenschaften von {@link useSperre}. */
type SperreOptionen = {
  /**
   * Wird gerufen, wenn die Wartezeit abgelaufen ist – üblicherweise `reset` der
   * Mutation, damit die Meldung mit der veralteten Zeitangabe verschwindet.
   */
  beimEnde?: () => void
}

/** Zustand und Eingang einer Sperre. */
export type Sperre = {
  /** Wahr, solange der Server eine Wartezeit verlangt; die Absenden-Schaltfläche bleibt dann gesperrt. */
  aktiv: boolean
  /** Setzt die Sperre, wenn der Fehler eine Wartezeit nennt (`429` mit `wartesekunden`); sonst ohne Wirkung. */
  ausFehler: (fehler: unknown) => void
}

/**
 * Hält eine Eingabe für die Wartezeit des Servers gesperrt (`429`).
 *
 * Aus `PinEingabe` herausgelöst (C4, 5.1), weil derselbe Ablauf an fünf weiteren
 * Stellen gebraucht wird: Admin-Anmeldung, Reset, Passwortwechsel (alle
 * `PIN_GESPERRT`, derselbe Brute-Force-Zähler) und die Anforderung der
 * Bestätigungs-PIN (`RESET_GEDROSSELT`). Verzweigt wird über den Status `429`
 * und die genannte Wartezeit, nicht über den Code: Alle gedrosselten Antworten
 * des Kontrakts tragen `wartesekunden`.
 *
 * **Die Wartezeit kommt aus dem Rumpf der Antwort** (`ApiFehler.wartesekunden`),
 * nicht aus der Geräteuhr: Die Uhr dient nur, um den Zeitpunkt des Endes zu
 * bestimmen. Der Server entscheidet weiter selbst – ein zu früher Versuch
 * wäre schlicht wieder `429`.
 *
 * Verwendung:
 * ```ts
 * const sperre = useSperre({ beimEnde: anmeldung.reset })
 * // im onError der Mutation:  sperre.ausFehler(fehler)
 * // an der Schaltfläche:      disabled={sperre.aktiv}
 * ```
 *
 * `beimEnde` darf eine neue Funktion je Render sein: Es läuft als Effekt-Ereignis
 * und setzt den Zeitgeber nicht zurück.
 */
export function useSperre({ beimEnde }: SperreOptionen = {}): Sperre {
  const [sperreBis, setSperreBis] = useState<number | null>(null)

  const sperreBeenden = useEffectEvent(() => {
    setSperreBis(null)
    beimEnde?.()
  })

  // Hebt die Sperre nach der Wartezeit des Servers auf.
  useEffect(() => {
    if (sperreBis === null) return
    const zeitgeber = window.setTimeout(() => sperreBeenden(), Math.max(0, sperreBis - Date.now()))
    return () => window.clearTimeout(zeitgeber)
  }, [sperreBis])

  function ausFehler(fehler: unknown) {
    if (fehler instanceof ApiFehler && fehler.status === 429 && fehler.wartesekunden) {
      setSperreBis(Date.now() + fehler.wartesekunden * 1000)
    }
  }

  return { aktiv: sperreBis !== null, ausFehler }
}
