import { describe, expect, test } from 'vitest'
import {
  FEHLER_ENDDATUM,
  aenderungKoerper,
  alsSerie,
  anlegenKoerper,
  liegtInVergangenheit,
  serieFehler,
  serieKoerper,
  WOCHENTAGE,
  type SerieWerte,
} from './terminEingabe'

const stand = { terminId: 5, version: 3, datum: '2099-03-02', uhrzeit: '20:00:00', ort: 'Beispielhalle' }
const unveraendert = { datum: '2099-03-02', uhrzeit: '20:00', ort: 'Beispielhalle' }

describe('liegtInVergangenheit', () => {
  const jetzt = new Date(2099, 2, 2, 20, 0).getTime()

  test('prüft Datum und Uhrzeit zusammen', () => {
    expect(liegtInVergangenheit('2099-03-02', '19:59', jetzt)).toBe(true)
    expect(liegtInVergangenheit('2099-03-03', '00:00', jetzt)).toBe(false)
  })

  test('der Beginn selbst gilt als vergangen: niemand kann mehr zusagen', () => {
    expect(liegtInVergangenheit('2099-03-02', '20:00', jetzt)).toBe(true)
    expect(liegtInVergangenheit('2099-03-02', '20:01', jetzt)).toBe(false)
  })
})

describe('anlegenKoerper', () => {
  test('lässt einen leeren oder aus Leerzeichen bestehenden Ort weg', () => {
    expect(anlegenKoerper({ datum: '2099-03-02', uhrzeit: '20:00', ort: '   ' })).toEqual({ datum: '2099-03-02', uhrzeit: '20:00' })
    expect('ort' in anlegenKoerper({ datum: '2099-03-02', uhrzeit: '20:00', ort: '' })).toBe(false)
  })

  test('trimmt den Ort', () => {
    expect(anlegenKoerper({ datum: '2099-03-02', uhrzeit: '20:00', ort: '  Beispielhalle ' }).ort).toBe('Beispielhalle')
  })
})

describe('aenderungKoerper', () => {
  test('ohne Änderung null, auch wenn nur die Sekunden der Uhrzeit abweichen', () => {
    expect(aenderungKoerper(stand, unveraendert)).toBeNull()
    expect(aenderungKoerper(stand, { ...unveraendert, ort: '  Beispielhalle  ' })).toBeNull()
  })

  test('sendet nur das Geänderte samt version', () => {
    expect(aenderungKoerper(stand, { ...unveraendert, datum: '2099-03-09' })).toEqual({ terminId: 5, version: 3, datum: '2099-03-09' })
    expect(aenderungKoerper(stand, { ...unveraendert, uhrzeit: '19:30' })).toEqual({ terminId: 5, version: 3, uhrzeit: '19:30' })
    expect(aenderungKoerper(stand, { ...unveraendert, ort: 'Andere Halle' })).toEqual({ terminId: 5, version: 3, ort: 'Andere Halle' })
  })

  test('ein geleerter Ort geht als "" hinaus, nicht als null', () => {
    const koerper = aenderungKoerper(stand, { ...unveraendert, ort: ' ' })
    expect(koerper).toEqual({ terminId: 5, version: 3, ort: '' })
  })

  test('ein vorher fehlender Ort und ein leeres Feld sind keine Änderung', () => {
    expect(aenderungKoerper({ ...stand, ort: null }, { ...unveraendert, ort: '' })).toBeNull()
    expect(aenderungKoerper({ ...stand, ort: undefined }, { ...unveraendert, ort: '' })).toBeNull()
  })

  test('mehrere Änderungen gehen zusammen hinaus', () => {
    expect(aenderungKoerper(stand, { datum: '2099-03-09', uhrzeit: '21:00', ort: '' })).toEqual({
      terminId: 5,
      version: 3,
      datum: '2099-03-09',
      uhrzeit: '21:00',
      ort: '',
    })
  })
})

describe('alsSerie', () => {
  test('das gemeinsame Datum ist das Startdatum', () => {
    const serie = alsSerie({ datum: '2099-03-01', uhrzeit: '20:00', ort: '', titel: 'T', wochentag: '2', enddatum: '2099-03-15' })
    expect(serie.startdatum).toBe('2099-03-01')
    expect(serie.enddatum).toBe('2099-03-15')
  })
})

describe('Serie', () => {
  const gueltig: SerieWerte = {
    titel: '  Beispielserie ',
    wochentag: '2',
    uhrzeit: '20:00',
    startdatum: '2099-03-01',
    enddatum: '2099-03-15',
    ort: '',
  }

  test('ein gültiges Formular hat keine Fehler', () => {
    expect(serieFehler(gueltig)).toEqual({})
  })

  test('jedes leere Pflichtfeld ist ein Fehler, der Wochentag hat keine Vorauswahl', () => {
    const fehler = serieFehler({ titel: ' ', wochentag: '', uhrzeit: '', startdatum: '', enddatum: '', ort: '' })
    expect(Object.keys(fehler).sort()).toEqual(['enddatum', 'startdatum', 'titel', 'uhrzeit', 'wochentag'])
  })

  test('das Enddatum muss strikt nach dem Startdatum liegen', () => {
    expect(serieFehler({ ...gueltig, enddatum: '2099-03-01' }).enddatum).toBe(FEHLER_ENDDATUM)
    expect(serieFehler({ ...gueltig, enddatum: '2099-02-28' }).enddatum).toBe(FEHLER_ENDDATUM)
    expect(serieFehler({ ...gueltig, enddatum: '2099-03-02' }).enddatum).toBeUndefined()
  })

  test('serieKoerper wandelt den Wochentag in eine Zahl, trimmt und lässt einen leeren Ort weg', () => {
    expect(serieKoerper(gueltig)).toEqual({
      titel: 'Beispielserie',
      wochentag: 2,
      uhrzeit: '20:00',
      startdatum: '2099-03-01',
      enddatum: '2099-03-15',
    })
    expect(serieKoerper({ ...gueltig, ort: ' Beispielhalle ' }).ort).toBe('Beispielhalle')
  })
})

describe('WOCHENTAGE', () => {
  test('sieben Tage von Montag (1) bis Sonntag (7) mit Kurzform für die Segmente', () => {
    expect(WOCHENTAGE.map((t) => t.wert)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
    expect(WOCHENTAGE.map((t) => t.kurz)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'])
    expect(WOCHENTAGE[0]?.text).toBe('Montag')
    expect(WOCHENTAGE[6]?.text).toBe('Sonntag')
  })
})
