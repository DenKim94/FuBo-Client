import { describe, expect, test } from 'vitest'
import type { TerminUebersicht } from '@/api/termine/termine'
import {
  VERLAUF_TAGE,
  beginnVon,
  datumKurz,
  datumLang,
  heuteIso,
  letzterAbgeschlossener,
  naechsterTermin,
  uhrzeitKurz,
  verlaufAb,
  vergangeneTermine,
  zeitpunktKurz,
} from './terminZeit'

/** Baut einen Termin mit den Angaben, auf die es im Fall ankommt. */
function termin(id: number, datum: string, status: TerminUebersicht['status'], uhrzeit = '19:00:00'): TerminUebersicht {
  return { terminId: id, datum, uhrzeit, status, teilnehmerVersion: 0, zusagen: 0 }
}

describe('beginnVon', () => {
  test('baut den Beginn aus den Teilen in Ortszeit, nicht aus UTC', () => {
    // `new Date('2026-09-01')` wäre Mitternacht UTC und je nach Zeitzone der Vortag.
    const beginn = beginnVon({ datum: '2026-09-01', uhrzeit: '19:00:00' })
    expect(beginn.getFullYear()).toBe(2026)
    expect(beginn.getMonth()).toBe(8)
    expect(beginn.getDate()).toBe(1)
    expect(beginn.getHours()).toBe(19)
    expect(beginn.getMinutes()).toBe(0)
  })

  test('kommt mit und ohne Sekunden zurecht und kennt den Jahreswechsel', () => {
    expect(beginnVon({ datum: '2026-12-31', uhrzeit: '23:30' }).getTime()).toBe(
      beginnVon({ datum: '2026-12-31', uhrzeit: '23:30:00' }).getTime(),
    )
    expect(beginnVon({ datum: '2027-01-01', uhrzeit: '00:00:00' }).getTime()).toBeGreaterThan(
      beginnVon({ datum: '2026-12-31', uhrzeit: '23:30:00' }).getTime(),
    )
  })
})

describe('Formatierung', () => {
  test('datumKurz nennt Wochentag ohne Punkt, Tag und ausgeschriebenen Monat', () => {
    expect(datumKurz('2026-07-28')).toBe('Di, 28. Juli')
    // Monats- und Jahreswechsel
    expect(datumKurz('2026-12-31')).toBe('Do, 31. Dezember')
    expect(datumKurz('2027-01-01')).toBe('Fr, 1. Januar')
  })

  test('datumLang schreibt den Wochentag aus', () => {
    expect(datumLang('2026-07-28')).toBe('Dienstag, 28. Juli')
  })

  test('uhrzeitKurz lässt die Sekunden entfallen', () => {
    expect(uhrzeitKurz('19:00:00')).toBe('19:00')
    expect(uhrzeitKurz('9:05')).toBe('09:05')
  })

  test('zeitpunktKurz zeigt Tag, Monat und Uhrzeit des Geräts', () => {
    const lokal = new Date(2026, 6, 29, 18, 45)
    expect(zeitpunktKurz(lokal.toISOString())).toBe('29.07., 18:45 Uhr')
  })
})

