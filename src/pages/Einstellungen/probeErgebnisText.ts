import type { Probeversand } from '@/api/push/push'

/**
 * Ergebnis des Probeversands in Worten (C9, 6.3). `empfaenger` zählt Geräte, keine Personen; `0` ist kein Fehler,
 * sondern „auf diesem Konto ist kein Gerät angemeldet“ (3.3). `zugestellt` ist keine Zustellbestätigung.
 */
export function probeErgebnisText({ empfaenger, zugestellt }: Probeversand): string {
  if (empfaenger === 0) return 'Auf deinem Konto ist kein Gerät eingerichtet.'
  return `An ${empfaenger} ${empfaenger === 1 ? 'Gerät' : 'Geräte'} gesendet, ${zugestellt} vom Push-Dienst angenommen.`
}
