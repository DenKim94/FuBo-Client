import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test } from 'vitest'
import { queryClient } from '@/app/queryClient'
import { adminHandler, adminWelt, beispielGastplaetze, gastPlatz } from '@/test/mocks/admin'
import { problem } from '@/test/mocks/problem'
import { mockServer } from '@/test/mocks/server'
import { terminHandlers } from '@/test/mocks/termine'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import AdminGaeste from './AdminGaeste'

afterEach(() => {
  queryClient.clear()
})

function rendern(gastplaetze = beispielGastplaetze()) {
  const welt = adminWelt({ gastplaetze })
  // Erst die Admin-Handler, dann die Termine (MSW nimmt den ersten passenden).
  mockServer.use(...adminHandler(welt), ...terminHandlers(welt.termine).handlers)
  render(
    <QueryUmgebung>
      <MemoryRouter>
        <AdminGaeste />
      </MemoryRouter>
    </QueryUmgebung>,
  )
  return welt
}

/** Platz 1 lebt, Platz 2 ist verwaist (Beispieldaten). */
describe('AdminGaeste – Anzeige', () => {
  test('zeigt Überschrift, Zusammenfassung und nur die belegten Plätze', async () => {
    const welt = rendern()

    expect(await screen.findByRole('heading', { level: 1, name: 'Gäste' })).toBeInTheDocument()
    expect(screen.getByTestId('admin-gaeste-zusammenfassung')).toHaveTextContent('2 von 4 Plätzen belegt')
    expect(screen.getByTestId('admin-gast-1')).toBeInTheDocument()
    expect(screen.getByTestId('admin-gast-2')).toBeInTheDocument()
    expect(screen.queryByTestId('admin-gast-3')).not.toBeInTheDocument()
    expect(screen.queryByTestId('admin-gast-4')).not.toBeInTheDocument()
    // Lesen im Admin: ohne Kopf, ohne Polling.
    expect(welt.protokoll.gaesteAbrufe).toEqual([null])
  })

  test('je Platz: Name, Stufe als Text, Zustand als Text', async () => {
    rendern()

    const lebend = await screen.findByTestId('admin-gast-1')
    expect(within(lebend).getByRole('heading', { level: 3, name: 'Platz 1' })).toBeInTheDocument()
    expect(within(lebend).getByTestId('admin-gast-name-1')).toHaveTextContent('Beispielgast')
    expect(lebend).toHaveTextContent('Stufe: Stark')
    expect(within(lebend).getByTestId('admin-gast-zustand-1')).toHaveTextContent('angemeldet')

    const verwaist = screen.getByTestId('admin-gast-2')
    expect(verwaist).toHaveTextContent('Stufe: Schwach')
    expect(within(verwaist).getByTestId('admin-gast-zustand-2')).toHaveTextContent('Sitzung abgelaufen')
  })

  test('ein belegter unwirksamer Platz erscheint mit Vermerk und zählt nicht in „n von m“', async () => {
    rendern([
      ...beispielGastplaetze(),
      gastPlatz({
        nummer: 5,
        wirksam: false,
        belegt: true,
        belegtSeit: '2099-01-12T18:00:00Z',
        gastName: 'Beispielgast Fünf',
        gastStufe: 'MITTEL',
        sitzungGueltig: true,
      }),
    ])

    expect(await screen.findByTestId('admin-gast-unwirksam-5')).toHaveTextContent('wird nicht mehr vergeben')
    expect(screen.getByTestId('admin-gaeste-zusammenfassung')).toHaveTextContent('2 von 4 Plätzen belegt')
    expect(screen.queryByTestId('admin-gast-unwirksam-1')).not.toBeInTheDocument()
  })

  test('ohne belegten Platz erscheint der Leerzustand', async () => {
    rendern([gastPlatz({ nummer: 1 }), gastPlatz({ nummer: 2 })])

    expect(await screen.findByTestId('admin-gaeste-leer')).toHaveTextContent('Zurzeit ist kein Gast angemeldet.')
    expect(screen.getByTestId('admin-gaeste-zusammenfassung')).toHaveTextContent('0 von 2 Plätzen belegt')
    expect(screen.queryByTestId('admin-gaeste-verwaiste')).not.toBeInTheDocument()
  })

  test('zwei Abschnitte: „Gäste in Terminen“ vor „Gastplätze“; der Text erklärt, dass Zusagen das Abmelden überdauern', async () => {
    rendern()

    await screen.findByTestId('admin-gaeste-zusammenfassung')
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Gäste in Terminen', 'Gastplätze'])
    expect(screen.getByTestId('admin-gaeste-plaetze')).toHaveTextContent('seine Zusagen bleiben bestehen')
  })

  test('ein Fehler beim Laden zeigt den Fehlerzustand mit „Erneut versuchen“', async () => {
    const welt = adminWelt()
    let ausfall = true
    mockServer.use(
      http.get('*/admin/gast/lesen', () => (ausfall ? problem(500, 'INTERNER_FEHLER', 'Interner Fehler.') : undefined)),
      ...adminHandler(welt),
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminGaeste />
        </MemoryRouter>
      </QueryUmgebung>,
    )

    const erneut = await screen.findByTestId('admin-gaeste-laden-fehler-erneut', {}, { timeout: 4000 })
    ausfall = false
    fireEvent.click(erneut)

    expect(await screen.findByTestId('admin-gaeste')).toBeInTheDocument()
  })

  test('„Aktualisieren“ liest neu (zweiter Abruf, weiterhin ohne Kopf)', async () => {
    const welt = rendern()
    await screen.findByTestId('admin-gast-1')

    welt.gastplaetze = welt.gastplaetze.map((p) => (p.nummer === 3 ? gastPlatz({ ...p, belegt: true, gastName: 'Beispielgast Drei', gastStufe: 'MITTEL', sitzungGueltig: true, belegtSeit: '2099-01-13T18:30:00Z' }) : p))
    fireEvent.click(screen.getByTestId('admin-gaeste-aktualisieren'))

    expect(await screen.findByTestId('admin-gast-3')).toBeInTheDocument()
    expect(welt.protokoll.gaesteAbrufe).toEqual([null, null])
  })
})

