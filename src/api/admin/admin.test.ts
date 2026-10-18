import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import {
  adminNameAnfordern,
  adminNameBestaetigen,
  ergebnisKorrigieren,
  passwortAendern,
  zentralePinAendern,
} from '@/api/admin/admin'
import { ApiFehler } from '@/api/common/fehler'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

describe('passwortAendern', () => {
  test('sendet altes und neues Passwort unveraendert und ohne Hintergrundkopf', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/admin/passwort/aendern', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      passwortAendern({ altesPasswort: ' beispiel-passwort-01', neuesPasswort: 'beispiel-passwort-02 ' }),
    ).resolves.toBeUndefined()

    // Kein trim() auf Passwoertern, auch nicht zur Sicherheit.
    expect(rumpf).toEqual({
      altesPasswort: ' beispiel-passwort-01',
      neuesPasswort: 'beispiel-passwort-02 ',
    })
    expect(kopf).toBeNull()
  })

  test('wirft bei falschem altem Passwort einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/admin/passwort/aendern', () =>
        problem(401, 'ADMIN_PASSWORT_FALSCH', 'Das bisherige Passwort ist nicht korrekt.'),
      ),
    )

    const fehler = await passwortAendern({
      altesPasswort: 'falsch',
      neuesPasswort: 'beispiel-passwort-02',
    }).catch((e: unknown) => e)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(401)
    expect((fehler as ApiFehler).code).toBe('ADMIN_PASSWORT_FALSCH')
  })
})

describe('ergebnisKorrigieren', () => {
  test('sendet Termin, Sieger, deutlich und version als Voll-Update ohne Hintergrundkopf', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/admin/ergebnis/korrigieren', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(
      ergebnisKorrigieren({ terminId: 102, sieger: 'B', deutlich: false, version: 3 }),
    ).resolves.toBeUndefined()

    // Alle vier Felder sind Pflicht, auch wenn sich ein Wert nicht aendert.
    expect(rumpf).toEqual({ terminId: 102, sieger: 'B', deutlich: false, version: 3 })
    expect(kopf).toBeNull()
  })

  test('uebersetzt 409 DATEN_VERALTET in einen ApiFehler: neu laden und erneut speichern', async () => {
    mockServer.use(
      http.post('*/admin/ergebnis/korrigieren', () =>
        problem(409, 'DATEN_VERALTET', 'Das Ergebnis wurde zwischenzeitlich geändert.'),
      ),
    )

    const fehler = await ergebnisKorrigieren({ terminId: 102, sieger: 'A', deutlich: true, version: 1 }).catch(
      (f: unknown) => f,
    )

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(409)
    expect((fehler as ApiFehler).code).toBe('DATEN_VERALTET')
  })
})

/** Fängt einen Aufruf ab und hält Methode, Rumpf und Hintergrundkopf fest. */
function aufrufFangen(pfad: string, status: number) {
  const gesehen: { rumpf: unknown; kopf: string | null; aufrufe: number } = { rumpf: undefined, kopf: 'nicht gelesen', aufrufe: 0 }
  mockServer.use(
    http.post(pfad, async ({ request }) => {
      gesehen.aufrufe += 1
      gesehen.rumpf = await request.json()
      gesehen.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      return new HttpResponse(null, { status })
    }),
  )
  return gesehen
}

describe('zentralePinAendern', () => {
  test('sendet nur die neue PIN ohne Hintergrundkopf', async () => {
    const gesehen = aufrufFangen('*/admin/pin/aendern', 204)

    await expect(zentralePinAendern({ neuePin: '4711' })).resolves.toBeUndefined()

    // Kein Feld fuer die alte PIN (Vertrag).
    expect(gesehen.rumpf).toEqual({ neuePin: '4711' })
    expect(gesehen.kopf).toBeNull()
  })

  test('uebersetzt 400 EINGABE_UNGUELTIG mit felder in einen ApiFehler', async () => {
    mockServer.use(
      http.post('*/admin/pin/aendern', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 400,
            code: 'EINGABE_UNGUELTIG',
            detail: 'Die Eingabe ist ungültig.',
            felder: { neuePin: 'Genau vier Ziffern.' },
          },
          { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await zentralePinAendern({ neuePin: '12' }).catch((e: unknown) => e)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).felder?.neuePin).toBe('Genau vier Ziffern.')
  })
})

describe('adminNameAnfordern', () => {
  test('sendet den Namen, behandelt 202 ohne Rumpf als Erfolg und liest nichts aus der Antwort', async () => {
    const gesehen = aufrufFangen('*/admin/name/aendern', 202)

    await expect(adminNameAnfordern({ neuerName: 'Beispieladmin Neu' })).resolves.toBeUndefined()

    expect(gesehen.rumpf).toEqual({ neuerName: 'Beispieladmin Neu' })
    expect(gesehen.kopf).toBeNull()
  })

  test('uebersetzt 409 NAME_BELEGT und 429 NAME_AENDERUNG_GEDROSSELT', async () => {
    mockServer.use(
      http.post('*/admin/name/aendern', () => problem(409, 'NAME_BELEGT', 'Dieser Name ist bereits vergeben.')),
    )
    const belegt = await adminNameAnfordern({ neuerName: 'Beispielspieler 01' }).catch((e: unknown) => e)
    expect((belegt as ApiFehler).code).toBe('NAME_BELEGT')
    expect((belegt as ApiFehler).status).toBe(409)

    mockServer.use(
      http.post('*/admin/name/aendern', () =>
        problem(429, 'NAME_AENDERUNG_GEDROSSELT', 'Zu viele Anforderungen. Bitte versuche es in einer Stunde erneut.'),
      ),
    )
    const gedrosselt = await adminNameAnfordern({ neuerName: 'Neu' }).catch((e: unknown) => e)
    expect((gedrosselt as ApiFehler).code).toBe('NAME_AENDERUNG_GEDROSSELT')
  })
})

describe('adminNameBestaetigen', () => {
  test('sendet nur die fuenfstellige PIN und keinen Namen', async () => {
    const gesehen = aufrufFangen('*/admin/name/bestaetigen', 204)

    await expect(adminNameBestaetigen({ bestaetigungsPin: '12345' })).resolves.toBeUndefined()

    expect(gesehen.rumpf).toEqual({ bestaetigungsPin: '12345' })
    expect(gesehen.kopf).toBeNull()
  })

  test('uebersetzt 401 NAME_PIN_FALSCH und 409 NAME_AENDERUNG_UNGUELTIG mit Code', async () => {
    mockServer.use(
      http.post('*/admin/name/bestaetigen', () => problem(401, 'NAME_PIN_FALSCH', 'Die PIN ist nicht korrekt.')),
    )
    const falsch = await adminNameBestaetigen({ bestaetigungsPin: '00000' }).catch((e: unknown) => e)
    expect((falsch as ApiFehler).status).toBe(401)
    expect((falsch as ApiFehler).code).toBe('NAME_PIN_FALSCH')

    mockServer.use(
      http.post('*/admin/name/bestaetigen', () =>
        problem(409, 'NAME_AENDERUNG_UNGUELTIG', 'Es liegt keine gültige Anforderung vor.'),
      ),
    )
    const ungueltig = await adminNameBestaetigen({ bestaetigungsPin: '12345' }).catch((e: unknown) => e)
    expect((ungueltig as ApiFehler).code).toBe('NAME_AENDERUNG_UNGUELTIG')
  })
})
