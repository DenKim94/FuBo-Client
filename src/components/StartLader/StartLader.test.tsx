import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import indexHtml from '../../../index.html?raw'
import StartLader from './StartLader'

describe('StartLader', () => {
  test('meldet den Ladezustand wie die Anzeige in index.html', () => {
    render(<StartLader />)
    const anzeige = screen.getByRole('status')
    expect(anzeige).toHaveTextContent('Wird geladen')
    expect(anzeige).toHaveClass('startLader')
    expect(anzeige.querySelector('.startLaderKreis')).not.toBeNull()
  })

  test('hat denselben Aufbau wie die Anzeige in index.html (kein Bildwechsel beim Start)', () => {
    const dokument = new DOMParser().parseFromString(indexHtml, 'text/html')
    const vorlage = dokument.querySelector('#root > .startLader')
    const { container } = render(<StartLader />)
    const klassen = (wurzel: Element | null) => [...(wurzel?.querySelectorAll('*') ?? [])].map((e) => e.className)
    expect(klassen(container.firstElementChild)).toEqual(klassen(vorlage))
  })
})
