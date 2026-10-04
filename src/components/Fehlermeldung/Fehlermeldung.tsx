import type { ReactNode } from 'react'
import { fehlertextBilden, istNetzfehler } from '@/api/common/fehler'
import Icon from '@/components/Icon/Icon'
import { useNetzfehlerMelden } from '@/hooks/useNetzfehlerMeldung'
import style from './Fehlermeldung.module.scss'

/** Eigenschaften der Fehlermeldung. */
type FehlermeldungEigenschaften = {
  /**
   * Der Fehler eines Aufrufs. Ohne `children` bestimmt er den Text
   * (`fehlertextBilden`), und ein Netzfehler blendet den `OfflineHinweis` aus.
   */
  fehler?: unknown
  /** Text für Fehler, die weder vom Server stammen noch Netzfehler sind. */
  ersatz?: string
  /** Eigener Text für Meldungen ohne Aufruf („… ist bereits angemeldet“). */
  children?: ReactNode
  /** Für `aria-describedby` eines Feldes, auf das sich die Meldung bezieht. */
  id?: string
  /** Test-ID; jede Ansicht vergibt ihre eigene. */
  'data-testid'?: string
}

/**
 * Fehlerkasten in einer Ansicht (C2, Abschnitt 5.1).
 *
 * **Abgrenzung zu `Fehlerzustand`:** Die Meldung steht *neben* einer
 * bedienbaren Ansicht – eine abgelehnte PIN, ein belegter Name –, und die
 * Ansicht bleibt nutzbar. `Fehlerzustand` ergänzt sie um „Erneut versuchen“,
 * wenn ohne die geladenen Daten nichts zu bedienen ist.
 *
 * **Gestaltet wie der `OfflineHinweis`** (Entscheidung vom 04.10.2026): Fläche
 * und Rand in der Fehlerfarbe, Text in Textfarbe, das Symbol in Fehlerrot.
 * Die Kennzeichnung hängt damit nicht am Symbol – das ohne Verbindung unter
 * Umständen gar nicht geladen werden kann.
 *
 * **Ein Netzfehler ersetzt den Offline-Hinweis:** Solange diese Meldung einen
 * Verbindungsfehler anzeigt, blendet sich der globale Streifen aus
 * (`useNetzfehlerMelden`). Es steht immer nur eine Meldung da.
 *
 * **Immer dasselbe Symbol** (04.10.2026): `error_circle_icon`, gleich welche
 * Ursache. Es ist ins Bündel eingebettet (`Icon/eingebettet.ts`) und erscheint
 * deshalb auch, wenn der Server der Anwendung selbst nicht antwortet.
 *
 * `role="alert"` liest die Meldung beim Erscheinen vor, ohne den Fokus zu
 * verschieben. Das Symbol trägt die Aussage nur mit; sie steht im Text.
 */
export default function Fehlermeldung({
  fehler,
  ersatz,
  children,
  id,
  'data-testid': testId = 'fehlermeldung',
}: FehlermeldungEigenschaften) {
  const netzfehler = fehler !== undefined && istNetzfehler(fehler)
  useNetzfehlerMelden(netzfehler)

  return (
    <p className={style.meldung} id={id} role="alert" data-testid={testId}>
      <span className={style.symbol}>
        <Icon name="error_circle_icon" />
      </span>
      <span className={style.text}>{children ?? fehlertextBilden(fehler, ersatz)}</span>
    </p>
  )
}
