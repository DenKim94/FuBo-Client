import { useId, useState, type SubmitEvent } from 'react'
import type { GastStufe } from '@/api/auth/auth'
import { ApiFehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Auswahlliste from '@/components/Auswahlliste/Auswahlliste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Erklaerung from '@/components/Erklaerung/Erklaerung'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Feld from '@/components/Feld/Feld'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useGastAnmelden } from '@/hooks/useGastAnmelden'
import { useNameWaehlen } from '@/hooks/useNameWaehlen'
import { useNamensliste } from '@/hooks/useNamensliste'
import style from './Namensauswahl.module.scss'

/** Wert des Gast-Eintrags in der Auswahlliste; Profil-Ids sind Zahlen. */
const GAST = 'gast'

/** Grenzen des Gastnamens laut Kontrakt (`GastAnmeldungRequest`). */
const GASTNAME_MIN = 2
const GASTNAME_MAX = 20

/** Weiches Trennzeichen: unsichtbar, solange das Wort in die Zeile passt. */
const TRENNSTELLE = '\u00AD'

/**
 * Die drei Stufen der Selbsteinschätzung (A8, A17), in aufsteigender Reihenfolge.
 *
 * Die Stufen sind gleich breit (je ein Drittel der Zeile). Lange Wörter tragen
 * deshalb eine **feste Trennstelle**: Bei 360 px passen z.B. „Anfänger" und
 * „Goalgetter" nicht in ein Drittel und brechen dann als „Anfän-ger" bzw.
 * „Goal-getter" um. `hyphens: auto` allein genügte nicht – Chromium bringt
 * unter Linux und Windows keine deutschen Trennwörterbücher mit, das Wort
 * bräche dort ohne Trennstrich an beliebiger Stelle. Screenreader übergehen
 * das Zeichen.
 */
const STUFEN: { wert: GastStufe; text: string }[] = [
  { wert: 'SCHWACH', text: `Anfän${TRENNSTELLE}ger` },
  { wert: 'MITTEL', text: 'Solide' },
  { wert: 'STARK', text: 'Goat' },
]

/** Kurze Erklärung am Gastbereich (A8). */
const GAST_ERKLAERUNG =
  'Als Gast spielst du ohne eigenes Profil mit. Dein Name gilt nur für diese Sitzung und ' +
  'erscheint mit dem Zusatz „(Gast)". Deine Selbsteinschätzung hilft, die Teams ' +
  'ausgeglichen einzuteilen.'

/**
 * Zweite Stufe des Logins: Namensauswahl für Spieler und Gäste (A4, A6, A8).
 *
 * **Die Liste ist die gestaltete `Auswahlliste`** (Combobox mit Listbox), nicht
 * das native `<select>`: Dessen aufgeklappte Liste zeichnet das Betriebssystem
 * und passt farblich nicht zum Design. Belegte Namen sind ausgegraut, nicht
 * wählbar **und** tragen „bereits angemeldet" als zweite Zeile (A6).
 *
 * **Der Belegtstatus bleibt aktuell** über `useNamensliste` (Polling alle fünf
 * Sekunden). Wird der gewählte Name zwischenzeitlich belegt, sperrt die Ansicht
 * das Absenden und sagt warum, statt einen sicheren `409` abzuwarten.
 *
 * **Gast:** Der Eintrag „Gast" steht oben in der Liste. Ist er gewählt,
 * erscheinen Name, Selbsteinschätzung (Vorgabe „Solide", Wert `MITTEL`) und ein Info-Symbol
 * mit der Erklärung. Gesendet wird der Name ohne Zusatz; angezeigt wird er mit
 * „(Gast)" (Kontrakt: das Anhängen ist Sache der Oberfläche).
 *
 * **Volle Gastplätze** zeigt der Server erst beim Versuch an
 * (`409 KEIN_GAST_SLOT_FREI`). In der Stufe `PIN_VERIFIED` gibt es keinen
 * Endpunkt, der die freien Plätze vorab nennt – eine Vorab-Sperre des
 * Eintrags, wie DESIGN.md sie beschreibt, braucht eine Vertragserweiterung.
 *
 * Nach dem Erfolg navigiert die Ansicht nicht selbst: Die Sitzung steht dann
 * auf `PROFILE_AUTHENTICATED`, und `LoginSchrittRoute` leitet weiter.
 */
export default function Namensauswahl() {
  const namensliste = useNamensliste()
  const waehlen = useNameWaehlen()
  const gast = useGastAnmelden()

  const [auswahl, setAuswahl] = useState('')
  const [gastName, setGastName] = useState('')
  const [stufe, setStufe] = useState<GastStufe>('MITTEL')
  const gastTitelId = useId()

  const namen = namensliste.data ?? []
  const istGast = auswahl === GAST
  const gewaehlt = istGast ? undefined : namen.find((n) => String(n.id) === auswahl)
  // Abgeleitet aus dem jeweils letzten Polling-Stand, nicht gespeichert.
  const gewaehltBelegt = gewaehlt?.belegt === true
  const gastNameBereinigt = gastName.trim()
  const gastNameGueltig =
    gastNameBereinigt.length >= GASTNAME_MIN && gastNameBereinigt.length <= GASTNAME_MAX

  const laeuft = waehlen.isPending || gast.isPending
  const bereit = istGast ? gastNameGueltig : gewaehlt !== undefined && !gewaehltBelegt

  // Der belegte Gastname gehört an das Feld, alle übrigen Fehler in den Kasten.
  const gastNameFehler =
    gast.error instanceof ApiFehler && gast.error.code === 'NAME_BELEGT' ? gast.error.message : null
  const aufrufFehler = waehlen.error ?? (gastNameFehler ? null : gast.error)
  // Scheitert ein Polling-Abruf, obwohl die Liste schon geladen ist, bleibt die
  // Liste stehen und die Ansicht bedienbar; gemeldet wird der Fehler im Kasten.
  // `failureReason` statt `error`: Es ist schon nach dem ersten Fehlschlag
  // gesetzt, nicht erst nach dem automatischen zweiten Versuch – sonst stünde
  // eine Sekunde lang der Offline-Hinweis da und wiche dann dieser Meldung.
  // Mit dem nächsten erfolgreichen Abruf wird es wieder `null`.
  //
  // **Immer nur eine Meldung**, in dieser Rangfolge: der Fehler der eigenen
  // Aktion (unten), der Fehler der Liste (direkt an der Liste, an Stelle ihres
  // Hinweises), der Hinweis auf einen zwischenzeitlich belegten Namen (unten).
  // Die Listenmeldung ersetzt den Hinweistext, statt eine weitere Zeile
  // anzuhängen: Mit gewähltem Gast füllt die Ansicht ein 360 × 780-Telefon
  // bereits vollständig, und jede zusätzliche Zeile löste Scrollen aus.
  const listenFehler =
    !aufrufFehler && namensliste.data !== undefined ? namensliste.failureReason : null
  const belegtHinweis =
    !listenFehler && gewaehltBelegt && gewaehlt
      ? `„${gewaehlt.name}" ist bereits angemeldet. Bitte wähle einen anderen Namen.`
      : null

  const knopfText = istGast
    ? gastNameGueltig
      ? `Weiter als ${gastNameBereinigt} (Gast)`
      : 'Weiter als Gast'
    : gewaehlt && !gewaehltBelegt
      ? `Weiter als ${gewaehlt.name}`
      : 'Weiter'

  /** Übernimmt eine neue Auswahl und verwirft Meldungen zur vorigen. */
  function auswahlAendern(wert: string) {
    setAuswahl(wert)
    waehlen.reset()
    gast.reset()
  }

  /** Sendet die Namenswahl oder die Gastanmeldung. */
  function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!bereit || laeuft) return
    if (istGast) gast.mutate({ gastName: gastNameBereinigt, stufe })
    else if (gewaehlt) waehlen.mutate(gewaehlt.id)
  }

  return (
    <form className={style.namensauswahl} onSubmit={absenden} noValidate data-testid="namensauswahl">
      <div className={style.bereich}>
        <div className={style.kopf}>
          <img
            className={style.logo}
            src="/icons/pwa/app-icon-96.png"
            alt="app-icon"
            width={50}
            height={50}
          />
          <h1 className={style.titel}>Wer bist du?</h1>
        </div>

        {namensliste.isPending ? (
          <Ladespinner groesse="gross" zentriert text="Namen werden geladen" />
        ) : namensliste.data === undefined ? (
          // Nur wenn noch nie eine Liste ankam – ein späterer Fehlschlag lässt
          // die vorhandene Liste stehen (siehe `listenFehler`).
          <Fehlerzustand
            fehler={namensliste.error}
            erneut={() => void namensliste.refetch()}
            ersatz="Die Namen konnten nicht geladen werden."
            data-testid="namensauswahl-ladefehler"
          />
        ) : (
          <div className={style.liste}>
            <Auswahlliste
              beschriftung="Dein Name"
              hinweis={
                listenFehler
                  ? undefined
                  : namen.length === 0
                    ? 'Es sind noch keine Spielerprofile angelegt. Du kannst als Gast teilnehmen.'
                    : 'Belegte Namen sind ausgegraut.'
              }
              optionen={[
                { wert: GAST, text: 'Gast', zusatz: 'ohne eigenes Profil' },
                // `deaktiviert` und der Zusatz: Die Aussage hängt nicht an der Farbe (A6).
                ...namen.map((n) => ({
                  wert: String(n.id),
                  text: n.name,
                  zusatz: n.belegt ? 'bereits angemeldet' : undefined,
                  deaktiviert: n.belegt,
                })),
              ]}
              wert={auswahl}
              beiAenderung={auswahlAendern}
              deaktiviert={laeuft}
              data-testid="namensauswahl-liste"
            />
            {listenFehler && (
              <Fehlermeldung
                fehler={listenFehler}
                ersatz="Die Namen konnten nicht aktualisiert werden."
                data-testid="namensauswahl-listenfehler"
              />
            )}
          </div>
        )}

        {istGast && (
          <section className={style.gast} aria-labelledby={gastTitelId} data-testid="namensauswahl-gast">
            <div className={style.gastKopf}>
              <h2 className={style.gastTitel} id={gastTitelId}>
                Als Gast anmelden
              </h2>
              <Erklaerung
                text={GAST_ERKLAERUNG}
                beschriftung="Was bedeutet Gast?"
                data-testid="gast-erklaerung"
              />
            </div>

            <Feld
              beschriftung="Dein Name für heute"
              hinweis={`Mindestens ${GASTNAME_MIN} und maximal ${GASTNAME_MAX} Zeichen.`}
              fehler={gastNameFehler}
              value={gastName}
              onChange={(e) => {
                setGastName(e.target.value)
                if (gastNameFehler) gast.reset()
              }}
              maxLength={GASTNAME_MAX}
              autoComplete="off"
              enterKeyHint="go"
              readOnly={laeuft}
              data-testid="gast-name"
            />

            <fieldset className={style.stufen} disabled={laeuft}>
              <legend className={style.stufenTitel}>Wie schätzt du dich ein?</legend>
              <div className={style.stufenReihe}>
                {STUFEN.map(({ wert, text }) => (
                  <label key={wert} className={style.stufe}>
                    <input
                      className={style.stufeEingabe}
                      type="radio"
                      name="gast-stufe"
                      value={wert}
                      checked={stufe === wert}
                      onChange={() => setStufe(wert)}
                      data-testid={`gast-stufe-${wert.toLowerCase()}`}
                    />
                    <span className={style.stufeText}>{text}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {aufrufFehler ? (
          <Fehlermeldung
            fehler={aufrufFehler}
            ersatz="Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut."
            data-testid="namensauswahl-meldung"
          />
        ) : (
          belegtHinweis && <Fehlermeldung data-testid="namensauswahl-meldung">{belegtHinweis}</Fehlermeldung>
        )}
      </div>

      <Aktionsleiste>
        <CustomButton
          type="submit"
          art="primaer"
          breit
          laedt={laeuft}
          disabled={!bereit}
          data-testid="namensauswahl-absenden"
        >
          {knopfText}
        </CustomButton>
      </Aktionsleiste>
    </form>
  )
}
