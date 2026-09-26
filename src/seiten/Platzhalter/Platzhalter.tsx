import stile from './Platzhalter.module.scss'

/** Eigenschaften des Platzhalters. */
type PlatzhalterEigenschaften = {
  /** Titel der noch nicht umgesetzten Ansicht. */
  titel: string
  /** Arbeitspaket, in dem die Ansicht entsteht, z. B. "C3". */
  paket: string
}

/**
 * Vorlaeufiger Inhalt einer Route, deren Ansicht noch nicht umgesetzt ist.
 * Haelt den Routenbaum ab C0 vollstaendig, ohne fachlichen Code vorwegzunehmen.
 */
export default function Platzhalter({ titel, paket }: PlatzhalterEigenschaften) {
  return (
    <section className={stile.platzhalter} data-testid={`platzhalter-${paket.toLowerCase()}`}>
      <h1 className={stile.titel}>{titel}</h1>
      <p className={stile.hinweis}>Diese Ansicht entsteht im Arbeitspaket {paket}.</p>
    </section>
  )
}
