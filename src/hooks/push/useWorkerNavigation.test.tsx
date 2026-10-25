import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { geraet, geraetZuruecksetzen } from '@/test/pushGeraetAttrappe'
import { useWorkerNavigation } from './useWorkerNavigation'

vi.mock('@/pwa/pushGeraet', async (original) =>
  (await import('@/test/pushGeraetAttrappe')).geraetModul(await original()),
)

beforeEach(() => geraetZuruecksetzen())

const rahmen = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={['/']}>{children}</MemoryRouter>

describe('useWorkerNavigation', () => {
  test('navigiert auf die Nachricht des Workers und meldet sich beim Aushängen ab', () => {
    const { result, unmount } = renderHook(
      () => {
        useWorkerNavigation()
        return useLocation().pathname
      },
      { wrapper: rahmen },
    )
    expect(geraet.navigationsHoerer).toHaveLength(1)
    act(() => geraet.navigationsHoerer[0]('/termine/42'))
    expect(result.current).toBe('/termine/42')
    unmount()
    expect(geraet.navigationsHoerer).toHaveLength(0)
  })
})
