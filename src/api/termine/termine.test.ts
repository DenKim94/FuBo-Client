import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { rueckmeldungSenden, terminLesen, termineLesen } from '@/api/termine/termine'
import { beispielModelle, beispielTermine } from '@/test/mocks/termine'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'

/** Fängt Kopf und Abfrageteil der nächsten Leseanfrage an einen Pfad ab. */
function lesenAbfangen(pfad: string) {
  const gefangen: { kopf: string | null; ab: string | null; url: string; aufrufe: number } = {
    kopf: 'nicht gelesen',
    ab: 'nicht gelesen',
    url: '',
    aufrufe: 0,
  }
  mockServer.use(
    http.get(pfad, ({ request }) => {
      gefangen.aufrufe += 1
      gefangen.kopf = request.headers.get('X-FuBo-Kein-Refresh')
      gefangen.ab = new URL(request.url).searchParams.get('ab')
      gefangen.url = request.url
      return HttpResponse.json(pfad.includes('terminId') ? {} : [])
    }),
  )
  return gefangen
}

describe('termineLesen', () => {
  test('liest die Liste ohne Stichtag und ohne Hintergrundkopf', async () => {
    const gefangen = lesenAbfangen('*/termine/lesen')
    await termineLesen()
    expect(gefangen.ab).toBeNull()
    expect(gefangen.kopf).toBeNull()
  })

  test('traegt den Kopf nur auf Wunsch', async () => {
    const gefangen = lesenAbfangen('*/termine/lesen')
    await termineLesen({ keinRefresh: true })
    expect(gefangen.kopf).toBe('true')
  })

  test('haengt den Stichtag als ab an den Pfad', async () => {
    const gefangen = lesenAbfangen('*/termine/lesen')
    await termineLesen({ ab: '2026-08-18' })
    expect(gefangen.ab).toBe('2026-08-18')
    expect(gefangen.url).toContain('/termine/lesen?ab=2026-08-18')
  })

  test('liefert die Liste in der Reihenfolge des Servers', async () => {
    await expect(termineLesen()).resolves.toEqual(beispielTermine)
  })
})

describe('terminLesen', () => {
  test('liest die Einzelansicht mit der Id im Pfad', async () => {
    const detail = await terminLesen(102)
    expect(detail.terminId).toBe(102)
    expect(detail.teilnehmerliste.teilnehmer).toHaveLength(beispielModelle[1].zusagen.length)
  })

  test('traegt den Kopf nur auf Wunsch', async () => {
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.get('*/termine/:terminId/lesen', ({ request }) => {
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return HttpResponse.json({})
      }),
    )
    await terminLesen(102)
    expect(kopf).toBeNull()
    await terminLesen(102, true)
    expect(kopf).toBe('true')
  })

  test('wirft bei unbekanntem Termin einen ApiFehler mit Code', async () => {
    const fehler = await terminLesen(999).catch((e: unknown) => e)
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).status).toBe(404)
    expect((fehler as ApiFehler).code).toBe('INHALT_NICHT_GEFUNDEN')
  })
})

describe('rueckmeldungSenden', () => {
  test('sendet Termin und Richtung, ohne Hintergrundkopf, und liefert nichts', async () => {
    let rumpf: unknown
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.post('*/termine/rueckmeldung', async ({ request }) => {
        rumpf = await request.json()
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )

    await expect(rueckmeldungSenden(102, true)).resolves.toBeUndefined()

    expect(rumpf).toEqual({ terminId: 102, zusage: true })
    // Eine Bedienung zaehlt als Aktivitaet und verlaengert die Sitzung.
    expect(kopf).toBeNull()
  })

  test('sendet eine Absage als zusage:false und nicht als fehlendes Feld', async () => {
    let rumpf: unknown
    mockServer.use(
      http.post('*/termine/rueckmeldung', async ({ request }) => {
        rumpf = await request.json()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await rueckmeldungSenden(102, false)
    expect(rumpf).toEqual({ terminId: 102, zusage: false })
  })

  test('wirft bei geschlossenem Termin einen ApiFehler mit Code', async () => {
    mockServer.use(
      http.post('*/termine/rueckmeldung', () => problem(409, 'TERMIN_GESCHLOSSEN', 'Der Termin ist geschlossen.')),
    )
    const fehler = await rueckmeldungSenden(102, true).catch((e: unknown) => e)
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('TERMIN_GESCHLOSSEN')
  })
})
