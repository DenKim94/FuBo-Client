import { useEffect, useId, useRef, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import { ApiFehler } from '@/api/common/fehler'
import {
  SERIE_MAX_TERMINE,
  alsSerie,
  anlegenKoerper,
  liegtInVergangenheit,
  serieFehler,
  serieKoerper,
  type NeuWerte,
} from '@/api/admin/terminEingabe'
import type { SerieAngelegt } from '@/api/admin/adminTermine'
import { heuteIso } from '@/api/termine/terminZeit'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import SerieErgebnis from '@/components/SerieErgebnis/SerieErgebnis'
import TerminFormular, { type TerminFormularFehler } from '@/components/TerminFormular/TerminFormular'
import { useSerieAnlegen } from '@/hooks/admin/useSerieAnlegen'
import { useTerminAnlegen } from '@/hooks/admin/useTerminAnlegen'
import SerieFelder from './SerieFelder'
import style from './AdminTerminNeu.module.scss'

const FEHLER_ERSATZ = 'Der Termin konnte nicht angelegt werden. Bitte versuche es erneut.'
const FEHLER_ERSATZ_SERIE = 'Die Serie konnte nicht angelegt werden. Bitte versuche es erneut.'
const TEXT_BELEGT = 'Zu diesem Zeitpunkt gibt es bereits einen Termin (auch an einem anderen Ort).'
const TEXT_VERGANGENHEIT = 'Dieser Zeitpunkt liegt in der Vergangenheit.'

const LEER: NeuWerte = { datum: '', uhrzeit: '', ort: '', titel: '', wochentag: '', enddatum: '' }

type Art = 'einzel' | 'serie'

/**
 * Termin oder Serie anlegen (`/admin/termine/neu`, C7 8.3).
 *
 * **Eine Seite, zwei Arten:** Die Radiogruppe „Art“ wechselt zwischen Einzeltermin (Vorgabe) und Serie. Beide
 * teilen sich Datum (bei der Serie das Startdatum), Uhrzeit und Ort; der Wechsel behält sie.
 *
 * - **Einzeltermin:** Erfolg leitet mit `mutateAsync` zur Verwaltung des neuen Termins (Hinweis „Termin
 *   angelegt.“). `409 TERMIN_BELEGT` steht am Zeitfeld, die Eingaben bleiben. Die Vergangenheitsprüfung
 *   (Datum und Uhrzeit zusammen) läuft im Submit-Handler mit `Date.now()`, nicht im Render.
 * - **Serie:** Vor dem Senden fragt eine `Bestaetigung` mit den Folgen (bis zu {@link SERIE_MAX_TERMINE} Termine
 *   sofort, danach nicht mehr änderbar). Das Ergebnis ersetzt das Formular und nennt auch die **übersprungenen**
 *   Zeitpunkte; die Überschrift bekommt den Fokus.
 *
 * **Schaltfläche statt `disabled`:** Sie ist `aria-disabled` mit Grundtext, solange Pflichtfelder fehlen – ein
 * deaktiviertes Element nähme den Fokus weg und verschwiege den Grund.
 */
export default function AdminTerminNeu() {
  const [art, setArt] = useState<Art>('einzel')
  const [werte, setWerte] = useState<NeuWerte>(LEER)
  // Einmal beim Einhängen: `min` des Datumsfeldes; die Uhr gehört nicht in den Render.
  const [heute] = useState(() => heuteIso(new Date()))
  const [versucht, setVersucht] = useState(false)
  const [zeitFehler, setZeitFehler] = useState<'datum' | 'uhrzeit' | null>(null)
  const [dialog, setDialog] = useState(false)
  const [ergebnis, setErgebnis] = useState<SerieAngelegt | null>(null)

  const anlegen = useTerminAnlegen()
  const serie = useSerieAnlegen()
  const navigate = useNavigate()
  const uhrzeitFeld = useRef<HTMLInputElement>(null)
  const ergebnisTitel = useRef<HTMLHeadingElement>(null)
  const grundId = useId()

  // Das Ergebnis ersetzt das Formular: Der Fokus gehört auf seine Überschrift, sonst läge er auf `body`.
  useEffect(() => {
    if (ergebnis) ergebnisTitel.current?.focus()
  }, [ergebnis])

  if (ergebnis) {
    return (
      <section className={style.seite} data-testid="admin-termin-neu">
        <div className={style.bereich}>
          <SerieErgebnis ergebnis={ergebnis} ueberschriftRef={ergebnisTitel} />
        </div>
      </section>
    )
  }

  const einzel = art === 'einzel'
  const aktiv = einzel ? anlegen : serie
  const laeuft = aktiv.isPending
  const serieFehlerAlle = serieFehler(alsSerie(werte))
  // Fehlende Pflichtfelder haben keinen Text am Feld (leere Zeichenkette); der Grund steht an der Schaltfläche.
  const grund = einzel
    ? werte.datum === '' || werte.uhrzeit === ''
      ? 'Bitte gib Datum und Uhrzeit ein.'
      : null
    : Object.keys(serieFehlerAlle).length > 0
      ? 'Bitte fülle alle Felder aus und prüfe das Enddatum.'
      : null

  const apiFehler = aktiv.error instanceof ApiFehler ? aktiv.error : null
  const einzelFehler: TerminFormularFehler = {}
  if (einzel && apiFehler) {
    if (apiFehler.code === 'TERMIN_BELEGT') einzelFehler.uhrzeit = TEXT_BELEGT
    einzelFehler.datum = apiFehler.status === 400 ? (apiFehler.felder?.datum ?? null) : null
    einzelFehler.uhrzeit ??= apiFehler.status === 400 ? (apiFehler.felder?.uhrzeit ?? null) : null
    einzelFehler.ort = apiFehler.status === 400 ? (apiFehler.felder?.ort ?? null) : null
  }
  if (einzel && zeitFehler) einzelFehler[zeitFehler] = TEXT_VERGANGENHEIT
  const einzelAmFeld = Object.values(einzelFehler).some((t) => t)
  // Alles, was nicht an einem Feld steht, kommt als Kasten über die Aktion.
  const kasten = aktiv.error !== null && !(einzel && einzelAmFeld) && !(!einzel && dialog)

  /** Mit der nächsten Eingabe hat ein Fehler seine Aufgabe erfüllt. */
  function eingabe() {
    if (aktiv.isError) aktiv.reset()
    setZeitFehler(null)
  }

  function aendern(feld: keyof NeuWerte, wert: string) {
    eingabe()
    setWerte((alt) => ({ ...alt, [feld]: wert }))
  }

  function artWaehlen(neu: Art) {
    if (neu === art) return
    anlegen.reset()
    serie.reset()
    setZeitFehler(null)
    setVersucht(false)
    setArt(neu)
  }

  /** Legt einen Einzeltermin an und geht mit Hinweis zu seiner Verwaltung. `mutateAsync`: Die Seite wird ausgehängt. */
  async function einzelnAnlegen() {
    if (liegtInVergangenheit(werte.datum, werte.uhrzeit, Date.now())) {
      setZeitFehler(werte.datum < heute ? 'datum' : 'uhrzeit')
      return
    }
    try {
      const angelegt = await anlegen.mutateAsync(anlegenKoerper(werte))
      void navigate(ADMIN_PFADE.terminVerwaltung(angelegt.terminId), { state: { hinweis: 'Termin angelegt.' } })
    } catch (fehler) {
      if (fehler instanceof ApiFehler && fehler.code === 'TERMIN_BELEGT') uhrzeitFeld.current?.focus()
    }
  }

  /** Legt die Serie an; der Dialog schliesst mit dem Erfolg, das Ergebnis ersetzt das Formular. */
  async function serieAnlegen() {
    if (serie.isPending) return
    try {
      const angelegt = await serie.mutateAsync(serieKoerper(alsSerie(werte)))
      setDialog(false)
      setErgebnis(angelegt)
    } catch {
      // Der Fehler steht im Dialog (`serie.error`); er bleibt offen.
    }
  }

  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (laeuft) return
    if (grund !== null) {
      setVersucht(true)
      return
    }
    if (einzel) void einzelnAnlegen()
    else {
      serie.reset()
      setDialog(true)
    }
  }

  return (
    <form className={style.seite} onSubmit={absenden} noValidate data-testid="admin-termin-neu">
      <div className={style.bereich}>
        <h1 className={style.titel}>Termin anlegen</h1>

        <fieldset className={style.gruppe}>
          <legend className={style.legende}>Art</legend>
          <label className={style.option}>
            <input
              type="radio"
              name="art"
              value="einzel"
              checked={einzel}
              onChange={() => {
                artWaehlen('einzel')
              }}
              data-testid="admin-art-einzel"
            />
            <span>Einzeltermin</span>
          </label>
          <label className={style.option}>
            <input
              type="radio"
              name="art"
              value="serie"
              checked={!einzel}
              onChange={() => {
                artWaehlen('serie')
              }}
              data-testid="admin-art-serie"
            />
            <span>Serie</span>
          </label>
        </fieldset>

        {einzel ? (
          <TerminFormular
            werte={werte}
            beiAenderung={aendern}
            min={heute}
            fehler={einzelFehler}
            schreibgeschuetzt={laeuft}
            uhrzeitRef={uhrzeitFeld}
          />
        ) : (
          <SerieFelder
            werte={werte}
            beiAenderung={aendern}
            min={heute}
            fehler={versucht ? serieFehlerAlle : { enddatum: serieFehlerAlle.enddatum }}
            schreibgeschuetzt={laeuft}
          />
        )}
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          {kasten && (
            <Fehlermeldung
              fehler={aktiv.error}
              ersatz={einzel ? FEHLER_ERSATZ : FEHLER_ERSATZ_SERIE}
              data-testid="admin-termin-neu-fehler"
            />
          )}
          {grund !== null && (
            <p id={grundId} className={style.nebentext} data-testid="admin-termin-neu-grund">
              {grund}
            </p>
          )}
          <CustomButton
            type="submit"
            art="primaer"
            breit
            className={style.aktion}
            laedt={laeuft && !dialog}
            aria-disabled={grund !== null ? true : undefined}
            aria-describedby={grund !== null ? grundId : undefined}
            data-testid="admin-termin-neu-absenden"
          >
            {einzel ? 'Termin anlegen' : 'Serie anlegen'}
          </CustomButton>
        </div>

        <Bestaetigung
          offen={dialog}
          titel="Serie anlegen?"
          bestaetigenText="Serie anlegen"
          laedt={serie.isPending}
          fehler={dialog ? serie.error : null}
          fehlerErsatz={FEHLER_ERSATZ_SERIE}
          beiBestaetigen={() => void serieAnlegen()}
          beiAbbruch={() => {
            setDialog(false)
          }}
          data-testid="admin-serie-dialog"
        >
          <p>
            Alle passenden Termine werden sofort angelegt, höchstens {SERIE_MAX_TERMINE}. Eine Serie lässt sich danach
            nicht mehr ändern; einzelne Termine lassen sich einzeln ändern, absagen oder entfernen.
          </p>
        </Bestaetigung>
      </Aktionsleiste>
    </form>
  )
}