describe('AdminGaeste – Freigeben', () => {
  test('bei lebender Sitzung fragt ein Dialog und nennt, dass der Gast abgemeldet wird', async () => {
    const welt = rendern()

    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-1'))

    const dialog = await screen.findByTestId('admin-gaeste-freigeben-dialog')
    expect(dialog).toHaveTextContent('Beispielgast wird sofort abgemeldet')
    expect(welt.protokoll.gaesteFreigegeben).toEqual([])
  })

  test('Abbrechen sendet nichts', async () => {
    const welt = rendern()
    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-1'))

    fireEvent.click(await screen.findByTestId('admin-gaeste-freigeben-dialog-abbrechen'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-gaeste-freigeben-dialog-bestaetigen')).not.toBeVisible()
    })
    expect(welt.protokoll.gaesteFreigegeben).toEqual([])
    expect(screen.getByTestId('admin-gast-1')).toBeInTheDocument()
  })

  test('Bestätigen sendet genau diese slotIds, der Platz verschwindet aus der Liste, die Meldung steht da', async () => {
    const welt = rendern()
    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-1'))

    fireEvent.click(await screen.findByTestId('admin-gaeste-freigeben-dialog-bestaetigen'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-gast-1')).not.toBeInTheDocument()
    })
    expect(welt.protokoll.gaesteFreigegeben).toEqual([{ slotIds: [1] }])
    expect(screen.getByTestId('admin-gaeste-hinweis')).toHaveTextContent('Platz 1 ist wieder frei.')
    expect(screen.getByTestId('admin-gaeste-zusammenfassung')).toHaveTextContent('1 von 4 Plätzen belegt')
    // Der Fokus liegt nicht auf body, sondern auf der Überschrift.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Gäste' })).toHaveFocus()
    })
  })

  test('ein verwaister Platz wird ohne Dialog freigegeben', async () => {
    const welt = rendern()

    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-2'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-gast-2')).not.toBeInTheDocument()
    })
    expect(welt.protokoll.gaesteFreigegeben).toEqual([{ slotIds: [2] }])
    expect(screen.queryByTestId('admin-gaeste-freigeben-dialog-bestaetigen')).not.toBeVisible()
  })

  test('„Verwaiste freigeben (n)“ sendet die slotIds der verwaisten Plätze, nie „alle“, und lässt lebende unberührt', async () => {
    const welt = rendern()

    fireEvent.click(await screen.findByTestId('admin-gaeste-verwaiste'))

    await waitFor(() => {
      expect(screen.queryByTestId('admin-gast-2')).not.toBeInTheDocument()
    })
    expect(welt.protokoll.gaesteFreigegeben).toEqual([{ slotIds: [2] }])
    expect(welt.protokoll.gaesteFreigegeben[0]).not.toHaveProperty('alle')
    expect(screen.getByTestId('admin-gast-1')).toBeInTheDocument()
    // Keine verwaisten mehr: Die Schaltfläche verschwindet.
    expect(screen.queryByTestId('admin-gaeste-verwaiste')).not.toBeInTheDocument()
  })

  test('die Schaltfläche trägt die Zahl der verwaisten Plätze', async () => {
    rendern([
      ...beispielGastplaetze(),
      gastPlatz({ nummer: 5, belegt: true, gastName: 'Beispielgast Fünf', gastStufe: 'MITTEL', sitzungGueltig: false, belegtSeit: '2099-01-10T18:00:00Z' }),
    ])

    expect(await screen.findByTestId('admin-gaeste-verwaiste')).toHaveTextContent('Verwaiste freigeben (2)')
  })

  test('ohne verwaiste Plätze gibt es die Schaltfläche nicht, und es gibt nie „Alle freigeben“', async () => {
    rendern([beispielGastplaetze()[0], gastPlatz({ nummer: 2 })])
    await screen.findByTestId('admin-gast-1')

    expect(screen.queryByTestId('admin-gaeste-verwaiste')).not.toBeInTheDocument()
    expect(screen.queryByText(/alle freigeben/i)).not.toBeInTheDocument()
  })

  test('ein Fehler beim Freigeben steht im Dialog, der Dialog bleibt offen', async () => {
    const welt = adminWelt({ gastplaetze: beispielGastplaetze() })
    mockServer.use(
      http.post('*/admin/gast/freigeben', () => problem(400, 'EINGABE_UNGUELTIG', 'Unbekannte Platznummer: 1.')),
      ...adminHandler(welt),
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminGaeste />
        </MemoryRouter>
      </QueryUmgebung>,
    )
    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-1'))

    fireEvent.click(await screen.findByTestId('admin-gaeste-freigeben-dialog-bestaetigen'))

    expect(await screen.findByTestId('admin-gaeste-freigeben-dialog-fehler')).toHaveTextContent('Unbekannte Platznummer')
    expect(screen.getByTestId('admin-gast-1')).toBeInTheDocument()
  })

  test('ein Fehler bei einem verwaisten Platz (ohne Dialog) steht über der Liste', async () => {
    const welt = adminWelt({ gastplaetze: beispielGastplaetze() })
    mockServer.use(
      http.post('*/admin/gast/freigeben', () => problem(400, 'EINGABE_UNGUELTIG', 'Unbekannte Platznummer: 2.')),
      ...adminHandler(welt),
    )
    render(
      <QueryUmgebung>
        <MemoryRouter>
          <AdminGaeste />
        </MemoryRouter>
      </QueryUmgebung>,
    )

    fireEvent.click(await screen.findByTestId('admin-gast-freigeben-2'))

    expect(await screen.findByTestId('admin-gaeste-fehler')).toHaveTextContent('Unbekannte Platznummer')
    expect(screen.getByTestId('admin-gast-2')).toBeInTheDocument()
  })
})
