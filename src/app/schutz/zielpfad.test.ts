import { describe, expect, test } from 'vitest'
import { ADMIN_PFADE, LOGIN_PFADE, zielFuerStufe } from './zielpfad'

/** Zustand ohne Sitzung; einzelne Felder werden je Fall ueberschrieben. */
function zustand(teil: Partial<Parameters<typeof zielFuerStufe>[0]> = {}) {
  return { angemeldet: false, pinGeprueft: false, istAdmin: false, ...teil }
}

describe('ADMIN_PFADE (C7, 6.1)', () => {
  test('liefert die festen Pfade der Verwaltung', () => {
    expect(ADMIN_PFADE.start).toBe('/admin')
    expect(ADMIN_PFADE.profile).toBe('/admin/profile')
    expect(ADMIN_PFADE.profilNeu).toBe('/admin/profile/neu')
    expect(ADMIN_PFADE.termine).toBe('/admin/termine')
    expect(ADMIN_PFADE.terminNeu).toBe('/admin/termine/neu')
    expect(ADMIN_PFADE.gaeste).toBe('/admin/gaeste')
    expect(ADMIN_PFADE.konfiguration).toBe('/admin/konfiguration')
    expect(ADMIN_PFADE.teams).toBe('/admin/teams')
    expect(ADMIN_PFADE.pin).toBe('/admin/pin')
    expect(ADMIN_PFADE.nameAendern).toBe('/admin/name/aendern')
    expect(ADMIN_PFADE.nameBestaetigen).toBe('/admin/name/bestaetigen')
  })

  test('bildet die Pfade mit Parameter aus der Id', () => {
    expect(ADMIN_PFADE.profilBearbeiten(7)).toBe('/admin/profile/7')
    expect(ADMIN_PFADE.terminVerwaltung(102)).toBe('/admin/termine/102')
  })

  test('liegt jeder Pfad unter /admin', () => {
    const pfade = Object.values(ADMIN_PFADE).map((p) => (typeof p === 'function' ? p(1) : p))
    expect(pfade.every((p) => p.startsWith('/admin'))).toBe(true)
  })
})

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
    // A9: getrennte Dashboards. Der Admin landet in `/admin`; das User-Dashboard leitet ihn dorthin um (C5, E7).
    expect(zielFuerStufe(zustand({ angemeldet: true, istAdmin: true }))).toBe(ADMIN_PFADE.start)
  })

  test('behandelt eine Admin-Rolle ohne abgeschlossene Anmeldung nicht als Admin', () => {
    expect(zielFuerStufe(zustand({ pinGeprueft: true, istAdmin: true }))).toBe(LOGIN_PFADE.name)
  })
})
