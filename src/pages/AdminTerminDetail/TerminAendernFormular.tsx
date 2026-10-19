import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { TerminAendern } from '@/api/admin/adminTermine'
import { aenderungKoerper, liegtInVergangenheit, type TerminWerte } from '@/api/admin/terminEingabe'
import { ApiFehler } from '@/api/common/fehler'
import { uhrzeitKurz } from '@/api/termine/terminZeit'
import type { TerminDetails } from '@/api/termine/termine'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Hinweis from '@/components/Hinweis/Hinweis'
import TerminFormular, { type TerminFormularFehler } from '@/components/TerminFormular/TerminFormular'
import style from './AdminTerminDetail.module.scss'

const FEHLER_ERSATZ = 'Der Termin konnte nicht geändert werden. Bitte versuche es erneut.'
const TEXT_BELEGT = 'Zu diesem Zeitpunkt gibt es bereits einen Termin (auch an einem anderen Ort).'
const TEXT_VERGANGENHEIT = 'Dieser Zeitpunkt liegt in der Vergangenheit.'
const TEXT_VERALTET =
  'Der Termin wurde zwischenzeitlich geändert. Deine Eingaben wurden zurückgesetzt; bitte prüfe den aktuellen Stand und ändere erneut.'

/** Eigenschaften des Änderungsformulars. */
type TerminAendernFormularEigenschaften = {
  /** Der Stand, mit dem das Formular gebaut wird; `version` geht beim Speichern mit. */
  termin: TerminDetails
  /** Die Mutation gehört dem Elternbaustein: Meldung und Fehler überleben den Neuaufbau (E5). */
  aendern: UseMutationResult<void, Error, TerminAendern>
  /** Frühestes wählbares Datum (heute), vom Elternbaustein einmalig gebildet. */
  heute: string
  /** Das Speichern ist gelungen: Der Elternbaustein merkt es sich für den Fokus nach dem Neuaufbau. */
  beiGespeichert: () => void
  /** `true`: Der Fokus gehört auf „Änderungen speichern“, weil das Formular nach dem Speichern neu aufgebaut wurde. */
  fokusAufSpeichern: boolean
  /** Der Fokus ist gesetzt; der Elternbaustein setzt sein Merkzeichen zurück. */
  beiFokussiert: () => void
}

/**
 * Formular „Termin ändern“ (C7 8.5), nur für einen `GEPLANT`en Termin.
 *
 * - **Diffbasiert (E11):** Gesendet wird nur, was sich gegenüber dem Stand geändert hat; „Änderungen speichern“ ist
 *   `aria-disabled` mit Grund, solange nichts geändert ist (ein Körper ohne Änderung wäre `400`).
 * - **E5 – `DATEN_VERALTET`:** Der Elternbaustein setzt `key={termin.version}`. Nach der `409` liest der Hook neu,
 *   das Formular baut sich mit dem frischen Stand neu auf (Eingaben weg), und der Text sagt, was geschah. Er
 *   verschwindet mit der nächsten Eingabe. Es wird **nie** mit der neuen `version` und den alten Eingaben erneut gesendet.
 * - **Nach eigenem Speichern** baut sich das Formular ebenfalls neu auf (die `version` steigt); „Gespeichert.“ liegt
 *   deshalb in der Mutation des Elternbausteins, und der Fokus wird auf die neue Schaltfläche zurückgesetzt.
 * - **Fehler:** `TERMIN_BELEGT` am Uhrzeitfeld; `TERMIN_GESCHLOSSEN` behandelt der Elternbaustein (der Abschnitt
 *   verschwindet); alles andere als Kasten über der Aktion.
 */
