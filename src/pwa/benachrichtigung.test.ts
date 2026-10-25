import { describe, expect, test } from 'vitest'
import { benachrichtigungBauen, zielPfad } from './benachrichtigung'

describe('zielPfad (G10)', () => {
  test('lässt Pfade des eigenen Ursprungs durch', () => expect(zielPfad('/termine/7')).toBe('/termine/7'))
  test('weist //fremd ab', () => expect(zielPfad('//fremd.example/x')).toBe('/'))
  test('weist /\\fremd ab (Browser lesen \\ wie /)', () => expect(zielPfad('/\\fremd.example')).toBe('/'))
  test('weist absolute Adressen ab', () => expect(zielPfad('https://fremd.example/termine/7')).toBe('/'))
  test('weist javascript: ab', () => expect(zielPfad('javascript:alert(1)')).toBe('/'))
  test('undefined, null, Zahl ⇒ /', () => {
    expect(zielPfad(undefined)).toBe('/')
    expect(zielPfad(null)).toBe('/')
    expect(zielPfad(7)).toBe('/')
  })
})

/** Nutzlast wie vom Server: Rückfalltext immer gefüllt (P9). */
const ERINNERUNG = {
  typ: 'ERINNERUNG',
  titel: 'Kicken am Montag, 19:00 Uhr',
  text: 'Bitte um Rückmeldung',
  terminId: 42,
  datum: '2026-11-02',
  uhrzeit: '19:00:00',
  ort: 'Halle Nord',
  url: '/termine/42',
}

describe('benachrichtigungBauen', () => {
  test('Erinnerung: Wochentag und Uhrzeit ohne Sekunden, Ort, tag je Termin', () => {
    expect(benachrichtigungBauen(ERINNERUNG)).toEqual({
      titel: 'Kicken am Montag, 19:00 Uhr',
      text: 'Bitte gib Bescheid, ob du dabei bist. Ort: Halle Nord',
      tag: 'termin-42',
      renotify: false,
      url: '/termine/42',
    })
  })

  test('Erinnerung mit Uhrzeit ohne Sekunden', () => {
    expect(benachrichtigungBauen({ ...ERINNERUNG, uhrzeit: '18:30' }).titel).toBe('Kicken am Montag, 18:30 Uhr')
  })

  test('Erinnerung ohne Ort (null und fehlend)', () => {
    expect(benachrichtigungBauen({ ...ERINNERUNG, ort: null }).text).toBe('Bitte gib Bescheid, ob du dabei bist.')
    const ohneOrt: Partial<typeof ERINNERUNG> = { ...ERINNERUNG }
    delete ohneOrt.ort
    expect(benachrichtigungBauen(ohneOrt).text).toBe('Bitte gib Bescheid, ob du dabei bist.')
  })

  test('Absage: Wochentag, renotify, derselbe tag wie die Erinnerung (G4)', () => {
    const absage = benachrichtigungBauen({ ...ERINNERUNG, typ: 'TERMIN_ABGESAGT', titel: 'x', text: 'y' })
    expect(absage).toEqual({
      titel: 'Kicken am Montag fällt aus',
      text: 'Der Termin wurde abgesagt.',
      tag: 'termin-42',
      renotify: true,
      url: '/termine/42',
    })
    expect(absage.tag).toBe(benachrichtigungBauen(ERINNERUNG).tag)
  })

  test('Probe: eigener Titel ohne Anwendungsnamen (P13), tag probe, Ziel /', () => {
    const probe = benachrichtigungBauen({
      typ: 'PROBE',
      titel: 'FuBo – Testbenachrichtigung',
      text: 'Der Versand über diesen Server funktioniert auf diesem Gerät.',
      terminId: null,
      datum: null,
      uhrzeit: null,
      ort: null,
      url: '/',
    })
    expect(probe).toEqual({
      titel: 'Testbenachrichtigung',
      text: 'Der Versand über diesen Server funktioniert auf diesem Gerät.',
      tag: 'probe',
      renotify: false,
      url: '/',
    })
    expect(probe.titel).not.toMatch(/FuBo/)
  })

  test('unbekannter typ: Rückfalltext des Servers (G3)', () => {
    expect(benachrichtigungBauen({ typ: 'NEU', titel: 'Etwas Neues', text: 'Mit Text', terminId: 9, url: '/x' })).toEqual({
      titel: 'Etwas Neues',
      text: 'Mit Text',
      tag: 'termin-9',
      renotify: false,
      url: '/x',
    })
  })

  test('fehlende Felder bei bekanntem typ: Rückfalltext', () => {
    const anzeige = benachrichtigungBauen({ typ: 'ERINNERUNG', titel: 'Rückfall', text: 'Text', terminId: 3 })
    expect(anzeige.titel).toBe('Rückfall')
    expect(anzeige.tag).toBe('termin-3')
  })

  test('kaputtes Datum wirft nicht, sondern fällt zurück', () => {
    expect(() => benachrichtigungBauen({ ...ERINNERUNG, datum: '02.11.2026' })).not.toThrow()
    expect(benachrichtigungBauen({ ...ERINNERUNG, datum: '02.11.2026' }).titel).toBe(ERINNERUNG.titel)
    expect(benachrichtigungBauen({ ...ERINNERUNG, datum: '2026-13-45' }).titel).toBe(ERINNERUNG.titel)
  })

  test('null (keine oder kaputte Nutzlast): immer eine Anzeige', () => {
    expect(benachrichtigungBauen(null)).toEqual({
      titel: 'Neue Nachricht',
      text: 'Öffne die App für Einzelheiten.',
      tag: undefined,
      renotify: false,
      url: '/',
    })
  })

  test('fremde URL in der Nutzlast wird zu /', () => {
    expect(benachrichtigungBauen({ ...ERINNERUNG, url: '//fremd.example' }).url).toBe('/')
  })
})
