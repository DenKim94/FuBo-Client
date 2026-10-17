import type { Sieger } from '@/api/ergebnis/ergebnis'

/**
 * Der Ausgang als Satz: „Team A hat gewonnen.“, „Team B hat deutlich gewonnen.“,
 * „Unentschieden.“
 *
 * An einem Ort, weil Anzeige und Bestätigungsdialog denselben Satz brauchen: Wer
 * ihn vor dem Absenden liest, soll genau den sehen, der nachher dasteht.
 * **Bei `U` bleibt `deutlich` unbeachtet** – ein Unentschieden ist nie deutlich.
 *
 * @param sieger Ausgang des Spiels.
 * @param deutlich Ob der Sieg deutlich ausfiel.
 */
export function ergebnisSatz(sieger: Sieger, deutlich: boolean): string {
  if (sieger === 'U') return 'Unentschieden.'
  const team = sieger === 'A' ? 'Team A' : 'Team B'
  return `${team} hat ${deutlich ? 'deutlich ' : ''}gewonnen.`
}
