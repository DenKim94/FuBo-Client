import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import {
  profileLesen,
  skillKategorienLesen,
  spielerAnlegen,
  spielerBearbeiten,
  spielerBlockieren,
  spielerEntfernen,
} from '@/api/admin/adminProfile'
import { ApiFehler } from '@/api/common/fehler'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

/** Hält Methode, Körper und Kopf `X-FuBo-Kein-Refresh` eines Aufrufs fest. */
function aufzeichnen(pfad: string, status: number, antwort?: unknown) {
  const sicht: { methode?: string; rumpf?: unknown; kopf?: string | null } = {}
  mockServer.use(
    http.all(`*${pfad}`, async ({ request }) => {
      sicht.methode = request.method
      sicht.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      sicht.rumpf = request.method === 'GET' ? undefined : await request.json()
      return antwort === undefined ? new HttpResponse(null, { status }) : HttpResponse.json(antwort, { status })
    }),
  )
  return sicht
}

describe('Lesen', () => {
  test('profileLesen ruft GET /admin/user/lesen ohne Hintergrundkopf', async () => {
    const sicht = aufzeichnen('/admin/user/lesen', 200, [])

    await expect(profileLesen()).resolves.toEqual([])

    expect(sicht.methode).toBe('GET')
    expect(sicht.kopf).toBeNull()
  })

  test('skillKategorienLesen ruft GET /admin/skills/lesen ohne Hintergrundkopf', async () => {
    const sicht = aufzeichnen('/admin/skills/lesen', 200, [])

    await expect(skillKategorienLesen()).resolves.toEqual([])

    expect(sicht.methode).toBe('GET')
    expect(sicht.kopf).toBeNull()
  })
})

describe('Schreiben', () => {
  test('spielerAnlegen sendet Name und alle Skills und liefert den Rumpf der 201', async () => {
    const sicht = aufzeichnen('/admin/user/anlegen', 201, { spielerId: 9, name: 'Beispielspieler 09' })

    const angelegt = await spielerAnlegen({ name: 'Beispielspieler 09', skills: { A: 3, B: 2 } })

    expect(angelegt).toEqual({ spielerId: 9, name: 'Beispielspieler 09' })
    expect(sicht.methode).toBe('POST')
    expect(sicht.rumpf).toEqual({ name: 'Beispielspieler 09', skills: { A: 3, B: 2 } })
    expect(sicht.kopf).toBeNull()
  })

  test('spielerBearbeiten sendet nur, was übergeben wurde', async () => {
    const sicht = aufzeichnen('/admin/user/bearbeiten', 204)

    await expect(spielerBearbeiten({ spielerId: 4, skills: { A: 1 } })).resolves.toBeUndefined()

    expect(sicht.rumpf).toEqual({ spielerId: 4, skills: { A: 1 } })
    expect(sicht.kopf).toBeNull()
  })

  test('spielerBlockieren sendet Id und Richtung', async () => {
    const sicht = aufzeichnen('/admin/user/blockieren', 204)

    await spielerBlockieren(4, true)
    expect(sicht.rumpf).toEqual({ spielerId: 4, blockieren: true })
    await spielerBlockieren(4, false)
    expect(sicht.rumpf).toEqual({ spielerId: 4, blockieren: false })
    expect(sicht.kopf).toBeNull()
  })

  test('spielerEntfernen sendet nur die Id', async () => {
    const sicht = aufzeichnen('/admin/user/entfernen', 204)

    await spielerEntfernen(4)

    expect(sicht.rumpf).toEqual({ spielerId: 4 })
    expect(sicht.kopf).toBeNull()
  })

  test('wirft bei einem Konflikt einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/admin/user/entfernen', () =>
        problem(409, 'PROFIL_IN_VERWENDUNG', 'Das Profil hat noch Daten.'),
      ),
    )

    const fehler = await spielerEntfernen(4).catch((e: unknown) => e)

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('PROFIL_IN_VERWENDUNG')
  })
})
