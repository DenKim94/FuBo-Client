import { describe, expect, test } from 'vitest'
import {
  mitte,
  vorgabe,
  profilAenderung,
  skillsAenderung,
  skillsVollstaendig,
  skillZahl,
  type SkillKategorie,
} from './skills'
import { SKILL_VORGABEN } from './skillVorgaben'

/** Erfundene Kategorien: Nichts darf von `ANGRIFF` oder `TORWART` abhängen. */
function kategorie(schluessel: string, minWert: number, maxWert: number): SkillKategorie {
  return { schluessel, bezeichnung: schluessel, gewicht: 1, reihenfolge: 1, minWert, maxWert }
}

const zehn = kategorie('ZEHN', 0, 10)
const klein = kategorie('KLEIN', 0, 3)
const verschoben = kategorie('VERSCHOBEN', 2, 5)
const alle = [zehn, klein, verschoben]

describe('vorgabe', () => {
  test('ohne Abweichung gilt die Mitte der Skala', () => {
    expect(vorgabe(zehn)).toBe(5)
    expect(vorgabe(klein, { ANDERE: 1 })).toBe(2)
  })

  test('eine Abweichung im Bereich gilt, auch die untere Grenze', () => {
    expect(vorgabe(klein, { KLEIN: 0 })).toBe(0)
    expect(vorgabe(zehn, { ZEHN: 10 })).toBe(10)
  })

  test('eine Abweichung ausserhalb des Bereichs oder keine ganze Zahl zählt nicht', () => {
    expect(vorgabe(verschoben, { VERSCHOBEN: 0 })).toBe(4)
    expect(vorgabe(klein, { KLEIN: 4 })).toBe(2)
    expect(vorgabe(klein, { KLEIN: 1.5 })).toBe(2)
  })
})

describe('Vorgaben beim Anlegen (SKILL_VORGABEN)', () => {
  test('Torwart startet bei 0, solange 0 im Bereich liegt', () => {
    expect(vorgabe({ ...klein, schluessel: 'TORWART' }, SKILL_VORGABEN)).toBe(0)
  })

  test('andere Kategorien behalten die Mitte', () => {
    expect(vorgabe({ ...klein, schluessel: 'ANGRIFF', maxWert: 6 }, SKILL_VORGABEN)).toBe(3)
  })
})

describe('mitte', () => {
  test('rundet die Mitte der Skala', () => {
    expect(mitte(kategorie('A', 0, 6))).toBe(3)
    expect(mitte(kategorie('B', 0, 3))).toBe(2)
    expect(mitte(zehn)).toBe(5)
    expect(mitte(verschoben)).toBe(4)
  })
})

describe('skillsVollstaendig', () => {
  test('ist wahr, wenn jede Kategorie einen Wert hat (auch 0)', () => {
    expect(skillsVollstaendig({ ZEHN: 0, KLEIN: 1, VERSCHOBEN: 2 }, alle)).toBe(true)
  })

  test('ist falsch, wenn eine Kategorie fehlt', () => {
    expect(skillsVollstaendig({ ZEHN: 4, KLEIN: 1 }, alle)).toBe(false)
  })

  test('ignoriert Schlüssel, die keine aktive Kategorie sind', () => {
    expect(skillsVollstaendig({ ZEHN: 4, ALT: 3 }, [zehn])).toBe(true)
  })

  test('ohne Kategorien gilt jede Karte als vollständig', () => {
    expect(skillsVollstaendig({}, [])).toBe(true)
  })
})

describe('skillZahl', () => {
  test('liest eine ganze Zahl im Bereich, auch die Grenzen', () => {
    expect(skillZahl('0', zehn)).toBe(0)
    expect(skillZahl('10', zehn)).toBe(10)
    expect(skillZahl(' 7 ', zehn)).toBe(7)
    expect(skillZahl('2', verschoben)).toBe(2)
  })

  test('leer ist kein Wert (nicht 0)', () => {
    expect(skillZahl('', zehn)).toBeNull()
    expect(skillZahl('   ', zehn)).toBeNull()
  })

  test('weist Zahlen ausserhalb des Bereichs und Nichtzahlen ab', () => {
    expect(skillZahl('11', zehn)).toBeNull()
    expect(skillZahl('1', verschoben)).toBeNull()
    expect(skillZahl('-1', zehn)).toBeNull()
    expect(skillZahl('2,5', zehn)).toBeNull()
    expect(skillZahl('2.5', zehn)).toBeNull()
    expect(skillZahl('1e1', zehn)).toBeNull()
    expect(skillZahl('abc', zehn)).toBeNull()
  })
})

