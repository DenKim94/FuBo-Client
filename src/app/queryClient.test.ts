import { afterEach, describe, expect, test, vi } from 'vitest'
import { ApiFehler } from '@/api/common/fehler'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'

/** Erzeugt eine Abfrage, die mit dem gewuenschten Status scheitert. */
function fehlschlagendeAbfrage(status: number, schluessel: string[]) {
  return queryClient.fetchQuery({
    queryKey: schluessel,
    queryFn: () => {
      throw new ApiFehler(status, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')
    },
  })
}

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

describe('globale 401-Behandlung', () => {
  test('leert den Cache und meldet das Sitzungsende', async () => {
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    queryClient.setQueryData(['daten-der-vorigen-sitzung'], { name: 'Beispielspieler 01' })

    await fehlschlagendeAbfrage(401, ['irgendetwas']).catch(() => {})

    expect(abmelden).toHaveBeenCalledOnce()
    // Ohne das Leeren saehe die naechste angemeldete Person kurz die Daten der
    // vorigen – auf einem Geraet, das am Spielfeldrand herumgereicht wird.
    expect(queryClient.getQueryData(['daten-der-vorigen-sitzung'])).toBeUndefined()
  })

  test('greift auch bei einer Mutation', async () => {
    // Schreibende Aktionen laufen nicht ueber den Query-Cache. Ohne die
    // Verdrahtung des MutationCache bliebe eine abgelaufene Sitzung genau dort
    // unbemerkt, wo der Nutzer gerade etwas eintraegt.
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)

    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: () => {
        throw new ApiFehler(401, 'SESSION_UNGUELTIG', 'Die Sitzung ist abgelaufen.')
      },
    })

    await mutation.execute(undefined).catch(() => {})

    expect(abmelden).toHaveBeenCalledOnce()
  })

  test('laesst einen 403 unberuehrt', async () => {
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)

    await fehlschlagendeAbfrage(403, ['verboten']).catch(() => {})

    // Ein 403 heisst „angemeldet, aber nicht berechtigt". Wer deswegen
    // abgemeldet wuerde, verlöre seine Sitzung an einer falschen Schaltflaeche.
    expect(abmelden).not.toHaveBeenCalled()
  })
})

describe('Wiederholungsregel', () => {
  test('wiederholt fachliche Ablehnungen nicht', async () => {
    const abfrage = vi.fn(() => {
      throw new ApiFehler(429, 'PIN_GESPERRT', 'Zu viele Fehlversuche.')
    })

    await queryClient
      .fetchQuery({ queryKey: ['gesperrt'], queryFn: abfrage, retryDelay: 0 })
      .catch(() => {})

    // Ein zweiter Versuch aendert nichts und verschaerft bei 429 die Sperre.
    expect(abfrage).toHaveBeenCalledTimes(1)
  })

  test('wiederholt einen Serverfehler genau einmal', async () => {
    const abfrage = vi.fn(() => {
      throw new ApiFehler(503, 'INTERNER_FEHLER', 'Dienst nicht verfuegbar.')
    })

    await queryClient
      .fetchQuery({ queryKey: ['serverfehler'], queryFn: abfrage, retryDelay: 0 })
      .catch(() => {})

    expect(abfrage).toHaveBeenCalledTimes(2)
  })
})
