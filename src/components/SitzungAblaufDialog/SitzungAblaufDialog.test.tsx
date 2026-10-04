import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { queryClient, sitzungsendeBehandeln } from '@/app/queryClient'
import { problem, sitzungMitRest } from '@/test/mocks/handlers'
import { mockServer } from '@/test/mocks/server'
import { QueryUmgebung } from '@/test/QueryUmgebung'
import SitzungAblaufDialog from './SitzungAblaufDialog'

afterEach(() => {
  sitzungsendeBehandeln(() => {})
  queryClient.clear()
})

/**
 * jsdom rendert kein CSS und stubbt `showModal` (src/test/setup.ts): Geprüft wird
 * `dialog.open`. Fokusfalle und Escape im echten Browser prüft
 * `e2e/sitzung-ablauf.spec.ts`.
 */
function dialog(): HTMLDialogElement {
  return screen.getByTestId('sitzung-ablauf-dialog') as HTMLDialogElement
}

/** Antwortet mit einer Sitzung, deren Enden relativ zu jetzt liegen. */
function sitzungMit(leerlaufSek: number, obergrenzeSek: number) {
  mockServer.use(
    http.get('*/auth/session/lesen', () => HttpResponse.json(sitzungMitRest(leerlaufSek, obergrenzeSek))),
  )
}

/**
 * Wartet echte Zeit ab. In `act`, weil die Uhr der Komponente währenddessen
 * tickt; sonst meldet React Zustandsänderungen ausserhalb von `act`.
 */
async function warten(ms: number) {
  await act(() => new Promise<void>((fertig) => setTimeout(fertig, ms)))
}

function rendern() {
  return render(
    <QueryUmgebung>
      <SitzungAblaufDialog />
    </QueryUmgebung>,
  )
}

