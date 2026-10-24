import { useState } from 'react'
import type { GastStufe } from '@/api/admin/adminTermine'
import type { TeilnehmerEintrag, TerminDetails } from '@/api/termine/termine'
import { datumKurz, uhrzeitKurz } from '@/api/termine/terminZeit'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import StufeWahl from '@/components/StufeWahl/StufeWahl'
import type { GastPlatzInfo } from '@/api/admin/adminKonfiguration'
import type { TerminMitGaesten } from '@/hooks/admin/useGaesteInTerminen'
import { useGastAbsagen } from '@/hooks/admin/useGastAbsagen'
import { useGastStufe } from '@/hooks/admin/useGastStufe'
import style from './AdminGaeste.module.scss'

const FEHLER_ERSATZ = 'Die Stufe konnte nicht geändert werden. Bitte versuche es erneut.'
const FEHLER_ERSATZ_ENTFERNEN = 'Der Gast konnte nicht entfernt werden. Bitte versuche es erneut.'

const STUFEN_TEXT: Record<GastStufe, string> = { STARK: 'Stark', MITTEL: 'Mittel', SCHWACH: 'Schwach' }

/** Woher die angezeigte Stufe stammt; bestimmt die Beschriftung. */
type StufenQuelle = { stufe: GastStufe; quelle: 'teilnahme' | 'anmeldung' } | null

/**
 * Die Stufe eines Gastes an einem Termin, aus der sichersten verfügbaren Quelle:
 *
 * 1. `gastStufe` der Teilnahme (Vertrag seit 24.10.2026; nur für den Admin, nur bei Gästen): die Stufe, mit der der
 *    Generator an **diesem** Termin rechnet – die Selbsteinschätzung (ohne Angabe `MITTEL`) oder die Korrektur.
 * 2. Sonst ein **belegter** Gastplatz gleichen Namens: die Selbsteinschätzung der laufenden Anmeldung. Sie kann von der
 *    Stufe am Termin abweichen (Korrektur durch den Admin) und heißt deshalb ausdrücklich „Selbsteinschätzung“.
 * 3. Sonst nichts. Der Vertrag nennt das Feld optional („ein Client muss das Fehlen erwarten“); die Stufen 2 und 3 sind
 *    die Rückfallebene dafür, nicht der Normalfall.
 */
function stufeVon(eintrag: TeilnehmerEintrag, plaetze: readonly GastPlatzInfo[] | undefined): StufenQuelle {
  if (eintrag.gastStufe) return { stufe: eintrag.gastStufe, quelle: 'teilnahme' }
  const platz = plaetze?.find((p) => p.belegt && p.gastName === eintrag.anzeigeName)
  return platz?.gastStufe ? { stufe: platz.gastStufe, quelle: 'anmeldung' } : null
}

/** Die Stufe als Satz; ohne Quelle sagt er, warum sie fehlt. */
function stufenText(quelle: StufenQuelle): string {
  if (!quelle) return 'Stufe: nicht bekannt (der Gast ist nicht angemeldet)'
  return `Aktuelle Stufe: ${STUFEN_TEXT[quelle.stufe]}`
}

/** Eigenschaften der Gästeliste je Termin. */
type GaesteInTerminenEigenschaften = {
  /** Kommende Termine mit mindestens einem Gast. */
  termine: readonly TerminMitGaesten[]
  /** Die Gastplätze, soweit gelesen: Quelle der Vorauswahl. */
  plaetze: readonly GastPlatzInfo[] | undefined
  /**
   * Ein Gast wurde entfernt: Die Zeile samt gedrückter Schaltfläche ist weg. Der Aufrufer zeigt `text` und setzt den
   * Fokus (sonst läge er auf `body`).
   */
  beiEntfernt: (text: string) => void
}

/** Der Gast, um den es im Dialog gerade geht. */
type Ziel = { termin: TerminDetails; eintrag: TeilnehmerEintrag }