export default function TerminAendernFormular({
  termin,
  aendern,
  heute,
  beiGespeichert,
  fokusAufSpeichern,
  beiFokussiert,
}: TerminAendernFormularEigenschaften) {
  const [werte, setWerte] = useState<TerminWerte>({
    datum: termin.datum,
    uhrzeit: uhrzeitKurz(termin.uhrzeit),
    ort: termin.ort ?? '',
  })
  const [zeitFehler, setZeitFehler] = useState<'datum' | 'uhrzeit' | null>(null)
  const uhrzeitFeld = useRef<HTMLInputElement>(null)
  const speichernKnopf = useRef<HTMLButtonElement>(null)
  const grundId = useId()

  useEffect(() => {
    if (!fokusAufSpeichern) return
    speichernKnopf.current?.focus()
    beiFokussiert()
  }, [fokusAufSpeichern, beiFokussiert])

  const koerper = aenderungKoerper(termin, werte)
  const grund = koerper === null ? 'Es gibt keine Änderung.' : null
  const apiFehler = aendern.error instanceof ApiFehler ? aendern.error : null
  const veraltet = apiFehler?.code === 'DATEN_VERALTET'
  const geschlossen = apiFehler?.code === 'TERMIN_GESCHLOSSEN'

  const fehler: TerminFormularFehler = {}
  if (apiFehler?.code === 'TERMIN_BELEGT') fehler.uhrzeit = TEXT_BELEGT
  if (apiFehler?.status === 400) {
    fehler.datum = apiFehler.felder?.datum ?? null
    fehler.uhrzeit ??= apiFehler.felder?.uhrzeit ?? null
    fehler.ort = apiFehler.felder?.ort ?? null
  }
  if (zeitFehler) fehler[zeitFehler] = TEXT_VERGANGENHEIT
  const amFeld = Object.values(fehler).some((t) => t)
  const kasten = aendern.isError && !veraltet && !geschlossen && !amFeld

  function aendernEingabe(feld: keyof TerminWerte, wert: string) {
    // Mit der nächsten Eingabe haben Fehler und Meldungen ihre Aufgabe erfüllt.
    if (!aendern.isIdle) aendern.reset()
    setZeitFehler(null)
    setWerte((alt) => ({ ...alt, [feld]: wert }))
  }

  /** Speichert; `mutateAsync`, weil sich das Formular mit dem Erfolg selbst ersetzt (neuer `key`). */
  async function speichern(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (koerper === null || aendern.isPending) return
    const zeitGeaendert = koerper.datum !== undefined || koerper.uhrzeit !== undefined
    if (zeitGeaendert && liegtInVergangenheit(werte.datum, werte.uhrzeit, Date.now())) {
      setZeitFehler(werte.datum < heute ? 'datum' : 'uhrzeit')
      return
    }
    try {
      await aendern.mutateAsync(koerper)
      beiGespeichert()
    } catch (e) {
      if (e instanceof ApiFehler && e.code === 'TERMIN_BELEGT') uhrzeitFeld.current?.focus()
    }
  }

  return (
    <form className={style.formular} onSubmit={(e) => void speichern(e)} noValidate data-testid="admin-termin-aendern">
      {veraltet && <Hinweis data-testid="admin-termin-veraltet">{TEXT_VERALTET}</Hinweis>}
      <TerminFormular
        werte={werte}
        beiAenderung={aendernEingabe}
        min={heute}
        fehler={fehler}
        schreibgeschuetzt={aendern.isPending}
        uhrzeitRef={uhrzeitFeld}
      />
      <p className={style.nebentext} data-testid="admin-termin-aendern-folgen">
        Eine Verschiebung von Datum oder Uhrzeit setzt die Einteilung der Teams zurück.
      </p>
      {aendern.isSuccess && <Hinweis data-testid="admin-termin-gespeichert">Gespeichert.</Hinweis>}
      {kasten && <Fehlermeldung fehler={aendern.error} ersatz={FEHLER_ERSATZ} data-testid="admin-termin-aendern-fehler" />}
      {grund !== null && (
        <p id={grundId} className={style.nebentext} data-testid="admin-termin-aendern-grund">
          {grund}
        </p>
      )}
      <CustomButton
        ref={speichernKnopf}
        type="submit"
        art="primaer"
        laedt={aendern.isPending}
        aria-disabled={grund !== null ? true : undefined}
        aria-describedby={grund !== null ? grundId : undefined}
        data-testid="admin-termin-speichern"
      >
        Änderungen speichern
      </CustomButton>
    </form>
  )
}
