import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import style from './Dialog.module.scss'

/** Eigenschaften des Dialogs. */
type DialogEigenschaften = {
  /** Gesteuert von aussen: `true` öffnet den Dialog modal, `false` schliesst ihn. */
  offen: boolean
  /** Überschrift; zugleich der zugängliche Name des Dialogs. */
  titel: string
  /**
   * Wird gerufen, sobald der Dialog geschlossen ist – über Escape, die
   * Zurück-Geste unter Android oder weil `offen` auf `false` wechselte. Der
   * Aufrufer setzt darin seinen Zustand auf „geschlossen“; ein doppelter Aufruf
   * ist deshalb harmlos.
   */
  aufSchliessen: () => void
  /**
   * Verhindert das Schliessen durch den Nutzer (Escape, Zurück-Geste) – für
   * Dialoge, die eine Entscheidung verlangen oder eine laufende Eingabe
   * schützen (DESIGN.md, Sitzungsablauf). Geschlossen wird dann nur über `offen`.
   */
  festhalten?: boolean
  /**
   * Schmückendes Symbol vor dem Titel (z. B. `Icon`). Wird für Screenreader
   * ausgeblendet: Die Aussage steht im Titel, das Symbol unterstützt sie nur.
   */
  symbol?: ReactNode
  /**
   * `id` des Elements, das den Dialog beschreibt (`aria-describedby`). Der
   * Titel nennt den Dialog, die Beschreibung sagt, worum es geht – ohne sie
   * hört ein Screenreader beim Öffnen nur Titel und erste Schaltfläche, nicht
   * den Text dazwischen.
   */
  beschreibungId?: string
  /** Test-ID des `<dialog>`-Elements. */
  'data-testid'?: string
  children: ReactNode
}

/**
 * Modaler Dialog auf Basis des nativen `<dialog>`-Elements (C2, Abschnitt 4).
 *
 * **Warum nativ:** `showModal()` bringt Fokusfalle, Inertisierung des
 * Hintergrunds, `::backdrop`, Escape und die Rückgabe des Fokus beim Schliessen
 * mit. Ein eigener Dialog müsste all das nachbilden. Anders als beim `<select>`
 * steht hier nichts Gestalterisches im Weg: Rahmen und Inhalt sind vollständig
 * stylebar.
 *
 * **Gesteuert über `offen`**, nicht über eine Ref-Methode: So passt der Dialog in
 * das deklarative Modell von React, und der Zustand liegt beim Aufrufer.
 *
 * **Titel über `useId`**, nicht über eine feste ID – sonst kollidierten zwei
 * Dialoge im selben Baum (Korrektur 3 der C2-Fassung vom 03.10.2026).
 *
 * **`festhalten` braucht zwei Riegel.** `preventDefault()` im `cancel`-Ereignis
 * genügt nicht immer: Seit der Einführung der Close Watcher (Chrome 122) darf
 * der Browser das `cancel`-Ereignis überspringen, wenn vor der Schliessanfrage
 * keine Nutzeraktivierung lag – ein Missbrauchsschutz gegen Seiten, die die
 * Zurück-Taste unter Android blockieren. Escape und die Zurück-Geste zählen
 * dabei nicht als Aktivierung. Schliesst der Browser den Dialog deshalb ohne
 * abbrechbares `cancel`, öffnet ihn `beimSchliessen` sofort wieder, solange
 * `offen` noch `true` ist.
 */
export default function Dialog({
  offen,
  titel,
  aufSchliessen,
  festhalten = false,
  symbol,
  beschreibungId,
  'data-testid': testId = 'dialog',
  children,
}: DialogEigenschaften) {
  const ref = useRef<HTMLDialogElement>(null)
  const titelId = useId()

  // Gleicht das Element mit `offen` ab. Die Abfrage von `element.open` macht den
  // Effekt idempotent – im StrictMode läuft er in der Entwicklung zweimal.
  useEffect(() => {
    const element = ref.current
    if (!element) return
    if (offen && !element.open) element.showModal()
    if (!offen && element.open) element.close()
  }, [offen])

  /** Escape bzw. Zurück-Geste: im Modus `festhalten` abweisen. */
  function beimAbbrechen(ereignis: SyntheticEvent<HTMLDialogElement>) {
    if (festhalten) ereignis.preventDefault()
  }

  /** Meldet das Schliessen – oder macht es rückgängig, wenn der Dialog festgehalten wird. */
  function beimSchliessen() {
    if (festhalten && offen) {
      ref.current?.showModal()
      return
    }
    aufSchliessen()
  }

  return (
    <dialog
      ref={ref}
      className={style.dialog}
      aria-labelledby={titelId}
      aria-describedby={beschreibungId}
      onCancel={beimAbbrechen}
      onClose={beimSchliessen}
      data-testid={testId}
    >
      <div className={style.kopf}>
        {symbol && (
          <span className={style.symbol} aria-hidden="true">
            {symbol}
          </span>
        )}
        <h2 id={titelId} className={style.titel}>
          {titel}
        </h2>
      </div>
      <div className={style.inhalt}>{children}</div>
    </dialog>
  )
}