describe('skillsAenderung', () => {
  test('liefert nur die geänderten Kategorien', () => {
    expect(skillsAenderung({ ZEHN: 4, KLEIN: 1 }, { ZEHN: 4, KLEIN: 2 })).toEqual({ KLEIN: 2 })
  })

  test('eine Kategorie, die vorher fehlte, ist eine Änderung', () => {
    expect(skillsAenderung({ ZEHN: 4 }, { ZEHN: 4, KLEIN: 0 })).toEqual({ KLEIN: 0 })
  })

  test('ohne Änderung bleibt die Karte leer', () => {
    expect(skillsAenderung({ ZEHN: 4 }, { ZEHN: 4 })).toEqual({})
  })
})

describe('profilAenderung', () => {
  const vorher = { name: 'Beispielspieler 01', skills: { ZEHN: 4, KLEIN: 1, VERSCHOBEN: 3 } }
  const unveraendert = { name: 'Beispielspieler 01', skills: { ZEHN: '4', KLEIN: '1', VERSCHOBEN: '3' } }

  test('nichts geändert ergibt null', () => {
    expect(profilAenderung(vorher, unveraendert, alle)).toBeNull()
  })

  test('nur der Name', () => {
    expect(profilAenderung(vorher, { ...unveraendert, name: 'Beispielspieler 09' }, alle)).toEqual({
      name: 'Beispielspieler 09',
    })
  })

  test('nur eine Kategorie', () => {
    expect(profilAenderung(vorher, { ...unveraendert, skills: { ...unveraendert.skills, KLEIN: '3' } }, alle)).toEqual({
      skills: { KLEIN: 3 },
    })
  })

  test('Name und Kategorie zusammen', () => {
    expect(
      profilAenderung(vorher, { name: 'Neu', skills: { ...unveraendert.skills, ZEHN: '0' } }, alle),
    ).toEqual({ name: 'Neu', skills: { ZEHN: 0 } })
  })

  test('Randleerzeichen am Namen sind keine Änderung, getrimmt wird gesendet', () => {
    expect(profilAenderung(vorher, { ...unveraendert, name: '  Beispielspieler 01  ' }, alle)).toBeNull()
    expect(profilAenderung(vorher, { ...unveraendert, name: '  Neu  ' }, alle)).toEqual({ name: 'Neu' })
  })

  test('eine reine Änderung der Gross- und Kleinschreibung ist eine Änderung', () => {
    const v = { name: 'Pruefspieler a', skills: {} }
    expect(profilAenderung(v, { name: 'Pruefspieler A', skills: {} }, [])).toEqual({ name: 'Pruefspieler A' })
  })

  test('eine Kategorie, die in der Karte fehlte, zählt erst mit eingetragenem Wert', () => {
    const luecke = { name: 'A', skills: { ZEHN: 4 } }
    expect(profilAenderung(luecke, { name: 'A', skills: { ZEHN: '4', KLEIN: '', VERSCHOBEN: '' } }, alle)).toBeNull()
    expect(profilAenderung(luecke, { name: 'A', skills: { ZEHN: '4', KLEIN: '0', VERSCHOBEN: '' } }, alle)).toEqual({
      skills: { KLEIN: 0 },
    })
  })

  test('ungültige Eingaben werden nicht gesendet', () => {
    expect(profilAenderung(vorher, { ...unveraendert, skills: { ...unveraendert.skills, ZEHN: '99' } }, alle)).toBeNull()
  })

  test('ein leerer Name ist eine Änderung (das Formular sperrt das Speichern)', () => {
    expect(profilAenderung(vorher, { ...unveraendert, name: '   ' }, alle)).toEqual({ name: '' })
  })

  test('Kategorien ausserhalb der aktiven bleiben unberührt', () => {
    expect(
      profilAenderung(vorher, { ...unveraendert, skills: { ...unveraendert.skills, ALT: '5' } }, alle),
    ).toBeNull()
  })
})
