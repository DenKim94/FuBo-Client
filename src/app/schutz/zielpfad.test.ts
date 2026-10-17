import { describe, expect, test } from 'vitest'
import { ADMIN_PFADE, LOGIN_PFADE, zielFuerStufe } from './zielpfad'

/** Zustand ohne Sitzung; einzelne Felder werden je Fall ueberschrieben. */
function zustand(teil: Partial<Parameters<typeof zielFuerStufe>[0]> = {}) {
  return { angemeldet: false, pinGeprueft: false, istAdmin: false, ...teil }
}

describe('zielFuerStufe', () => {
  test('fuehrt ohne Sitzung zur PIN-Eingabe', () => {
    expect(zielFuerStufe(zustand())).toBe(LOGIN_PFADE.pin)
  })

  test('fuehrt in PIN_VERIFIED zur Namensauswahl', () => {
    expect(zielFuerStufe(zustand({ pinGeprueft: true }))).toBe(LOGIN_PFADE.name)
  })

  test('fuehrt einen angemeldeten Spieler zur Startseite', () => {
    expect(zielFuerStufe(zustand({ angemeldet: true }))).toBe(LOGIN_PFADE.start)
  })

  test('fuehrt den angemeldeten Admin ins Admin-Dashboard (E1)', () => {
    // A9: getrennte Dashboards. Das User-Dashboard bleibt erreichbar, ist aber nicht das Ziel.
    expect(zielFuerStufe(zustand({ angemeldet: true, istAdmin: true }))).toBe(ADMIN_PFADE.start)
  })

  test('behandelt eine Admin-Rolle ohne abgeschlossene Anmeldung nicht als Admin', () => {
    expect(zielFuerStufe(zustand({ pinGeprueft: true, istAdmin: true }))).toBe(LOGIN_PFADE.name)
  })
})
