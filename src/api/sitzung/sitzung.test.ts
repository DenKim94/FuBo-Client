import { HttpResponse, http } from 'msw'
import { describe, expect, test, vi } from 'vitest'
import { sitzungLesen } from '@/api/sitzung/sitzung'
import { sitzungsendeBehandeln } from '@/app/queryClient'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

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
