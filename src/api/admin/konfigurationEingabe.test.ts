import { describe, expect, test } from 'vitest'
import {
  HALLE_EMAIL_MAX,
  ersterFehler,
  formAus,
  ganzeZahl,
  konfigurationAnfrage,
  konfigurationFehler,
  konfigurationGeaendert,
  leerlaufWarnung,
  type KonfigurationForm,
} from '@/api/admin/konfigurationEingabe'
import { beispielKonfiguration } from '@/test/mocks/admin'

const stand = { ...beispielKonfiguration(), halleAbsageVorlageEffektiv: 'Ersatz' }

function form(teil: Partial<KonfigurationForm> = {}): KonfigurationForm {
  return { ...formAus(stand), ...teil }
}

describe('ganzeZahl', () => {
  test.each([
    ['12', 12],
    [' 7 ', 7],
    ['0', 0],
    ['-3', -3],
  ])('liest %j als %j', (text, erwartet) => {
    expect(ganzeZahl(text)).toBe(erwartet)
  })

  test.each(['', ' ', '1.5', '1,5', 'abc', '1e3', '--1', '+1'])('lehnt %j ab', (text) => {
    expect(ganzeZahl(text)).toBeNull()
  })
})

describe('formAus / konfigurationAnfrage', () => {
  test('der Körper hat genau fünfzehn Schlüssel: vierzehn Felder und die version', () => {
    const anfrage = konfigurationAnfrage(form(), 3)

    expect(Object.keys(anfrage).sort()).toEqual(
      [
        'version',
        'minTeilnehmer',
        'maxTeilnehmer',
        'anzGuests',
        'algorithmType',
        'auswechselModus',
        'anzTeamGenerator',
        'sessionLeerlaufMinuten',
        'sessionMaximalStunden',
        'halleEmail',
        'halleAbsageVorlage',
        'halleVorlaufStunden',
        'hallenModusAktiv',
        'pushAktiv',
        'pushErinnerungStunden',
      ].sort(),
    )
    expect(Object.keys(anfrage)).toHaveLength(15)
  })

  test('enthält nie die nur lesbaren Felder', () => {
    const anfrage = konfigurationAnfrage(form(), 3) as Record<string, unknown>

    expect(anfrage).not.toHaveProperty('halleAbsageVorlageEffektiv')
    expect(anfrage).not.toHaveProperty('geaendertAm')
  })

  test('unveränderter Stand geht als Zahlen und mit der übergebenen version hinaus', () => {
    const anfrage = konfigurationAnfrage(form(), 9)

    expect(anfrage).toMatchObject({
      version: 9,
      minTeilnehmer: 6,
      maxTeilnehmer: 22,
      anzGuests: 4,
      sessionLeerlaufMinuten: 15,
      sessionMaximalStunden: 1,
      halleVorlaufStunden: 48,
      pushErinnerungStunden: 24,
      hallenModusAktiv: false,
      pushAktiv: true,
    })
    expect(typeof anfrage.minTeilnehmer).toBe('number')
  })

  test('leere Adresse und leere Vorlage werden null, auch bei reinem Leerraum', () => {
    const anfrage = konfigurationAnfrage(form({ halleEmail: '   ', halleAbsageVorlage: ' \n ' }), 1)

    expect(anfrage.halleEmail).toBeNull()
    expect(anfrage.halleAbsageVorlage).toBeNull()
  })

  test('die Adresse wird getrimmt, die Vorlage geht unverändert hinaus (Absätze zählen)', () => {
    const vorlage = '  Guten Tag,\n\nwir sagen ab.\n'
    const anfrage = konfigurationAnfrage(form({ halleEmail: ' halle@beispiel.example ', halleAbsageVorlage: vorlage }), 1)

    expect(anfrage.halleEmail).toBe('halle@beispiel.example')
    expect(anfrage.halleAbsageVorlage).toBe(vorlage)
  })

  test('formAus macht null zu leerem Text', () => {
    expect(formAus(stand)).toMatchObject({ halleEmail: '', halleAbsageVorlage: '' })
  })
})

