import { describe, expect, test } from 'vitest'
import indexHtml from '../../index.html?raw'

describe('Ladeanzeige in index.html', () => {
  test('steht schon im ersten Bild in #root und meldet den Ladezustand', () => {
    // Vor dem ersten Rendern von React ist #root sonst eine weisse Flaeche.
    const dokument = new DOMParser().parseFromString(indexHtml, 'text/html')
    const anzeige = dokument.querySelector('#root > .startLader')

    // Kein jest-dom hier: Ein per `DOMParser` gelesenes Dokument hat kein `window`, die Matcher lehnen seine Elemente ab.
    expect(anzeige).not.toBeNull()
    expect(anzeige?.getAttribute('role')).toBe('status')
    expect(anzeige?.textContent).toContain('Wird geladen')
    expect(anzeige?.querySelector('.startLaderKreis')).not.toBeNull()
  })
})
