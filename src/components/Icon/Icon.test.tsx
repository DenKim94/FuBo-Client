import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import Icon from './Icon'

/** Sammelt alle .tsx-Dateien unterhalb eines Ordners. */
function tsxDateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((eintrag) => {
    const pfad = join(ordner, eintrag)
    if (statSync(pfad).isDirectory()) return tsxDateien(pfad)
    return pfad.endsWith('.tsx') && !pfad.endsWith('.test.tsx') ? [pfad] : []
  })
}

describe('Icon', () => {
  test('ist ohne Beschriftung schmueckend und fuer Screenreader verborgen', () => {
    render(<Icon name="info_circle_icon" />)
    expect(screen.getByTestId('icon-info_circle_icon')).toHaveAttribute('aria-hidden', 'true')
  })

  test('traegt mit Beschriftung Rolle und Namen eines Bildes', () => {
    render(<Icon name="warning_icon" beschriftung="Warnung" />)
    expect(screen.getByRole('img', { name: 'Warnung' })).toBeInTheDocument()
  })

  test('bettet die Symbole fuer Fehlermeldungen ein, statt sie nachzuladen', () => {
    // Ohne Verbindung scheitert der Abruf von /icons/…; eingebettet braucht
    // das Symbol keinen.
    render(<Icon name="error_circle_icon" />)
    const quelle = screen.getByTestId('icon-error_circle_icon').style.getPropertyValue('--icon-quelle')
    expect(quelle).toMatch(/^url\("data:image\/svg\+xml,/)
  })

  test('laedt alle uebrigen Symbole aus public/icons', () => {
    render(<Icon name="info_circle_icon" />)
    expect(screen.getByTestId('icon-info_circle_icon').style.getPropertyValue('--icon-quelle')).toBe(
      "url('/icons/info_circle_icon.svg')",
    )
  })

  test('jeder im Quellbaum benutzte Name liegt in public/icons', () => {
    // Eine Maske mit falschem Dateinamen verschwindet lautlos – ohne kaputtes
    // Bild, das den Fehler verraten wuerde.
    const namen = tsxDateien('src').flatMap((datei) =>
      [...readFileSync(datei, 'utf8').matchAll(/<Icon[^>]*\sname="([^"]+)"/g)].map((t) => t[1]),
    )
    expect(namen.length).toBeGreaterThan(0)
    const fehlend = namen.filter((name) => !existsSync(join('public/icons', `${name}.svg`)))
    expect(fehlend).toEqual([])
  })
})
