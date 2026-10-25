import { describe, expect, test } from 'vitest'
import { GERAET_TEXT, anlageText, geraetLage, gesamtsatz, personText, type LageEingabe } from './pushLage'
import type { Umgebung } from './umgebung'

const ANDROID: Umgebung = { ios: false, standalone: false, sicher: true, pushMoeglich: true }
const ABO = { endpoint: 'https://push.example/1', schluessel: null }

function lage(teil: Omit<Partial<LageEingabe>, 'umgebung'> & { umgebung?: Partial<Umgebung> }) {
  return geraetLage({
    schluesselVerfuegbar: true,
    geraet: { berechtigung: 'default', abo: null },
    ...teil,
    umgebung: { ...ANDROID, ...teil.umgebung },
  })
}

describe('geraetLage (jede Zeile aus 4.3)', () => {
  test('server bei 503', () => expect(lage({ schluesselVerfuegbar: false })).toBe('server'))
  test('unsicher ohne https', () => expect(lage({ umgebung: { sicher: false } })).toBe('unsicher'))
  test('iosAblegen in Safari', () =>
    expect(lage({ umgebung: { ios: true, standalone: false, pushMoeglich: false } })).toBe('iosAblegen'))
  test('nichtMoeglich ohne PushManager', () => expect(lage({ umgebung: { pushMoeglich: false } })).toBe('nichtMoeglich'))
  test('blockiert bei denied', () =>
    expect(lage({ geraet: { berechtigung: 'denied', abo: null } })).toBe('blockiert'))
  test('eingerichtet mit Abonnement', () =>
    expect(lage({ geraet: { berechtigung: 'granted', abo: ABO } })).toBe('eingerichtet'))
  test('nichtEingerichtet sonst', () => expect(lage({})).toBe('nichtEingerichtet'))

  test('iOS als abgelegte App mit Push gilt wie jedes andere Gerät', () =>
    expect(lage({ umgebung: { ios: true, standalone: true } })).toBe('nichtEingerichtet'))

  describe('Reihenfolge: was der Nutzer nicht ändern kann, zuerst', () => {
    test('server vor unsicher', () =>
      expect(lage({ schluesselVerfuegbar: false, umgebung: { sicher: false } })).toBe('server'))
    test('unsicher vor iosAblegen', () =>
      expect(lage({ umgebung: { sicher: false, ios: true, pushMoeglich: false } })).toBe('unsicher'))
    test('iosAblegen vor nichtMoeglich', () =>
      expect(lage({ umgebung: { ios: true, pushMoeglich: false } })).toBe('iosAblegen'))
    test('nichtMoeglich vor blockiert', () =>
      expect(lage({ umgebung: { pushMoeglich: false }, geraet: { berechtigung: 'denied', abo: null } })).toBe(
        'nichtMoeglich',
      ))
    test('blockiert vor eingerichtet (entzogene Berechtigung mit altem Abonnement)', () =>
      expect(lage({ geraet: { berechtigung: 'denied', abo: ABO } })).toBe('blockiert'))
  })

  test('undefined, solange der Schlüssel nicht gelesen ist', () =>
    expect(lage({ schluesselVerfuegbar: undefined })).toBeUndefined())
  test('undefined, solange der Gerätestand fehlt', () => expect(lage({ geraet: undefined })).toBeUndefined())
  test('undefined ohne Umgebung, server aber schon', () => {
    expect(geraetLage({ umgebung: undefined, geraet: undefined, schluesselVerfuegbar: true })).toBeUndefined()
    expect(geraetLage({ umgebung: undefined, geraet: undefined, schluesselVerfuegbar: false })).toBe('server')
  })
  test('Lagen ohne Gerätestand brauchen ihn nicht', () =>
    expect(lage({ geraet: undefined, umgebung: { sicher: false } })).toBe('unsicher'))
})

describe('Texte', () => {
  test('jede Lage hat einen Text', () => {
    expect(GERAET_TEXT.eingerichtet).toBe('Auf diesem Gerät eingerichtet.')
    expect(GERAET_TEXT.nichtEingerichtet).toBe('Auf diesem Gerät nicht eingerichtet.')
  })
  test('Anlage und Person', () => {
    expect(anlageText(false)).toMatch(/^Vom Admin abgeschaltet/)
    expect(anlageText(true)).toBe('Vom Admin eingeschaltet')
    expect(personText(false)).toBe('Von dir abgeschaltet')
    expect(personText(true)).toMatch(/alle deine Geräte/)
  })
})

describe('gesamtsatz', () => {
  const an = { anlageAktiv: true, pushErwuenscht: true }
  test('alles passt', () =>
    expect(gesamtsatz('eingerichtet', an, false)).toBe('Du bekommst Erinnerungen und Absagen auf diesem Gerät.'))
  test('Anlage zuerst', () =>
    expect(gesamtsatz('nichtEingerichtet', { anlageAktiv: false, pushErwuenscht: false }, false)).toMatch(/Admin/))
  test('dann die Person', () =>
    expect(gesamtsatz('nichtEingerichtet', { anlageAktiv: true, pushErwuenscht: false }, false)).toMatch(/für dich/))
  test('dann das Gerät', () => expect(gesamtsatz('blockiert', an, false)).toMatch(/im Browser blockiert/))
  test('ohne Status kein Satz', () => expect(gesamtsatz('eingerichtet', undefined, false)).toBeUndefined())
  test('Admin: nur das Gerät zählt', () => {
    expect(gesamtsatz('eingerichtet', undefined, true)).toBe('Dieses Gerät empfängt den Probeversand.')
    expect(gesamtsatz('nichtEingerichtet', { anlageAktiv: false, pushErwuenscht: false }, true)).toMatch(
      /keinen Probeversand/,
    )
  })
})
