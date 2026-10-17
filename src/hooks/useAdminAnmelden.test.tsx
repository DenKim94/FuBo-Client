import { act, renderHook, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { schluessel } from '@/api/common/schluessel'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { useAdminAnmelden } from '@/hooks/useAdminAnmelden'
import { useSitzung } from '@/hooks/useSitzung'
import { beispielAdminSitzung, beispielPinSitzung, problem } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'

/** Ein Render: Stand der Mutation und der Rolle zum selben Zeitpunkt. */
type Momentaufnahme = { erfolg: boolean; istAdmin: boolean }

/** Rendert den Hook zusammen mit `useSitzung`, wie es die Anmeldeseite tut, und hält den Verlauf fest. */
function rendern() {
  const verlauf: Momentaufnahme[] = []
  const ergebnis = renderHook(
    () => {
      const werte = { anmeldung: useAdminAnmelden(), sitzung: useSitzung() }
      verlauf.push({ erfolg: werte.anmeldung.isSuccess, istAdmin: werte.sitzung.istAdmin })
      return werte
    },
    { wrapper: QueryUmgebung },
  )
  return { ...ergebnis, verlauf }
}

/** Bildet den Server ab: `PIN_VERIFIED` vor der Anmeldung, Adminsitzung danach. */
function serverMitAdminAnmeldung() {
  let angemeldet = false
  let gesendet: unknown
  mockServer.use(
    http.get('*/auth/session/lesen', () =>
      HttpResponse.json(angemeldet ? beispielAdminSitzung : beispielPinSitzung),
    ),
    http.post('*/auth/admin/anmelden', async ({ request }) => {
      gesendet = await request.json()
      angemeldet = true
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return { gesendet: () => gesendet }
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('useAdminAnmelden', () => {
  test('schickt Name und Passwort unveraendert ab', async () => {
    const server = serverMitAdminAnmeldung()
    const { result } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))

    await act(() =>
      result.current.anmeldung.mutateAsync({
        anmeldename: ' Beispieladmin ',
        passwort: ' beispiel-passwort-01 ',
      }),
    )

    // Kein Trimmen im Client: Randleerzeichen des Namens entfernt der Server,
    // die des Passworts gehoeren dazu.
    expect(server.gesendet()).toEqual({
      anmeldename: ' Beispieladmin ',
      passwort: ' beispiel-passwort-01 ',
    })
  })

  test('meldet Erfolg erst, wenn die Sitzung die Rolle ADMIN kennt', async () => {
    serverMitAdminAnmeldung()
    const { result, verlauf } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))
    expect(result.current.sitzung.istAdmin).toBe(false)

    act(() =>
      result.current.anmeldung.mutate({
        anmeldename: 'Beispieladmin',
        passwort: 'beispiel-passwort-01',
      }),
    )
    await waitFor(() => expect(result.current.anmeldung.isSuccess).toBe(true))

    expect(result.current.sitzung.istAdmin).toBe(true)
    // Kein Render, in dem die Mutation fertig ist, die Rolle aber noch fehlt:
    // Der Guard leitete sonst im falschen Moment weiter.
    expect(verlauf.filter((m) => m.erfolg && !m.istAdmin)).toEqual([])
  })

  test('entfernt bei Erfolg die Daten der vorigen Stufe', async () => {
    serverMitAdminAnmeldung()
    const { result } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))
    queryClient.setQueryData(schluessel.bilanz, { siege: 3 })

    await act(() =>
      result.current.anmeldung.mutateAsync({
        anmeldename: 'Beispieladmin',
        passwort: 'beispiel-passwort-01',
      }),
    )

    expect(queryClient.getQueryData(schluessel.bilanz)).toBeUndefined()
  })

  test('liefert bei falschen Angaben den ApiFehler und meldet kein Sitzungsende', async () => {
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json(beispielPinSitzung)),
      http.post('*/auth/admin/anmelden', () =>
        problem(401, 'ADMIN_PASSWORT_FALSCH', 'Anmeldename oder Passwort ist nicht korrekt.'),
      ),
    )
    const sitzungsende = vi.fn()
    sitzungsendeBehandeln(sitzungsende)
    const { result } = rendern()
    await waitFor(() => expect(result.current.sitzung.laedt).toBe(false))

    act(() => result.current.anmeldung.mutate({ anmeldename: 'Beispieladmin', passwort: 'falsch' }))
    await waitFor(() => expect(result.current.anmeldung.isError).toBe(true))

    const fehler = result.current.anmeldung.error
    expect(fehler).toBeInstanceOf(ApiFehler)
    expect((fehler as ApiFehler).code).toBe('ADMIN_PASSWORT_FALSCH')
    // Ein falsches Passwort ist ein Eingabefehler, kein Ablauf der PIN-Sitzung.
    expect(sitzungsende).not.toHaveBeenCalled()
  })

  test('wiederholt bei Sperre nicht und reicht die Wartezeit durch', async () => {
    let versuche = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json(beispielPinSitzung)),
      http.post('*/auth/admin/anmelden', () => {
        versuche += 1
        return HttpResponse.json(
          {
            type: 'about:blank',
            status: 429,
            code: 'PIN_GESPERRT',
            detail: 'Zu viele Fehlversuche. Bitte in 42 Sekunden erneut versuchen.',
            wartesekunden: 42,
          },
          { status: 429, headers: { 'Content-Type': 'application/problem+json' } },
        )
      }),
    )
    const { result } = rendern()

    act(() => result.current.anmeldung.mutate({ anmeldename: 'Beispieladmin', passwort: 'x' }))
    await waitFor(() => expect(result.current.anmeldung.isError).toBe(true))

    expect(versuche).toBe(1)
    expect((result.current.anmeldung.error as ApiFehler).wartesekunden).toBe(42)
  })
})
