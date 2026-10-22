import { useEffect, useRef, useState } from 'react'
import type { TerminDetails } from '@/api/termine/termine'
import CustomButton from '@/components/CustomButton/CustomButton'
import ErgebnisAnzeige from '@/components/ErgebnisAnzeige/ErgebnisAnzeige'
import Hinweis from '@/components/Hinweis/Hinweis'
import { useErgebnisKorrigieren } from '@/hooks/admin/useErgebnisKorrigieren'
import ErgebnisKorrekturFormular from './ErgebnisKorrekturFormular'
import style from './AdminTerminDetail.module.scss'

/** Eigenschaften des Abschnitts. */
type TerminErgebnisEigenschaften = {
  termin: TerminDetails
}

/**
 * Abschnitt „Ergebnis“ der Terminverwaltung bei `ABGESCHLOSSEN` (C8 10.2, A21).
 *
 * - **Mit Ergebnis:** `ErgebnisAnzeige` (sie zeigt auch „Zuletzt korrigiert am …“) und „Ergebnis korrigieren“, das das
 *   Formular aufklappt. Der Admin **erfasst** kein Ergebnis (das tun die Spieler, A21); er korrigiert nur.
 * - **Ohne Ergebnis:** ein Hinweis; fehlt auch die Teameinteilung, nennt er, dass ohne sie kein Ergebnis erfasst werden
 *   kann.
 * - **E5:** Dieser Baustein besitzt die Mutation, `key={ergebnis.version}` baut das Formular nach jedem Stand neu auf.
 *   Erfolg klappt es zu, meldet „Ergebnis korrigiert.“ und setzt den Fokus auf die Überschrift der Anzeige (sonst läge er
 *   auf `body`, denn die Schaltfläche war im Formular).
 */
export default function TerminErgebnis({ termin }: TerminErgebnisEigenschaften) {
  const korrigieren = useErgebnisKorrigieren()
  const [offen, setOffen] = useState(false)
  const [fokusUeberschrift, setFokusUeberschrift] = useState(0)
  const ueberschrift = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (fokusUeberschrift > 0) ueberschrift.current?.focus()
  }, [fokusUeberschrift])

  if (termin.status !== 'ABGESCHLOSSEN') return null
  const ergebnis = termin.ergebnis

  if (!ergebnis) {
    return (
      <section className={style.abschnitt} aria-labelledby="admin-ergebnis-titel" data-testid="admin-ergebnis-abschnitt">
        <h2 id="admin-ergebnis-titel" className={style.abschnittTitel}>
          Ergebnis
        </h2>
        <Hinweis data-testid="admin-ergebnis-leer">Für diesen Termin wurde noch kein Ergebnis erfasst. Das erfassen die Spieler.</Hinweis>
        {!termin.teams && (
          <p className={style.nebentext} data-testid="admin-ergebnis-ohne-teams">
            Es liegt keine Teameinteilung vor; ohne sie kann kein Ergebnis erfasst werden.
          </p>
        )}
      </section>
    )
  }

  return (
    <div className={style.abschnitt} data-testid="admin-ergebnis-abschnitt">
      <ErgebnisAnzeige ergebnis={ergebnis} ueberschriftRef={ueberschrift} />

      {korrigieren.isSuccess && !offen && <Hinweis data-testid="admin-ergebnis-korrigiert">Ergebnis korrigiert.</Hinweis>}

      {offen ? (
        <ErgebnisKorrekturFormular
          key={ergebnis.version}
          terminId={termin.terminId}
          ergebnis={ergebnis}
          korrigieren={korrigieren}
          beiGespeichert={() => {
            setOffen(false)
            setFokusUeberschrift((n) => n + 1)
          }}
          beiAbbruch={() => {
            korrigieren.reset()
            setOffen(false)
          }}
        />
      ) : (
        <CustomButton
          art="sekundaer"
          onClick={() => {
            korrigieren.reset()
            setOffen(true)
          }}
          data-testid="admin-ergebnis-korrigieren"
        >
          Ergebnis korrigieren
        </CustomButton>
      )}
    </div>
  )
}
