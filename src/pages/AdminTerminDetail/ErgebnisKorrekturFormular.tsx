import { useId, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { ErgebnisKorrektur } from '@/api/admin/adminTermine'
import { ApiFehler } from '@/api/common/fehler'
import type { Ergebnis } from '@/api/ergebnis/ergebnis'
import { ergebnisSatz } from '@/api/ergebnis/ergebnisText'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import ErgebnisEingabe, { type ErgebnisWahl } from '@/components/ErgebnisEingabe/ErgebnisEingabe'
import Hinweis from '@/components/Hinweis/Hinweis'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import style from './AdminTerminDetail.module.scss'

const FEHLER_ERSATZ = 'Das Ergebnis konnte nicht korrigiert werden. Bitte versuche es erneut.'

/** Text nach `409 DATEN_VERALTET`: neu laden und erneut speichern, nicht „Eingabe falsch“. */
export const TEXT_ERGEBNIS_VERALTET =
  'Das Ergebnis wurde zwischenzeitlich korrigiert. Der aktuelle Stand ist geladen; deine Eingaben wurden zurückgesetzt.'

/** Eigenschaften des Korrekturformulars. */
type ErgebnisKorrekturFormularEigenschaften = {
  terminId: number
  /** Der Stand, mit dem das Formular gebaut wird; seine `version` geht beim Speichern mit. */
  ergebnis: Ergebnis
  /** Die Mutation gehört dem Elternbaustein: Meldung und Fehler überleben den Neuaufbau (E5). */
  korrigieren: UseMutationResult<void, Error, ErgebnisKorrektur>
  /** Das Speichern ist gelungen: Der Elternbaustein klappt das Formular zu und setzt den Fokus. */
  beiGespeichert: () => void
  /** Bricht ab: Der Elternbaustein klappt das Formular zu. */
  beiAbbruch: () => void
}

/**
 * Formular der Ergebniskorrektur (C8 10.2): `ErgebnisEingabe`, mit dem aktuellen Stand vorbelegt.
 *
 * - **Speichern erst nach einer Änderung** (E17): Solange `sieger` und `deutlich` dem Stand entsprechen, ist die
 *   Schaltfläche `aria-disabled` mit dem Grund als Text. Eine unveränderte Korrektur würde nur `korrigiertAm` setzen.
 * - **Bestätigung nennt Alt und Neu** und die Folge für die Bilanz der Beteiligten.
 * - **`deutlich` geht bei `U` immer als `false` hinaus** (zweites Schloss neben der Eingabe; `true` wäre `400`).
 * - **E5:** Der Elternbaustein setzt `key={ergebnis.version}`: Nach jedem neuen Stand – auch nach `409 DATEN_VERALTET` –
 *   baut sich das Formular mit dem frischen Stand auf. Es wird nie mit der neuen `version` und den alten Eingaben
 *   gesendet; der Text zum Konflikt hängt an der Mutation und überlebt den Neuaufbau. Er verschwindet mit der nächsten
 *   Eingabe.
 */
export default function ErgebnisKorrekturFormular({
  terminId,
  ergebnis,
  korrigieren,
  beiGespeichert,
  beiAbbruch,
}: ErgebnisKorrekturFormularEigenschaften) {
  const [wahl, setWahl] = useState<ErgebnisWahl>({ sieger: ergebnis.sieger, deutlich: ergebnis.deutlich })
  const [dialogOffen, setDialogOffen] = useState(false)
  const grundId = useId()

  const veraltet = korrigieren.error instanceof ApiFehler && korrigieren.error.code === 'DATEN_VERALTET'
  const geaendert = wahl.sieger !== ergebnis.sieger || wahl.deutlich !== ergebnis.deutlich
  const sperrt = !geaendert
  const fehlerImDialog = dialogOffen && korrigieren.isError && !veraltet ? korrigieren.error : null

  /** Mit der nächsten Eingabe haben Fehler und Meldungen ihre Aufgabe erfüllt. */
  function geaendertDurch(neu: ErgebnisWahl) {
    if (!korrigieren.isIdle) korrigieren.reset()
    setWahl(neu)
  }

  /** Sendet das Voll-Update; `mutateAsync`, weil sich das Formular mit dem Erfolg selbst ersetzt (neuer `key`). */
  async function speichern() {
    if (wahl.sieger === null || korrigieren.isPending) return
    try {
      await korrigieren.mutateAsync({
        terminId,
        sieger: wahl.sieger,
        deutlich: wahl.sieger === 'U' ? false : wahl.deutlich,
        version: ergebnis.version,
      })
      setDialogOffen(false)
      beiGespeichert()
    } catch (fehler) {
      // Konflikt: Der Dialog schließt, der frische Stand steht im neu aufgebauten Formular. Andere Fehler zeigt der Dialog.
      if (fehler instanceof ApiFehler && fehler.code === 'DATEN_VERALTET') setDialogOffen(false)
    }
  }

  return (
    <div className={style.formular} data-testid="admin-ergebnis-formular">
      {veraltet && <Hinweis data-testid="admin-ergebnis-veraltet">{TEXT_ERGEBNIS_VERALTET}</Hinweis>}

      <ErgebnisEingabe sieger={wahl.sieger} deutlich={wahl.deutlich} beiAenderung={geaendertDurch} />

      {sperrt && (
        <p id={grundId} className={style.nebentext} data-testid="admin-ergebnis-grund">
          Es gibt keine Änderung.
        </p>
      )}
      <Knopfgruppe untereinander>
        <CustomButton
          art="primaer"
          aria-disabled={sperrt ? true : undefined}
          aria-describedby={sperrt ? grundId : undefined}
          onClick={() => {
            if (sperrt) return
            korrigieren.reset()
            setDialogOffen(true)
          }}
          data-testid="admin-ergebnis-speichern"
        >
          Speichern
        </CustomButton>
        <CustomButton art="sekundaer" onClick={beiAbbruch} data-testid="admin-ergebnis-abbrechen">
          Abbrechen
        </CustomButton>
      </Knopfgruppe>

      <Bestaetigung
        offen={dialogOffen}
        titel="Ergebnis ändern?"
        bestaetigenText="Ergebnis ändern"
        art="primaer"
        laedt={korrigieren.isPending}
        fehler={fehlerImDialog}
        fehlerErsatz={FEHLER_ERSATZ}
        beiBestaetigen={() => void speichern()}
        beiAbbruch={() => {
          // Der Dialog meldet „geschlossen“ auch, wenn wir ihn selbst schließen (nach `409 DATEN_VERALTET`): Dann darf der
          // Konflikt nicht verschwinden, denn er erklärt, warum das Formular neu steht.
          if (!dialogOffen) return
          korrigieren.reset()
          setDialogOffen(false)
        }}
        data-testid="admin-ergebnis-dialog"
      >
        <p data-testid="admin-ergebnis-zusammenfassung">
          Ergebnis ändern von „{ergebnisSatz(ergebnis.sieger, ergebnis.deutlich)}“ auf „
          {wahl.sieger ? ergebnisSatz(wahl.sieger, wahl.deutlich) : ''}“? Die Bilanz der beteiligten Spieler wird angepasst.
        </p>
      </Bestaetigung>
    </div>
  )
}