describe('SitzungAblaufDialog', () => {
  test('bleibt zu, solange das Ende fern ist', async () => {
    sitzungMit(600, 3600)
    rendern()

    // Abwarten, bis die Restlaufzeit da ist; erst dann sagt „zu" etwas aus.
    await warten(150)

    expect(dialog().open).toBe(false)
  })

  test('oeffnet zwei Minuten vor dem Ende mit Text und beiden Optionen', async () => {
    sitzungMit(90, 3600)
    rendern()

    await waitFor(() => expect(dialog().open).toBe(true))

    expect(screen.getByRole('dialog', { name: 'Sitzung läuft ab' })).toBe(dialog())
    expect(screen.getByTestId('sitzung-ablauf-text')).toHaveTextContent(
      'Deine Sitzung läuft gleich ab. Verlängere sie, um weiterzuarbeiten.',
    )
    // Keine Restzeit als Zahl: Der Balken ist die einzige Zeitanzeige.
    expect(screen.queryByTestId('sitzung-ablauf-restzeit')).not.toBeInTheDocument()
    expect(screen.getByTestId('sitzung-ablauf-balken')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('sitzung-ablauf-verlaengern')).toHaveTextContent('Sitzung verlängern')
    expect(screen.getByTestId('sitzung-ablauf-abmelden')).toHaveTextContent('Abmelden')
    expect(screen.queryByTestId('sitzung-ablauf-weiterarbeiten')).not.toBeInTheDocument()
  })

  test('beschreibt sich fuer Screenreader ueber den Text', async () => {
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    // Ohne die Beschreibung hoert man beim Oeffnen nur Titel und erste Schaltflaeche.
    const textId = screen.getByTestId('sitzung-ablauf-text').id
    expect(textId).not.toBe('')
    expect(dialog().getAttribute('aria-describedby')).toBe(textId)
  })

  test('zeigt den Rest der Warnzeit als Balken, der schrumpft', async () => {
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    /** Füllstand des Balkens in Prozent (CSS-Variable am Füllelement). */
    const anteil = () => {
      const fuellung = screen.getByTestId('sitzung-ablauf-balken').firstElementChild as HTMLElement
      return parseFloat(fuellung.style.getPropertyValue('--fuellung-anteil'))
    }
    const anfang = anteil()
    // 90 s von 120 s Warnzeit = 75 %
    expect(anfang).toBeGreaterThan(70)
    expect(anfang).toBeLessThanOrEqual(75)

    await waitFor(() => expect(anteil()).toBeLessThan(anfang), { timeout: 3000 })
  })

  test('haelt Escape ab, solange sich die Sitzung verlaengern laesst', async () => {
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    // Der Dialog verlangt eine Entscheidung; ein Escape beim Weitertippen
    // soll weder schliessen noch abmelden.
    const abbruch = new Event('cancel', { cancelable: true })
    fireEvent(dialog(), abbruch)

    expect(abbruch.defaultPrevented).toBe(true)
    expect(dialog().open).toBe(true)
  })

  test('verlaengert ueber den Server und schliesst auf Grund des neuen Standes', async () => {
    const user = userEvent.setup()
    let erneuert = false
    let kopf: string | null = 'nicht gelesen'
    mockServer.use(
      http.get('*/auth/session/lesen', () =>
        HttpResponse.json(erneuert ? sitzungMitRest(900, 3600) : sitzungMitRest(90, 3600)),
      ),
      http.post('*/auth/session/erneuern', ({ request }) => {
        erneuert = true
        kopf = request.headers.get('X-FuBo-Kein-Refresh')
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-verlaengern'))

    await waitFor(() => expect(dialog().open).toBe(false))
    expect(erneuert).toBe(true)
    // Eine Verlaengerung ist eine Nutzeraktion, kein Hintergrundaufruf.
    expect(kopf).toBeNull()
  })

  test('wechselt nach dem Verlaengern in den Fall „nicht mehr verlaengerbar", wenn die Obergrenze naht', async () => {
    const user = userEvent.setup()
    let erneuert = false
    mockServer.use(
      http.get('*/auth/session/lesen', () => {
        // Der Server klemmt das neue Ende auf die Obergrenze: beide gleich.
        if (erneuert) return HttpResponse.json(sitzungMitRest(100, 100))
        return HttpResponse.json(sitzungMitRest(90, 100))
      }),
      http.post('*/auth/session/erneuern', () => {
        erneuert = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-verlaengern'))

    // Statt eine Verlaengerung vorzutaeuschen, sagt der Dialog, wie es steht.
    await waitFor(() => expect(screen.queryByTestId('sitzung-ablauf-verlaengern')).not.toBeInTheDocument())
    expect(dialog().open).toBe(true)
    expect(screen.getByTestId('sitzung-ablauf-weiterarbeiten')).toBeInTheDocument()
  })

  test('meldet bei Fehlern den Servertext und bleibt offen', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.post('*/auth/session/erneuern', () =>
        problem(500, 'INTERNER_FEHLER', 'Unerwarteter Fehler.'),
      ),
    )
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-verlaengern'))

    expect(await screen.findByTestId('sitzung-ablauf-fehler')).toHaveTextContent('Unerwarteter Fehler.')
    expect(dialog().open).toBe(true)
    // Der Fehler ist keine Sackgasse: Beide Optionen bleiben bedienbar.
    expect(screen.getByTestId('sitzung-ablauf-verlaengern')).toBeEnabled()
    expect(screen.getByTestId('sitzung-ablauf-abmelden')).toBeEnabled()
  })

  test('sperrt beide Optionen, solange ein Aufruf laeuft', async () => {
    const user = userEvent.setup()
    let freigeben: () => void = () => {}
    mockServer.use(
      http.post('*/auth/session/erneuern', async () => {
        await new Promise<void>((fertig) => (freigeben = fertig))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-verlaengern'))

    // Kein Abmelden mitten in der Verlaengerung – die zwei Aufrufe wuerden einander kreuzen.
    await waitFor(() => expect(screen.getByTestId('sitzung-ablauf-abmelden')).toBeDisabled())
    expect(screen.getByTestId('sitzung-ablauf-verlaengern')).toBeDisabled()
    expect(screen.getByTestId('sitzung-ablauf-verlaengern')).toHaveAttribute('aria-busy', 'true')

    await act(async () => freigeben())
  })

  test('meldet ueber den Server ab und raeumt im Client auf', async () => {
    const user = userEvent.setup()
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    let beendet = false
    mockServer.use(
      http.post('*/auth/session/beenden', () => {
        beendet = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-abmelden'))

    await waitFor(() => expect(abmelden).toHaveBeenCalledOnce())
    expect(beendet).toBe(true)
  })

  test('bleibt bei einem Fehler der Abmeldung angemeldet und zeigt ihn', async () => {
    const user = userEvent.setup()
    const abmelden = vi.fn()
    sitzungsendeBehandeln(abmelden)
    mockServer.use(
      http.post('*/auth/session/beenden', () =>
        problem(500, 'INTERNER_FEHLER', 'Abmeldung nicht möglich.'),
      ),
    )
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-abmelden'))

    expect(await screen.findByTestId('sitzung-ablauf-fehler')).toHaveTextContent('Abmeldung nicht möglich.')
    expect(abmelden).not.toHaveBeenCalled()
    expect(dialog().open).toBe(true)
  })

  test('zeigt immer nur einen Fehler, den des zuletzt versuchten Aufrufs', async () => {
    const user = userEvent.setup()
    mockServer.use(
      http.post('*/auth/session/erneuern', () => problem(500, 'INTERNER_FEHLER', 'Verlängern gescheitert.')),
      http.post('*/auth/session/beenden', () => problem(500, 'INTERNER_FEHLER', 'Abmelden gescheitert.')),
    )
    sitzungMit(90, 3600)
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-verlaengern'))
    await screen.findByText('Verlängern gescheitert.')
    await user.click(screen.getByTestId('sitzung-ablauf-abmelden'))

    await screen.findByText('Abmelden gescheitert.')
    expect(screen.queryByText('Verlängern gescheitert.')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('sitzung-ablauf-fehler')).toHaveLength(1)
  })
})

describe('SitzungAblaufDialog an der harten Obergrenze', () => {
  /** Beide Enden gleich: Der Server hat das Leerlauf-Fenster auf die Obergrenze geklemmt. */
  function anDerObergrenze() {
    mockServer.use(
      http.get('*/auth/session/lesen', () => HttpResponse.json(sitzungMitRest(90, 90))),
    )
  }

  test('nennt den Fall ruhig und bietet keine wirkungslose Verlaengerung an', async () => {
    anDerObergrenze()
    rendern()

    await waitFor(() => expect(dialog().open).toBe(true))

    expect(screen.getByRole('dialog', { name: 'Sitzung endet bald' })).toBe(dialog())
    expect(screen.getByTestId('sitzung-ablauf-text')).toHaveTextContent('lässt sich nicht mehr verlängern')
    expect(screen.queryByTestId('sitzung-ablauf-verlaengern')).not.toBeInTheDocument()
    expect(screen.getByTestId('sitzung-ablauf-weiterarbeiten')).toHaveTextContent('Schließen')
    expect(screen.getByTestId('sitzung-ablauf-abmelden')).toBeInTheDocument()
    // Kein Fehler: Es ist der Normalfall einer langen Sitzung.
    expect(screen.queryByTestId('sitzung-ablauf-fehler')).not.toBeInTheDocument()
  })

  test('schliesst bei „Weiterarbeiten" und kommt nicht wieder', async () => {
    const user = userEvent.setup()
    anDerObergrenze()
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    await user.click(screen.getByTestId('sitzung-ablauf-weiterarbeiten'))
    expect(dialog().open).toBe(false)

    // Die Uhr tickt weiter und der Abruf kommt erneut; die Obergrenze wandert
    // nie, ein erneutes Oeffnen waere also nur Laerm.
    await warten(1300)
    expect(dialog().open).toBe(false)
  })

  test('zaehlt Escape als „Weiterarbeiten", hier ist nichts zu entscheiden', async () => {
    anDerObergrenze()
    rendern()
    await waitFor(() => expect(dialog().open).toBe(true))

    const abbruch = new Event('cancel', { cancelable: true })
    fireEvent(dialog(), abbruch)
    // Der Browser schliesst nach einem nicht abgewiesenen `cancel`.
    expect(abbruch.defaultPrevented).toBe(false)
    act(() => dialog().close())

    await warten(1300)
    expect(dialog().open).toBe(false)
  })
})