describe('konfigurationFehler', () => {
  test('der Stand des Servers ist gültig', () => {
    expect(konfigurationFehler(form())).toEqual({})
  })

  test.each([
    ['minTeilnehmer', '0'],
    ['minTeilnehmer', ''],
    ['maxTeilnehmer', '1.5'],
    ['anzGuests', '23'],
    ['anzGuests', '-1'],
    ['anzTeamGenerator', '0'],
    ['sessionLeerlaufMinuten', '0'],
    ['sessionLeerlaufMinuten', '1441'],
    ['sessionMaximalStunden', '25'],
    ['halleVorlaufStunden', '-1'],
    ['pushErinnerungStunden', '169'],
    ['pushErinnerungStunden', '0'],
  ] as const)('meldet %s = %j', (feld, wert) => {
    expect(konfigurationFehler(form({ [feld]: wert }))[feld]).toEqual(expect.any(String))
  })

  test.each([
    ['anzGuests', '0'],
    ['anzGuests', '22'],
    ['sessionLeerlaufMinuten', '1'],
    ['sessionLeerlaufMinuten', '1440'],
    ['sessionMaximalStunden', '24'],
    ['halleVorlaufStunden', '0'],
    ['pushErinnerungStunden', '168'],
  ] as const)('lässt die Grenze %s = %j zu', (feld, wert) => {
    expect(konfigurationFehler(form({ [feld]: wert }))[feld]).toBeUndefined()
  })

  test('die Höchstzahl unter der Mindestzahl wird an der Höchstzahl gemeldet', () => {
    const fehler = konfigurationFehler(form({ minTeilnehmer: '10', maxTeilnehmer: '9' }))

    expect(fehler.maxTeilnehmer).toMatch(/nicht unter der Mindestzahl/)
    expect(fehler.minTeilnehmer).toBeUndefined()
  })

  test('Mindest- gleich Höchstzahl ist erlaubt', () => {
    expect(konfigurationFehler(form({ minTeilnehmer: '8', maxTeilnehmer: '8' }))).toEqual({})
  })

  test('eine ungültige Höchstzahl wird nicht zusätzlich als „unter der Mindestzahl“ gemeldet', () => {
    expect(konfigurationFehler(form({ maxTeilnehmer: 'x' })).maxTeilnehmer).toMatch(/ganze Zahl/)
  })

  test('Adresse: leer ist erlaubt, Unsinn und zu lang nicht', () => {
    expect(konfigurationFehler(form({ halleEmail: '' })).halleEmail).toBeUndefined()
    expect(konfigurationFehler(form({ halleEmail: 'a@b.example' })).halleEmail).toBeUndefined()
    expect(konfigurationFehler(form({ halleEmail: 'keine adresse' })).halleEmail).toMatch(/gültige E-Mail-Adresse/)
    expect(konfigurationFehler(form({ halleEmail: 'a@b' })).halleEmail).toBeDefined()
    const zuLang = `${'a'.repeat(HALLE_EMAIL_MAX)}@b.example`
    expect(konfigurationFehler(form({ halleEmail: zuLang })).halleEmail).toMatch(/höchstens 120 Zeichen/)
  })
})

describe('ersterFehler', () => {
  test('nennt das erste fehlerhafte Feld in der Reihenfolge der Gruppen', () => {
    const fehler = konfigurationFehler(form({ halleVorlaufStunden: '-1', anzGuests: '99' }))

    expect(ersterFehler(fehler)).toBe('anzGuests')
  })

  test('ohne Fehler null', () => {
    expect(ersterFehler({})).toBeNull()
  })
})

describe('leerlaufWarnung', () => {
  test.each([
    ['1', true],
    ['4', true],
    ['5', false],
    ['15', false],
    ['0', false],
    ['', false],
    ['abc', false],
  ])('bei %j ist die Warnung %j', (text, erwartet) => {
    expect(leerlaufWarnung(text)).toBe(erwartet)
  })
})

describe('konfigurationGeaendert', () => {
  test('unverändert ist nicht geändert', () => {
    expect(konfigurationGeaendert(form(), stand)).toBe(false)
  })

  test.each([
    ['Zahl', { anzGuests: '5' }],
    ['Auswahl', { algorithmType: 'HEURISTIK' }],
    ['Haken', { pushAktiv: false }],
    ['Text', { halleEmail: 'halle@beispiel.example' }],
  ] as const)('erkennt eine Änderung (%s)', (_name, teil) => {
    expect(konfigurationGeaendert(form(teil as Partial<KonfigurationForm>), stand)).toBe(true)
  })
})
