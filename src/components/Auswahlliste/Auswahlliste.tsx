import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import Icon from '@/components/Icon/Icon'
import style from './Auswahlliste.module.scss'

/** Ein Eintrag der Auswahlliste. */
export type AuswahlOption = {
  /** Eindeutiger Wert, der bei der Auswahl gemeldet wird. */
  wert: string
  /** Haupttext des Eintrags. */
  text: string
  /** Zweite, kleinere Zeile, z. B. „bereits angemeldet". */
  zusatz?: string
  /** Nicht wählbar (A6); wird angezeigt, aber übersprungen. */
  deaktiviert?: boolean
}

/** Eigenschaften der Auswahlliste. */
type AuswahllisteEigenschaften = {
  /** Sichtbare Beschriftung; zugleich der Name für Screenreader. */
  beschriftung: string
  /** Die Einträge in Anzeigereihenfolge. */
  optionen: AuswahlOption[]
  /** Aktuell gewählter Wert; leer heisst „nichts gewählt". */
  wert: string
  /** Wird mit dem Wert eines wählbaren Eintrags aufgerufen. */
  beiAenderung: (wert: string) => void
  /** Text im geschlossenen Feld, solange nichts gewählt ist. */
  platzhalter?: string
  /** Dauerhafter Hilfetext unter dem Feld. */
  hinweis?: string
  /** Sperrt die ganze Liste, z. B. während eines Aufrufs. */
  deaktiviert?: boolean
  /** Test-ID des Auslösers; Einträge erhalten `<id>-option-<wert>`. */
  'data-testid'?: string
}

/**
 * Gestaltete Auswahlliste als „Select-only Combobox" (WAI-ARIA Authoring Practices).
 *
 * **Warum kein natives `<select>`:** Dessen aufgeklappte Liste zeichnet das
 * Betriebssystem; Farben und Schrift lassen sich dort nicht an das
 * Design-System anpassen (Entscheidung vom 03.10.2026, ersetzt C2 7.3).
 *
 * **Was dafür nachgebildet ist:**
 * - Rollen `combobox`/`listbox`/`option`, `aria-expanded`, `aria-selected`,
 *   `aria-disabled`. Der Fokus bleibt auf dem Auslöser; der hervorgehobene
 *   Eintrag wird über `aria-activedescendant` angesagt.
 * - Tastatur: Pfeiltasten, Pos1/Ende, Enter/Leertaste, Escape, Tab sowie
 *   Sprung per Anfangsbuchstabe. Deaktivierte Einträge werden übersprungen.
 * - Schliessen beim Tippen ausserhalb und beim Verlassen des Fokus.
 *
 * **Nicht wählbar heisst nicht nur grau:** Deaktivierte Einträge tragen ihren
 * Grund als zweite Zeile (`zusatz`), und der Screenreader hört ihn mit.
 */
