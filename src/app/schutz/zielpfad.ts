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
 * Pfade der Admin-Ansichten (C4), je nach Stufe oder Rolle erreichbar.
 *
 * Die Literale stehen nur hier. **Der Name `/auth/…` oder `/admin/…` am
 * Endpunkt ist kein Hinweis auf die Stufe:** Die Anmeldeansichten brauchen
 * `PIN_VERIFIED`, die Verwaltung die Rolle `ADMIN`.
 */
export const ADMIN_PFADE = {
  /** Stufe `PIN_VERIFIED`: Anmeldung mit Name und Passwort. */
  anmelden: '/admin/anmelden',
  /** Stufe `PIN_VERIFIED`: Passwort vergessen, Schritt 1 (PIN anfordern). */
  passwortVergessen: '/admin/passwort/vergessen',
  /** Stufe `PIN_VERIFIED`: Passwort vergessen, Schritt 2 (PIN und neues Passwort). */
  passwortNeu: '/admin/passwort/neu',
  /** Rolle `ADMIN`: Dashboard (bis C7 ein Platzhalter). */
  start: '/admin',
  /** Rolle `ADMIN`: Passwort im angemeldeten Zustand ändern. */
  passwortAendern: '/admin/passwort/aendern',
} as const

/**
 * Bestimmt, wohin eine Person mit dieser Sitzung gehört.
 *
 * Die Abbildung von Stufe auf Pfad ist die einzige Stelle, an der der
 * Login-Ablauf als Reihenfolge festgelegt ist. Die Guards fragen nur noch
 * „bin ich dieser Pfad?" und leiten sonst hierhin um.
 *
 * **Der Admin landet im Admin-Dashboard** (C4, E1), alle anderen auf der
 * Startseite. Das User-Dashboard bleibt für den Admin erreichbar (A9).
 *
 * @param zustand Der Sitzungszustand aus `useSitzung`.
 * @returns Der Pfad, auf dem die Person in ihrer Stufe stehen soll.
 */
export function zielFuerStufe(
  zustand: Pick<SitzungZustand, 'angemeldet' | 'pinGeprueft' | 'istAdmin'>,
): string {
  if (zustand.angemeldet) return zustand.istAdmin ? ADMIN_PFADE.start : LOGIN_PFADE.start
  if (zustand.pinGeprueft) return LOGIN_PFADE.name
  return LOGIN_PFADE.pin
}
