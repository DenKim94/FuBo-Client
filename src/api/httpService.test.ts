import { HttpResponse, http } from 'msw'
import { describe, expect, test } from 'vitest'
import { ApiFehler } from '@/api/fehler'
import { aufrufen } from '@/api/httpService'
import { problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'

describe('aufrufen', () => {
  test('liefert den JSON-Rumpf einer erfolgreichen Antwort', async () => {
    const ergebnis = await aufrufen<{ stage: string }>('GET', '/auth/session/lesen')
    expect(ergebnis.stage).toBe('PROFILE_AUTHENTICATED')
  })

  test('liefert bei 204 undefined, statt am leeren Rumpf zu scheitern', async () => {
    // Der Fall betrifft 23 der 44 Operationen; ein `json()` wuerfe hier
    // `SyntaxError: Unexpected end of JSON input`.
    await expect(aufrufen<void>('POST', '/auth/pin/pruefen', { body: { pin: '0000' } }))
      .resolves.toBeUndefined()
  })

  test('uebersetzt ein ProblemDetail in einen ApiFehler', async () => {
    const fehler = await aufrufen('POST', '/termine/rueckmeldung', { body: {} }).catch(
      (f: unknown) => f,
    )

    expect(fehler).toBeInstanceOf(ApiFehler)
    const apiFehler = fehler as ApiFehler
    expect(apiFehler.status).toBe(409)
    // Die Programmlogik verzweigt ueber `code`, nicht ueber den Text.
    expect(apiFehler.code).toBe('TERMIN_GESCHLOSSEN')
    expect(apiFehler.message).toBe('Der Termin ist geschlossen.')
  })

  test('liest die Restwartezeit bei 429 aus dem Rumpf', async () => {
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

    const fehler = (await aufrufen('POST', '/auth/pin/pruefen', { body: { pin: '0000' } }).catch(
      (f: unknown) => f,
    )) as ApiFehler

    expect(fehler.wartesekunden).toBe(58)
  })

  test('meldet UNBEKANNT, wenn die Antwort kein JSON traegt', async () => {
    // Etwas vor dem Server hat geantwortet: Proxy-Fehlerseite statt Vertrag.
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.text('<html>502</html>', { status: 502 }),
      ),
    )

    const fehler = (await aufrufen('GET', '/auth/session/lesen').catch(
      (f: unknown) => f,
    )) as ApiFehler

    expect(fehler).toBeInstanceOf(ApiFehler)
    expect(fehler.status).toBe(502)
    expect(fehler.code).toBe('UNBEKANNT')
  })

  test('sendet das Sitzungscookie mit und setzt keinen Refresh-Kopf ohne Anlass', async () => {
    let gesehen: Request | undefined
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        gesehen = request
        return HttpResponse.json({})
      }),
    )

    await aufrufen('GET', '/auth/session/lesen')

    // Ohne `include` ginge das HttpOnly-Cookie nicht mit, und jeder Aufruf
    // antwortete mit 401.
    expect(gesehen?.credentials).toBe('include')
    expect(gesehen?.headers.get('X-FuBo-Kein-Refresh')).toBeNull()
  })

  test('setzt X-FuBo-Kein-Refresh nur bei Hintergrundaufrufen', async () => {
    let gesehen: Request | undefined
    mockServer.use(
      http.get('*/auth/session/lesen', ({ request }) => {
        gesehen = request
        return HttpResponse.json({})
      }),
    )

    await aufrufen('GET', '/auth/session/lesen', { keinRefresh: true })

    // Ohne den Kopf liefe das gleitende Sitzungsfenster nie ab, solange ein
    // Browser-Tab offen ist – der Countdown aus C3 zaehlte nie zu Ende.
    expect(gesehen?.headers.get('X-FuBo-Kein-Refresh')).toBe('true')
  })

  test('sendet einen Rumpf nur, wenn einer angegeben ist', async () => {
    let mitRumpf: string | null = null
    let ohneRumpf: string | null = null

    mockServer.use(
      http.post('*/auth/pin/pruefen', async ({ request }) => {
        mitRumpf = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await aufrufen<void>('POST', '/auth/pin/pruefen', { body: { pin: '1234' } })

    mockServer.use(
      http.post('*/auth/session/beenden', ({ request }) => {
        ohneRumpf = request.headers.get('Content-Type')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await aufrufen<void>('POST', '/auth/session/beenden')

    expect(mitRumpf).toBe('application/json')
    expect(ohneRumpf).toBeNull()
  })

  test('reicht einen Netzfehler unveraendert durch', async () => {
    mockServer.use(http.get('*/auth/session/lesen', () => HttpResponse.error()))

    // Kein ApiFehler: Es gab keine Antwort, die zu uebersetzen waere. Die
    // Unterscheidung traegt der Offline-Hinweis.
    const fehler = await aufrufen('GET', '/auth/session/lesen').catch((f: unknown) => f)
    expect(fehler).toBeInstanceOf(TypeError)
    expect(fehler).not.toBeInstanceOf(ApiFehler)
  })

  test('faellt auf UNBEKANNT zurueck, wenn die Antwort keinen code traegt', async () => {
    // Der Kontrakt haelt fest, dass die Liste der Fehlercodes waechst; ein
    // fehlender oder unbekannter Wert ist wie ein allgemeiner Fehler zu
    // behandeln und darf die Anzeige nicht verhindern.
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.json(
          { type: 'about:blank', status: 500, detail: 'Unerwarteter Fehler.' },
          { status: 500, headers: { 'Content-Type': 'application/problem+json' } },
        ),
      ),
    )

    const fehler = (await aufrufen('GET', '/auth/session/lesen').catch(
      (f: unknown) => f,
    )) as ApiFehler

    expect(fehler.code).toBe('UNBEKANNT')
    expect(fehler.message).toBe('Unerwarteter Fehler.')
  })

  test('nutzt den Anzeigetext des Servers, ohne ihn zu ersetzen', async () => {
    // Keine Uebersetzungstabelle im Frontend: Der Server liefert `detail`
    // bereits deutschsprachig und oft genauer, als der Client formulieren
    // koennte. Zwei Orte fuer denselben Text liefen auseinander.
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        problem(403, 'KEINE_BERECHTIGUNG', 'Dieser Bereich ist nur fuer Administratoren.'),
      ),
    )

    const fehler = (await aufrufen('GET', '/auth/session/lesen').catch(
      (f: unknown) => f,
    )) as ApiFehler

    expect(fehler.message).toBe('Dieser Bereich ist nur fuer Administratoren.')
  })
})
