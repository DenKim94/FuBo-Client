import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { passwortAendern } from '@/api/admin/admin'
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