/**
 * Die Gäste der kommenden Termine mit „Stufe ändern“ (Gäste-Verwaltung; vorher Abschnitt „Gäste“ der
 * Terminverwaltung, E13).
 *
 * - Je Termin eine Überschrift (`h3`, Datum und Uhrzeit), darunter eine Zeile je Gast: Name mit „(Gast)“, „wartet“ bei
 *   Warteschlange, „Stufe ändern“. **Ein** Dialog für alle Zeilen, damit jede Test-ID einmal vorkommt.
 * - **Stufe je Gast sichtbar** (seit 24.10.2026) und **Vorauswahl** im Dialog aus derselben Quelle (`stufeVon`): die
 *   Stufe der Teilnahme, sobald der Server sie liefert, sonst die Selbsteinschätzung eines belegten Gastplatzes gleichen
 *   Namens, sonst keine – eine unsichtbare Vorgabe würde eine Stufe behaupten, die niemand kennt.
 * - **Ohne Wahl wird nichts gesendet:** Die Bestätigung bleibt bedienbar und meldet am Feld „Bitte wähle eine Stufe.“
 * - Der Name geht **unverändert** aus der Teilnehmerliste hinaus (ohne „(Gast)“, ohne Trimmen).
 * - `404`: Der Gast hat seine Zusage inzwischen zurückgezogen; der Dialog zeigt den Text des Servers, der Hook liest die
 *   Termine neu und die Zeile verschwindet.
 *
 * **„Entfernen“ (seit 24.10.2026, Entscheidung des Entwicklers):** Ein Gast ohne Konto kann nach Ablauf seiner Sitzung
 * oft nicht mehr selbst absagen. Der Admin nimmt die Zusage zurück; der Server wertet das **als Absage des Gastes**
 * (`gastAbsagen`, im Vertrag seit 24.10.2026; idempotent, Sitzung und Gastplatz des Gastes bleiben).
 * Rot umrandet wie die anderen endgültigen Aktionen, die Bestätigung nennt die Folgen; rot gefüllt ist erst sie.
 */