export default function Auswahlliste({
  beschriftung,
  optionen,
  wert,
  beiAenderung,
  platzhalter = 'Bitte wählen',
  hinweis,
  deaktiviert = false,
  'data-testid': testId = 'auswahlliste',
}: AuswahllisteEigenschaften) {
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(-1)
  const behaelter = useRef<HTMLDivElement>(null)
  const liste = useRef<HTMLUListElement>(null)

  const id = useId()
  const beschriftungId = `${id}-beschriftung`
  const listeId = `${id}-liste`
  const hinweisId = `${id}-hinweis`
  const optionId = (index: number) => `${id}-option-${index}`

  const gewaehlt = optionen.find((o) => o.wert === wert)
  const waehlbar = optionen.flatMap((o, i) => (o.deaktiviert ? [] : [i]))
  // Beim Öffnen hervorgehoben: der gewählte Eintrag, sonst der erste wählbare.
  const gewaehltIndex = optionen.findIndex((o) => o.wert === wert && !o.deaktiviert)
  const startIndex = gewaehltIndex >= 0 ? gewaehltIndex : (waehlbar[0] ?? -1)

  // Schliesst die Liste bei einem Tipp ausserhalb – auf Touchgeräten verliert
  // der Auslöser dabei nicht zuverlässig den Fokus.
  useEffect(() => {
    if (!offen) return
    const ausserhalb = (ereignis: PointerEvent) => {
      if (!behaelter.current?.contains(ereignis.target as Node)) setOffen(false)
    }
    document.addEventListener('pointerdown', ausserhalb)
    return () => document.removeEventListener('pointerdown', ausserhalb)
  }, [offen])

  // Hält den hervorgehobenen Eintrag in einer langen Liste sichtbar.
  useEffect(() => {
    if (!offen || aktiv < 0) return
    const element = liste.current?.querySelector<HTMLElement>(`[data-index="${aktiv}"]`)
    element?.scrollIntoView?.({ block: 'nearest' })
  }, [offen, aktiv])

  /** Öffnet die Liste und hebt einen Eintrag hervor. */
  function oeffnen(start: number) {
    if (deaktiviert) return
    setOffen(true)
    setAktiv(start)
  }

  /** Übernimmt einen Eintrag, sofern er wählbar ist, und schliesst die Liste. */
  function uebernehmen(index: number) {
    const option = optionen[index]
    if (!option || option.deaktiviert) return
    beiAenderung(option.wert)
    setOffen(false)
  }

  /** Nächster wählbarer Eintrag in Richtung `schritt`, am Rand stehen bleibend. */
  function nachbar(von: number, schritt: 1 | -1): number {
    const position = waehlbar.indexOf(von)
    if (position === -1) return schritt === 1 ? (waehlbar[0] ?? -1) : (waehlbar.at(-1) ?? -1)
    return waehlbar[Math.min(Math.max(position + schritt, 0), waehlbar.length - 1)]
  }

  /** Erster wählbarer Eintrag nach `von`, dessen Text mit `zeichen` beginnt. */
  function perBuchstabe(zeichen: string, von: number): number {
    const kandidaten = [...waehlbar.filter((i) => i > von), ...waehlbar.filter((i) => i <= von)]
    return (
      kandidaten.find((i) => optionen[i].text.toLocaleLowerCase('de').startsWith(zeichen)) ?? -1
    )
  }

  /** Tastaturbedienung nach dem Muster der WAI-ARIA Authoring Practices. */
  function tasteGedrueckt(ereignis: KeyboardEvent<HTMLButtonElement>) {
    const taste = ereignis.key

    if (!offen) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(taste)) {
        ereignis.preventDefault()
        oeffnen(startIndex)
      } else if (taste === 'Home' || taste === 'End') {
        ereignis.preventDefault()
        oeffnen(taste === 'Home' ? (waehlbar[0] ?? -1) : (waehlbar.at(-1) ?? -1))
      } else if (taste.length === 1 && taste !== ' ') {
        const treffer = perBuchstabe(taste.toLocaleLowerCase('de'), startIndex)
        if (treffer >= 0) oeffnen(treffer)
      }
      return
    }

    switch (taste) {
      case 'ArrowDown':
      case 'ArrowUp':
        ereignis.preventDefault()
        setAktiv(nachbar(aktiv, taste === 'ArrowDown' ? 1 : -1))
        break
      case 'Home':
      case 'End':
        ereignis.preventDefault()
        setAktiv(taste === 'Home' ? (waehlbar[0] ?? -1) : (waehlbar.at(-1) ?? -1))
        break
      case 'Enter':
      case ' ':
        ereignis.preventDefault()
        uebernehmen(aktiv)
        break
      case 'Escape':
        ereignis.preventDefault()
        setOffen(false)
        break
      case 'Tab':
        // Den Fokus nicht festhalten; die Liste schliesst ohne Änderung.
        setOffen(false)
        break
      default:
        if (taste.length === 1) {
          const treffer = perBuchstabe(taste.toLocaleLowerCase('de'), aktiv)
          if (treffer >= 0) setAktiv(treffer)
        }
    }
  }

  return (
    <div className={style.auswahl} ref={behaelter}>
      <span className={style.beschriftung} id={beschriftungId}>
        {beschriftung}
      </span>
      <div className={style.rahmen}>
        <button
          type="button"
          role="combobox"
          className={[style.ausloeser, offen && style.offen].filter(Boolean).join(' ')}
          aria-labelledby={beschriftungId}
          aria-describedby={hinweis ? hinweisId : undefined}
          aria-haspopup="listbox"
          aria-expanded={offen}
          aria-controls={listeId}
          aria-activedescendant={offen && aktiv >= 0 ? optionId(aktiv) : undefined}
          disabled={deaktiviert}
          onClick={() => (offen ? setOffen(false) : oeffnen(startIndex))}
          onKeyDown={tasteGedrueckt}
          onBlur={(e) => {
            if (!behaelter.current?.contains(e.relatedTarget as Node | null)) setOffen(false)
          }}
          data-testid={testId}
        >
          <span className={gewaehlt ? style.wert : style.platzhalter}>
            {gewaehlt ? gewaehlt.text : platzhalter}
          </span>
          <span className={style.pfeil} aria-hidden="true" />
        </button>

        <ul
          ref={liste}
          id={listeId}
          role="listbox"
          aria-labelledby={beschriftungId}
          className={style.liste}
          hidden={!offen}
          // Der Fokus bleibt auf dem Auslöser; ohne das verlöre er ihn beim
          // Antippen eines Eintrags, und die Liste schlösse vor der Auswahl.
          onMouseDown={(e) => e.preventDefault()}
        >
          {optionen.map((option, index) => (
            <li
              key={option.wert}
              id={optionId(index)}
              role="option"
              aria-selected={option.wert === wert}
              aria-disabled={option.deaktiviert || undefined}
              aria-label={option.zusatz ? `${option.text}, ${option.zusatz}` : undefined}
              className={[
                style.option,
                index === aktiv && style.aktiv,
                option.wert === wert && style.gewaehlt,
                option.deaktiviert && style.gesperrt,
              ]
                .filter(Boolean)
                .join(' ')}
              data-index={index}
              onClick={() => uebernehmen(index)}
              onPointerMove={() => !option.deaktiviert && setAktiv(index)}
              data-testid={`${testId}-option-${option.wert}`}
            >
              <span className={style.optionTexte}>
                <span className={style.optionText}>{option.text}</span>
                {option.zusatz && <span className={style.zusatz}>{option.zusatz}</span>}
              </span>
              {option.wert === wert && <Icon name="check_icon" groesse={1.25} />}
            </li>
          ))}
        </ul>
      </div>
      {hinweis && (
        <p className={style.hinweis} id={hinweisId}>
          {hinweis}
        </p>
      )}
    </div>
  )
}