describe('naechsterTermin', () => {
  test('wählt den ersten geplanten Termin in Serverreihenfolge, ohne zu sortieren', () => {
    // Bewusst nicht aufsteigend: Die Funktion verlässt sich auf die Reihenfolge des Servers.
    const liste = [termin(3, '2099-03-01', 'GEPLANT'), termin(1, '2099-01-01', 'GEPLANT')]
    expect(naechsterTermin(liste).termin?.terminId).toBe(3)
  })

  test('gibt abgesagte Termine davor getrennt zurück', () => {
    const liste = [
      termin(1, '2099-01-01', 'ABGESAGT'),
      termin(2, '2099-01-08', 'ABGESAGT'),
      termin(3, '2099-01-15', 'GEPLANT'),
      termin(4, '2099-01-22', 'ABGESAGT'),
    ]
    const { termin: naechster, abgesagtDavor } = naechsterTermin(liste)
    expect(naechster?.terminId).toBe(3)
    // Der abgesagte Termin danach gehört nicht dazu.
    expect(abgesagtDavor.map((t) => t.terminId)).toEqual([1, 2])
  })

  test('zählt einen abgeschlossenen Termin nie als nächsten', () => {
    const liste = [termin(1, '2099-01-01', 'ABGESCHLOSSEN'), termin(2, '2099-01-08', 'GEPLANT')]
    const ergebnis = naechsterTermin(liste)
    expect(ergebnis.termin?.terminId).toBe(2)
    expect(ergebnis.abgesagtDavor).toEqual([])
  })

  test('liefert bei leerer Liste keinen Termin', () => {
    expect(naechsterTermin([])).toEqual({ termin: undefined, abgesagtDavor: [] })
  })

  test('liefert bei nur abgesagten Terminen keinen Termin, aber alle abgesagten', () => {
    const liste = [termin(1, '2099-01-01', 'ABGESAGT'), termin(2, '2099-01-08', 'ABGESAGT')]
    const ergebnis = naechsterTermin(liste)
    expect(ergebnis.termin).toBeUndefined()
    expect(ergebnis.abgesagtDavor).toHaveLength(2)
  })
})

describe('heuteIso und verlaufAb', () => {
  test('heuteIso rechnet in Ortszeit: kurz nach Mitternacht gilt der neue Tag', () => {
    // 00:30 Ortszeit: `toISOString()` läge je nach Zone noch beim Vortag.
    expect(heuteIso(new Date(2026, 9, 17, 0, 30))).toBe('2026-10-17')
    expect(heuteIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  test('verlaufAb zieht die Tage ab und kennt Monats- und Jahreswechsel', () => {
    expect(verlaufAb(new Date(2026, 9, 17, 12), 10)).toBe('2026-10-07')
    expect(verlaufAb(new Date(2026, 2, 5, 12), 10)).toBe('2026-02-23')
    expect(verlaufAb(new Date(2026, 0, 5, 12), 10)).toBe('2025-12-26')
  })

  test('verlaufAb nimmt ohne Angabe das Fenster aus VERLAUF_TAGE', () => {
    const jetzt = new Date(2026, 9, 17, 12)
    expect(verlaufAb(jetzt)).toBe(verlaufAb(jetzt, VERLAUF_TAGE))
  })
})

describe('vergangeneTermine und letzterAbgeschlossener', () => {
  const jetzt = new Date(2026, 9, 17, 12)
  const liste = [
    termin(1, '2026-09-01', 'ABGESCHLOSSEN'),
    termin(2, '2026-09-08', 'ABGESAGT'),
    termin(3, '2026-10-05', 'ABGESCHLOSSEN'),
    termin(4, '2026-10-24', 'ABGESAGT'),
    termin(5, '2026-10-31', 'GEPLANT'),
  ]

  test('kehrt die Reihenfolge um: neueste zuerst', () => {
    expect(vergangeneTermine(liste, jetzt).map((t) => t.terminId)).toEqual([3, 2, 1])
  })

  test('lässt künftige Termine und einen abgesagten künftigen Termin weg', () => {
    const ids = vergangeneTermine(liste, jetzt).map((t) => t.terminId)
    expect(ids).not.toContain(4)
    expect(ids).not.toContain(5)
  })

  test('verändert die Eingabe nicht', () => {
    const vorher = liste.map((t) => t.terminId)
    vergangeneTermine(liste, jetzt)
    expect(liste.map((t) => t.terminId)).toEqual(vorher)
  })

  test('liefert bei leerer Liste nichts', () => {
    expect(vergangeneTermine([], jetzt)).toEqual([])
    expect(letzterAbgeschlossener([])).toBeUndefined()
  })

  test('letzterAbgeschlossener nimmt den letzten abgeschlossenen der aufsteigenden Liste', () => {
    expect(letzterAbgeschlossener(liste)?.terminId).toBe(3)
  })
})
