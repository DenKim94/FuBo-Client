import type { SitzungZustand } from '@/hooks/useSitzung'

/**
 * Die drei Einstiegspfade des Logins, je einer pro Stufe.
 *
 * An einem Ort, weil drei Stellen sie kennen müssen – die beiden Guards und der
 * `SitzungsWaechter`. Steht ein Pfad an zweien davon als Literal, führt die
 * erste Umbenennung einer Route zu einer Umleitung ins Leere.
 */
export const LOGIN_PFADE = {
  /** Stufe 1: ohne Sitzung – zentrale PIN. */
  pin: '/pin/pruefen',
  /** Stufe 2: `PIN_VERIFIED` – Namensauswahl. */
  name: '/anmelden',
  /** Stufe 3: `PROFILE_AUTHENTICATED` – Dashboard. */
  start: '/',
} as const

/**
 * Bestimmt, wohin eine Person mit dieser Sitzung gehört.
 *
 * Die Abbildung von Stufe auf Pfad ist die einzige Stelle, an der der
 * Login-Ablauf als Reihenfolge festgelegt ist. Die Guards fragen nur noch
 * „bin ich dieser Pfad?" und leiten sonst hierhin um.
 *
 * @param zustand Der Sitzungszustand aus `useSitzung`.
 * @returns Der Pfad, auf dem die Person in ihrer Stufe stehen soll.
 */
export function zielFuerStufe(zustand: Pick<SitzungZustand, 'angemeldet' | 'pinGeprueft'>): string {
  if (zustand.angemeldet) return LOGIN_PFADE.start
  if (zustand.pinGeprueft) return LOGIN_PFADE.name
  return LOGIN_PFADE.pin
}
