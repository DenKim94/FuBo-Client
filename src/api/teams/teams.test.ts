import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { teamsGenerieren } from '@/api/teams/teams'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'

describe('teamsGenerieren', () => {
  test('sendet die Termin-Id im Koerper, ohne Hintergrundkopf, und liefert die Einteilung', async () => {
    const gefangen: { koerper: unknown; kopf: string | null; methode: string } = {
      koerper: null,
      kopf: 'nicht gelesen',
      methode: '',
    }
    mockServer.use(
      http.post('*/teams/generieren', async ({ request }) => {
        gefangen.koerper = await request.json()
        gefangen.kopf = request.headers.get('X-FuBo-Kein-Refresh')
        gefangen.methode = request.method
        return HttpResponse.json(
          { erzeugtAm: '2099-01-13T17:00:00Z', erzeugtVon: 'Beispielspieler 03', veraltet: false, teamA: [], teamB: [] },
          { status: 201 },
        )
      }),
    )

    const einteilung = await teamsGenerieren(102)

    expect(gefangen.methode).toBe('POST')
    expect(gefangen.koerper).toEqual({ terminId: 102 })
    // Eine Bedienung zaehlt als Aktivitaet und verlaengert die Sitzung.
    expect(gefangen.kopf).toBeNull()
    expect(einteilung.erzeugtVon).toBe('Beispielspieler 03')
  })

  test.each([
    ['TERMIN_GESCHLOSSEN'],
    ['TEAMS_FIXIERT'],
    ['ZU_WENIG_TEILNEHMER'],
    ['SKILLWERTE_UNVOLLSTAENDIG'],
    ['KONTINGENT_ERSCHOEPFT'],
    ['TEILNEHMER_GEAENDERT'],
  ] as const)('uebersetzt 409 %s in einen ApiFehler mit Code', async (code) => {
    mockServer.use(http.post('*/teams/generieren', () => problem(409, code, 'Text des Servers.')))

    const fehler = await teamsGenerieren(102).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(409)
    expect((fehler as ApiFehler).code).toBe(code)
    expect((fehler as ApiFehler).message).toBe('Text des Servers.')
  })

  test('uebersetzt 403 KEINE_ZUSAGE in einen fachlichen ApiFehler (keine Sitzungsfrage)', async () => {
    mockServer.use(
      http.post('*/teams/generieren', () =>
        problem(403, 'KEINE_ZUSAGE', 'Teams generieren darf nur, wer für diesen Termin zugesagt hat.'),
      ),
    )

    const fehler = await teamsGenerieren(102).catch((f: unknown) => f)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(403)
    expect((fehler as ApiFehler).code).toBe('KEINE_ZUSAGE')
    expect((fehler as ApiFehler).message).toBe('Teams generieren darf nur, wer für diesen Termin zugesagt hat.')
  })

  test('uebersetzt 404 in INHALT_NICHT_GEFUNDEN', async () => {
    mockServer.use(http.post('*/teams/generieren', () => problem(404, 'INHALT_NICHT_GEFUNDEN', 'Nicht gefunden.')))
    const fehler = await teamsGenerieren(999).catch((f: unknown) => f)
    expect((fehler as ApiFehler).code).toBe('INHALT_NICHT_GEFUNDEN')
  })
})
