import { useState } from 'react'
import type { GastStufe } from '@/api/admin/adminTermine'
import type { TeilnehmerEintrag, TerminDetails } from '@/api/termine/termine'
import Bestaetigung from '@/components/Bestaetigung/Bestaetigung'
import CustomButton from '@/components/CustomButton/CustomButton'
import StufeWahl from '@/components/StufeWahl/StufeWahl'
import { useGastplaetze } from '@/hooks/admin/useGastplaetze'
import { useGastStufe } from '@/hooks/admin/useGastStufe'
import style from './AdminTerminDetail.module.scss'

const FEHLER_ERSATZ = 'Die Stufe konnte nicht geändert werden. Bitte versuche es erneut.'

/** Eigenschaften der Gästeliste. */
type GastStufeListeEigenschaften = {
  termin: TerminDetails
}

/**
 * Abschnitt „Gäste“ der Terminverwaltung (C8 9.4, E13): Die Skill-Stufe eines Gastes an **diesem** Termin korrigieren.
 *
 * - Nur bei `GEPLANT` (der Aufrufer prüft das) und mindestens einem Gast in der Teilnehmerliste; sonst gibt es keinen
 *   Abschnitt. Eine Zeile je Gast: Name mit „(Gast)“, „wartet“ bei Warteschlange, „Stufe ändern“.
 * - **Vorauswahl nur aus gesicherter Quelle:** Die Teilnehmerliste enthält keine Stufe (A12). Der Dialog liest erst beim
 *   Öffnen die Gastplätze und wählt vor, wenn dort ein belegter Platz **gleichen Namens** steht. Sonst gibt es keine
 *   Vorauswahl – eine unsichtbare Vorgabe würde eine Stufe behaupten, die niemand kennt.
 * - **Ohne Wahl wird nichts gesendet:** Die Bestätigung bleibt bedienbar, meldet aber am Feld „Bitte wähle eine Stufe.“
 *   (`aria-disabled`-Muster: der Grund steht im Text, nicht in einer stummen Sperre).
 * - Der Name geht **unverändert** aus der Teilnehmerliste hinaus (ohne „(Gast)“, ohne Trimmen).
 * - `404`: Der Gast hat sich inzwischen abgemeldet; der Dialog zeigt den Text des Servers („Für diesen Termin liegt keine
 *   Teilnahme dieses Gastes vor.“), der Termin wird neu gelesen (im Hook) und die Zeile verschwindet.
 */
export default function GastStufeListe({ termin }: GastStufeListeEigenschaften) {
  const gaeste = termin.teilnehmerliste.teilnehmer.filter((eintrag) => eintrag.gast)
  const [ziel, setZiel] = useState<TeilnehmerEintrag | null>(null)
  const [gewaehlt, setGewaehlt] = useState<GastStufe | null>(null)
  const [ohneWahl, setOhneWahl] = useState(false)
  const aendern = useGastStufe()
  const plaetze = useGastplaetze(ziel !== null)

  if (gaeste.length === 0) return null

  const platz = ziel ? plaetze.data?.find((p) => p.belegt && p.gastName === ziel.anzeigeName) : undefined
  const bekannt: GastStufe | null = platz?.gastStufe ?? null
  const wert = gewaehlt ?? bekannt
  const ladeNochDieStufe = ziel !== null && plaetze.isPending

  function oeffnen(eintrag: TeilnehmerEintrag) {
    aendern.reset()
    setGewaehlt(null)
    setOhneWahl(false)
    setZiel(eintrag)
  }

  function schliessen() {
    aendern.reset()
    setZiel(null)
  }

  async function speichern() {
    if (!ziel || aendern.isPending) return
    if (wert === null) {
      setOhneWahl(true)
      return
    }
    try {
      await aendern.mutateAsync({ terminId: termin.terminId, gastName: ziel.anzeigeName, stufe: wert })
      setZiel(null)
    } catch {
      // Der Fehler steht im Dialog.
    }
  }

  return (
    <section className={style.abschnitt} aria-labelledby="admin-termin-gaeste-titel" data-testid="admin-termin-gaeste-abschnitt">
      <h2 id="admin-termin-gaeste-titel" className={style.abschnittTitel}>
        Gäste
      </h2>
      <ul className={style.gastListe}>
        {gaeste.map((eintrag) => (
          <li key={eintrag.position} className={style.gastZeile}>
            <p className={style.gastName}>
              {eintrag.anzeigeName} (Gast)
              {eintrag.wartet && <span className={style.nebentext}> · wartet</span>}
            </p>
            <CustomButton
              art="sekundaer"
              aria-label={`Stufe von ${eintrag.anzeigeName} (Gast) ändern`}
              onClick={() => {
                oeffnen(eintrag)
              }}
              data-testid={`admin-gast-stufe-${String(eintrag.position)}`}
            >
              Stufe ändern
            </CustomButton>
          </li>
        ))}
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
          Stufe von {ziel?.anzeigeName} (Gast) an diesem Termin. Die Änderung zählt als Änderung des Teilnehmerkreises:
          Eine vorhandene Teameinteilung gilt danach als veraltet, das Kontingent steht wieder zur Verfügung.
        </p>
        {ladeNochDieStufe ? (
          <p className={style.nebentext}>Die aktuelle Stufe wird geladen.</p>
        ) : (
          bekannt === null && <p className={style.nebentext}>Die aktuelle Stufe liegt nicht vor. Bitte wähle eine.</p>
        )}
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
    </section>
  )
}
