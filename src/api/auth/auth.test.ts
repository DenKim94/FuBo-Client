import { HttpResponse, http } from 'msw'
import { describe, expect, test, vi } from 'vitest'
import { pinPruefen, sitzungLesen } from '@/api/auth/auth'
import { ApiFehler } from '@/api/common/fehler'
import { sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

/** Fängt den Fehler eines Aufrufs ab, damit ein Test seine Felder prüfen kann. */
async function fehlerVon(aufruf: Promise<unknown>): Promise<ApiFehler> {
  const fehler = await aufruf.catch((e: unknown) => e)
  if (!(fehler instanceof ApiFehler)) throw new Error('ApiFehler erwartet')
  return fehler
}

describe('pinPruefen', () => {
  test('loest bei 204 ohne Rueckgabewert auf', async () => {
    await expect(pinPruefen('0000')).resolves.toBeUndefined()
  })

  test('sendet die PIN unveraendert als Rumpf laut Kontrakt', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/auth/pin/pruefen', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    // Fuehrende Null und Leerzeichen bleiben erhalten: Das Format prueft der Server.
    await pinPruefen(' 0123 ')

    expect(rumpf).toEqual({ pin: ' 0123 ' })
    // Eine Anmeldung ist eine Nutzeraktion und kein Hintergrundabruf.
    expect(kopf).toBeNull()
  })

  test('wirft bei falscher PIN einen ApiFehler mit Code und Servertext', async () => {
    mockServer.use(
      http.post('*/auth/pin/pruefen', () =>
        problem(401, 'PIN_FALSCH', 'Die PIN ist nicht korrekt.'),
      ),
    )

    const fehler = await fehlerVon(pinPruefen('9999'))

    expect(fehler.status).toBe(401)
    expect(fehler.code).toBe('PIN_FALSCH')
    expect(fehler.message).toBe('Die PIN ist nicht korrekt.')
  })

  test('reicht bei Sperre die Restwartezeit aus dem Rumpf durch', async () => {
    mockServer.use(
      http.post('*/auth/pin/pruefen', () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 58 Sekunden erneut versuchen.',
            wartesekunden: 58,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = await fehlerVon(pinPruefen('9999'))

    expect(fehler.code).toBe('PIN_GESPERRT')
    expect(fehler.wartesekunden).toBe(58)
  })
})

describe('sitzungLesen', () => {
  test('liefert die Sitzung des angemeldeten Besuchers', async () => {
    const sitzung = await sitzungLesen()
    expect(sitzung?.stage).toBe('PROFILE_AUTHENTICATED')
    expect(sitzung?.rolle).toBe('USER')
  })

  test('liefert bei 401 null, statt zu werfen', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    // „Keine Sitzung" ist der Normalzustand eines nicht angemeldeten
    // Besuchers und kein Fehlerfall.
    await expect(sitzungLesen()).resolves.toBeNull()
  })

  test('loest bei 401 keine globale Abmeldung aus', async () => {
    // Sonst liefe der Startaufruf jedes nicht angemeldeten Besuchers in die
    // Umleitung auf /anmelden – wo derselbe Aufruf wieder stattfindet.
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)

    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.'),
      ),
    )

    await sitzungLesen()
    expect(abmelden).not.toHaveBeenCalled()

    sitzungsendeBehandeln(() => {})
  })

  test('wirft bei jedem anderen Fehler weiter', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
      ),
    )

    await expect(sitzungLesen()).rejects.toThrow('Unerwarteter Fehler.')
  })

  test('setzt den Kopf fuer Hintergrundabrufe nur auf Verlangen', async () => {
    const koepfe: (string | null)[] = []
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        koepfe.push(request.headers.get('X-FuBo-Kein-Refresh'))
        return HttpResponse.json({ stage: 'PROFILE_AUTHENTICATED' })
      }),
    )

    await sitzungLesen()
    await sitzungLesen(true)

    expect(koepfe).toEqual([null, 'true'])
  })
})
