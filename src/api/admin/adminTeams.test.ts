import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { teamsManuellGenerieren } from '@/api/admin/adminTeams'
import { ApiFehler } from '@/api/common/fehler'
import type { components } from '@/api/common/types/schema'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'

const EINTEILUNG = {
  algorithmType: 'HEURISTIK',
  auswechselModus: 'SCHWAECHSTER_UEBERZAHL',
  auswechselspieler: null,
  differenzTeamstaerke: 0.75,
  teamA: [{ anzeigeName: 'Beispielspieler 01', gast: false, auswechselspieler: false }],
  teamB: [{ anzeigeName: 'Gast 1', gast: true, auswechselspieler: false }],
}

describe('teamsManuellGenerieren', () => {
  test('sendet POST mit dem Körper unverändert, ohne Hintergrundkopf, und liefert den Rumpf', async () => {
    const sicht: { methode?: string; rumpf?: unknown; kopf?: string | null } = {}
    mockServer.use(
      http.post('*/admin/teams/generieren', async ({ request }) => {
        sicht.methode = request.method
        sicht.kopf = request.headers.get('X-FuBo-Kein-Refresh')
        sicht.rumpf = await request.json()
        return HttpResponse.json(EINTEILUNG)
      }),
    )

    const ergebnis = await teamsManuellGenerieren({ spielerIds: [1], gaeste: [{ name: 'Beispielgast', stufe: 'STARK' }] })

    expect(ergebnis).toEqual(EINTEILUNG)
    expect(sicht.methode).toBe('POST')
    // Der Lauf ist eine Bedienung und hält die Sitzung offen.
    expect(sicht.kopf).toBeNull()
    expect(sicht.rumpf).toEqual({ spielerIds: [1], gaeste: [{ name: 'Beispielgast', stufe: 'STARK' }] })
  })

  test('reicht einen fehlenden Teil des Körpers nicht auf, sondern lässt ihn weg', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/admin/teams/generieren', async ({ request }) => {
        rumpf = await request.json()
        return HttpResponse.json(EINTEILUNG)
      }),
    )

    await teamsManuellGenerieren({ gaeste: [{ stufe: 'MITTEL' }] })

    expect(rumpf).toEqual({ gaeste: [{ stufe: 'MITTEL' }] })
  })

  test.each<[number, components['schemas']['Fehlercode'], string]>([
    [409, 'ZU_WENIG_TEILNEHMER', 'Es braucht mindestens 6 Teilnehmer.'],
    [409, 'SKILLWERTE_UNVOLLSTAENDIG', 'Die Skillwerte von Beispielspieler 04 sind unvollständig.'],
    [409, 'PROFIL_GESCHUETZT', 'Das Adminprofil kann nicht eingeteilt werden.'],
    [400, 'EINGABE_UNGUELTIG', 'Das Profil 2 ist unbekannt oder gesperrt.'],
  ])('übernimmt Status %i, Code %s und den Text des Servers', async (status, code, detail) => {
    mockServer.use(http.post('*/admin/teams/generieren', () => problem(status, code, detail)))

    const fehler = await teamsManuellGenerieren({ spielerIds: [1] }).catch((e: unknown) => e)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler).toMatchObject({ status, code, message: detail })
  })
})
