import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ergebnisKorrigieren, passwortAendern } from '@/api/admin/admin'
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