export default function GaesteInTerminen({ termine, plaetze, beiEntfernt }: GaesteInTerminenEigenschaften) {
  const [ziel, setZiel] = useState<Ziel | null>(null)
  const [gewaehlt, setGewaehlt] = useState<GastStufe | null>(null)
  const [ohneWahl, setOhneWahl] = useState(false)
  const aendern = useGastStufe()
  const [entfernenZiel, setEntfernenZiel] = useState<Ziel | null>(null)
  const entfernen = useGastAbsagen()

  const bekannt: GastStufe | null = ziel ? (stufeVon(ziel.eintrag, plaetze)?.stufe ?? null) : null
  const wert = gewaehlt ?? bekannt

  function oeffnen(termin: TerminDetails, eintrag: TeilnehmerEintrag) {
    aendern.reset()
    setGewaehlt(null)
    setOhneWahl(false)
    setZiel({ termin, eintrag })
  }

  function schliessen() {
    aendern.reset()
    setZiel(null)
  }

  function entfernenOeffnen(termin: TerminDetails, eintrag: TeilnehmerEintrag) {
    entfernen.reset()
    setEntfernenZiel({ termin, eintrag })
  }

  async function entfernenAusfuehren() {
    if (!entfernenZiel || entfernen.isPending) return
    const { termin, eintrag } = entfernenZiel
    try {
      await entfernen.mutateAsync({ terminId: termin.terminId, gastName: eintrag.anzeigeName })
      setEntfernenZiel(null)
      beiEntfernt(`${eintrag.anzeigeName} (Gast) ist am ${datumKurz(termin.datum)} nicht mehr dabei.`)
    } catch {
      // Der Fehler steht im Dialog.
    }
  }

  async function speichern() {
    if (!ziel || aendern.isPending) return
    if (wert === null) {
      setOhneWahl(true)
      return
    }
    try {
      await aendern.mutateAsync({ terminId: ziel.termin.terminId, gastName: ziel.eintrag.anzeigeName, stufe: wert })
      setZiel(null)
    } catch {
      // Der Fehler steht im Dialog.
    }
  }

  return (
    <>
      <ul className={style.terminListe}>
        {termine.map(({ termin, gaeste }) => {
          const titelId = `admin-gaeste-termin-${String(termin.terminId)}`
          return (
            <li key={termin.terminId} className={style.termin} data-testid={titelId}>
              <h3 id={titelId} className={style.terminTitel}>
                {datumKurz(termin.datum)} · {uhrzeitKurz(termin.uhrzeit)} Uhr
              </h3>
              {termin.ort && <p className={style.angabe}>{termin.ort}</p>}
              <ul className={style.gastListe}>
                {gaeste.map((eintrag) => (
                  <li key={eintrag.position} className={style.gastZeile}>
                    <p className={style.gastName}>
                      {eintrag.anzeigeName} (Gast)
                      {eintrag.wartet && <span className={style.angabe}> · wartet</span>}
                    </p>
                    <p
                      className={style.angabe}
                      data-testid={`admin-gast-stufe-anzeige-${String(termin.terminId)}-${String(eintrag.position)}`}
                    >
                      {stufenText(stufeVon(eintrag, plaetze))}
                    </p>
                    <Knopfgruppe>
                      <CustomButton
                        art="sekundaer"
                        aria-label={`Stufe ändern: ${eintrag.anzeigeName} (Gast)`}
                        onClick={() => {
                          oeffnen(termin, eintrag)
                        }}
                        data-testid={`admin-gast-stufe-${String(termin.terminId)}-${String(eintrag.position)}`}
                      >
                        Stufe ändern
                      </CustomButton>
                      <CustomButton
                        art="gefahrUmriss"
                        aria-label={`Entfernen: ${eintrag.anzeigeName} (Gast) aus dem Termin`}
                        onClick={() => {
                          entfernenOeffnen(termin, eintrag)
                        }}
                        data-testid={`admin-gast-entfernen-${String(termin.terminId)}-${String(eintrag.position)}`}
                      >
                        Entfernen
                      </CustomButton>
                    </Knopfgruppe>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ul>

      <Bestaetigung
        offen={ziel !== null}
        titel="Stufe ändern?"
        bestaetigenText="Speichern"
        art="primaer"
        laedt={aendern.isPending}
        fehler={aendern.error}
        fehlerErsatz={FEHLER_ERSATZ}
        beiBestaetigen={() => void speichern()}
        beiAbbruch={schliessen}
        data-testid="admin-gast-stufe-dialog"
      >
        <p>
          Nach Änderung gilt die vorhandene Teameinteilung als veraltet. Die Teams müssen anschließend neu generiert werden.
        </p>
        {bekannt === null && <p className={style.angabe}>Die aktuelle Stufe liegt nicht vor. Bitte wähle eine.</p>}
        <StufeWahl
          legende="Neue Stufe"
          wert={wert}
          beiAenderung={(stufe) => {
            setGewaehlt(stufe)
            setOhneWahl(false)
          }}
          schreibgeschuetzt={aendern.isPending}
          fehler={ohneWahl && wert === null ? 'Bitte wähle eine Stufe.' : null}
          data-testid="admin-gast-stufe-wahl"
        />
      </Bestaetigung>

      <Bestaetigung
        offen={entfernenZiel !== null}
        titel="Gast aus dem Termin entfernen?"
        bestaetigenText="Entfernen"
        art="gefahr"
        laedt={entfernen.isPending}
        fehler={entfernen.error}
        fehlerErsatz={FEHLER_ERSATZ_ENTFERNEN}
        beiBestaetigen={() => void entfernenAusfuehren()}
        beiAbbruch={() => {
          // Nur reagieren, solange der Dialog offen ist: `Dialog` meldet auch das Schließen nach dem Erfolg.
          if (entfernenZiel === null) return
          entfernen.reset()
          setEntfernenZiel(null)
        }}
        data-testid="admin-gast-entfernen-dialog"
      >
        <p>
          {entfernenZiel?.eintrag.anzeigeName} (Gast) wird für {entfernenZiel ? datumKurz(entfernenZiel.termin.datum) : ''} aus dem Termin entfernt. 
          Wer wartet, rückt nach; eine vorhandene Teameinteilung gilt danach als veraltet.
        </p>
      </Bestaetigung>
    </>
  )
}
