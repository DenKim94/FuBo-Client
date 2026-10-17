import { act, render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { beispielSitzung } from '@/test/mocks/handlers'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { beispielBilanz } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import BilanzKarte from './BilanzKarte'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

function rendern() {
  render(<BilanzKarte />, { wrapper: QueryUmgebung })
}

describe('BilanzKarte', () => {
  test('zeigt Siege, Niederlagen und Unentschieden als Beschriftung mit Zahl', async () => {
    mockServer.use(http.get('*/bilanz/lesen', () => HttpResponse.json(beispielBilanz)))
    rendern()

    expect(await screen.findByTestId('bilanz-siege')).toHaveTextContent('3')
    expect(screen.getByTestId('bilanz-niederlagen')).toHaveTextContent('2')
    expect(screen.getByTestId('bilanz-unentschieden')).toHaveTextContent('1')
    // Die Beschriftung steht im Text, nicht in der Farbe.
    expect(screen.getByText('Siege')).toBeInTheDocument()
    expect(screen.getByText('Niederlagen')).toBeInTheDocument()
    expect(screen.queryByTestId('bilanz-leer')).not.toBeInTheDocument()
  })

  test('zeigt bei dreimal 0 „Noch keine Spiele gewertet.“ statt dreier Nullen', async () => {
    mockServer.use(http.get('*/bilanz/lesen', () => HttpResponse.json({ siege: 0, niederlagen: 0, unentschieden: 0 })))
    rendern()

    expect(await screen.findByTestId('bilanz-leer')).toHaveTextContent('Noch keine Spiele gewertet.')
    expect(screen.queryByTestId('bilanz-siege')).not.toBeInTheDocument()
  })

  test('zeigt einen einzelnen Zaehler mit 0, solange ein anderer groesser ist', async () => {
    mockServer.use(http.get('*/bilanz/lesen', () => HttpResponse.json({ siege: 0, niederlagen: 1, unentschieden: 0 })))
    rendern()

    expect(await screen.findByTestId('bilanz-siege')).toHaveTextContent('0')
    expect(screen.getByTestId('bilanz-niederlagen')).toHaveTextContent('1')
  })

  test('rendert fuer einen Gast nichts und ruft nichts ab', async () => {
    let abrufe = 0
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json({ ...beispielSitzung, rolle: 'GAST' })),
      http.get('*/bilanz/lesen', () => {
        abrufe += 1
        return HttpResponse.json(beispielBilanz)
      }),
    )
    rendern()

    await act(async () => {
      await new Promise((r) => setTimeout(r, 150))
    })
    expect(screen.queryByTestId('bilanz-karte')).not.toBeInTheDocument()
    expect(abrufe).toBe(0)
  })

  test('zeigt bei einem Serverfehler eine kleine Meldung und behaelt die Karte', async () => {
    mockServer.use(http.get('*/bilanz/lesen', () => problem(500, 'INTERNER_FEHLER', 'Interner Fehler.')))
    rendern()

    expect(await screen.findByTestId('bilanz-fehler', undefined, { timeout: 8000 })).toBeInTheDocument()
    expect(screen.getByTestId('bilanz-karte')).toBeInTheDocument()
  }, 15000)
})
