import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, test } from 'vitest'
import { useTerminParameter } from '@/hooks/useTerminParameter'

/** Rendert den Hook unter `/termine/:terminId` bzw. dem Hub `/`. */
function parameterFuer(pfad: string) {
  function Umgebung({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[pfad]}>
        <Routes>
          <Route path="/termine/:terminId" element={children} />
          <Route path="/" element={children} />
        </Routes>
      </MemoryRouter>
    )
  }
  return renderHook(() => useTerminParameter(), { wrapper: Umgebung }).result.current
}

describe('useTerminParameter', () => {
  test('liest eine gueltige Id als Zahl', () => {
    expect(parameterFuer('/termine/42')).toEqual({ vorhanden: true, gueltig: true, terminId: 42 })
  })

  test('meldet beim Hub ohne Parameter „nicht vorhanden“', () => {
    expect(parameterFuer('/')).toEqual({ vorhanden: false, gueltig: false, terminId: undefined })
  })

  test.each(['abc', '0', '-1', '1.5', '01', '1e3', '12abc', '99999999999999999999'])(
    'haelt %s fuer ungueltig: vorhanden, aber keine Id',
    (roh) => {
      expect(parameterFuer(`/termine/${roh}`)).toEqual({ vorhanden: true, gueltig: false, terminId: undefined })
    },
  )
})
