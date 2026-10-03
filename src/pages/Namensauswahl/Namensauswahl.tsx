import { useId, useState, type SubmitEvent } from 'react'
import type { GastStufe } from '@/api/auth/auth'
import { ApiFehler, istNetzfehler } from '@/api/common/fehler'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import Auswahlliste from '@/components/Auswahlliste/Auswahlliste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Erklaerung from '@/components/Erklaerung/Erklaerung'
import Feld from '@/components/Feld/Feld'
import Icon from '@/components/Icon/Icon'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import { useGastAnmelden } from '@/hooks/useGastAnmelden'
import { useNameWaehlen } from '@/hooks/useNameWaehlen'
import { useNamensliste } from '@/hooks/useNamensliste'
import style from './Namensauswahl.module.scss'

/** Wert des Gast-Eintrags in der Auswahlliste; Profil-Ids sind Zahlen. */
const GAST = 'gast'

/** Grenzen des Gastnamens laut Kontrakt (`GastAnmeldungRequest`). */
const GASTNAME_MIN = 2
const GASTNAME_MAX = 40

/** Die drei Stufen der Selbsteinschätzung (A8, A17), in aufsteigender Reihenfolge. */
const STUFEN: { wert: GastStufe; text: string }[] = [
  { wert: 'SCHWACH', text: 'Schwach' },
  { wert: 'MITTEL', text: 'Mittel' },
  { wert: 'STARK', text: 'Stark' },
]

/** Kurze Erklärung am Gastbereich (A8). */
const GAST_ERKLAERUNG =
  'Als Gast spielst du ohne eigenes Profil mit. Dein Name gilt nur für diese Sitzung und ' +
  'erscheint mit dem Zusatz „(Gast)". Deine Selbsteinschätzung hilft, die Teams ' +
  'ausgeglichen einzuteilen.'

/**
 * Formuliert den Text eines fehlgeschlagenen Aufrufs.
 *
 * Bei einer Antwort des Servers dessen `detail`, sonst eigene Worte – nur dann
 * gibt es kein `detail`.
 *
 * @param fehler Der Fehler des Aufrufs.
 * @returns Der anzuzeigende Text.
 */
function fehlertextBilden(fehler: Error): string {
  if (fehler instanceof ApiFehler) return fehler.message
  if (istNetzfehler(fehler)) return 'Der Server ist nicht erreichbar. Bitte prüfe deine Verbindung.'
  return 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.'
}

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
 * erscheinen Name, Selbsteinschätzung (Vorgabe „Mittel") und ein Info-Symbol
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
  const meldung = aufrufFehler
    ? fehlertextBilden(aufrufFehler)
    : gewaehltBelegt && gewaehlt
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
        ) : namensliste.isError ? (
          <div className={style.ladefehler} role="alert" data-testid="namensauswahl-ladefehler">
            <p className={style.meldungText}>
              <Icon name="error_circle_icon" />
              <span>{fehlertextBilden(namensliste.error)}</span>
            </p>
            <CustomButton onClick={() => void namensliste.refetch()} data-testid="namensauswahl-erneut">
              Erneut versuchen
            </CustomButton>
          </div>
        ) : (
          <Auswahlliste
            beschriftung="Dein Name"
            hinweis={
              namen.length === 0
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
              hinweis={`Mindestens ${GASTNAME_MIN} bis maximal ${GASTNAME_MAX} Zeichen.`}
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

        {meldung && (
          <p className={style.meldung} role="alert" data-testid="namensauswahl-meldung">
            <Icon name="error_circle_icon" />
            <span>{meldung}</span>
          </p>
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
