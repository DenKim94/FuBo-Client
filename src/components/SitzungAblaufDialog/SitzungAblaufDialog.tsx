import { useId, useState, type CSSProperties } from 'react'
import CustomButton from '@/components/CustomButton/CustomButton'
import Dialog from '@/components/Dialog/Dialog'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Icon from '@/components/Icon/Icon'
import { useAbmelden } from '@/hooks/useAbmelden'
import { useRestlaufzeit, WARNZEIT_MS } from '@/hooks/useRestlaufzeit'
import { useSitzungErneuern } from '@/hooks/useSitzungErneuern'
import style from './SitzungAblaufDialog.module.scss'

/**
 * Dialog kurz vor dem Ablauf der Sitzung (A14, Prototyp 16).
 *
 * Erscheint {@link WARNZEIT_MS} vor dem Ende, mit den Optionen „Sitzung
 * verlängern" und „Abmelden". Rendert nichts Sichtbares, solange das Ende fern
 * ist; der Dialog bleibt im Baum und wird über `offen` gesteuert, damit der
 * Browser beim Schliessen den Fokus dorthin zurückgibt, wo die Person war.
 *
 * **Zwei Fälle** (DESIGN.md, „Besonderheit: Sitzungsablauf"):
 * 1. *Verlängerbar* – das Leerlauf-Fenster endet vor der harten Obergrenze. Der
 *    Dialog **hält fest** (`festhalten`): Escape und die Zurück-Geste schliessen
 *    ihn nicht, denn die Person soll entscheiden. Ohne Entscheidung bliebe die
 *    Ansicht dahinter ohnehin nur bis zum Ende bedienbar.
 * 2. *Nicht mehr verlängerbar* – die harte Obergrenze ist erreicht. „Verlängern"
 *    wäre wirkungslos, deshalb fehlt die Schaltfläche, und der Text sagt es
 *    ruhig und ohne Fehlerton: Es ist der Normalfall einer langen Sitzung, kein
 *    Versagen. Statt dessen „Weiterarbeiten": Die Person kann ihre Eingabe
 *    beenden; der Dialog kommt nicht wieder. Escape zählt hier als
 *    „Weiterarbeiten".
 *
 * **Eingaben bleiben erhalten:** Der Dialog legt sich über die Ansicht, ohne sie
 * zu verändern oder neu zu laden; der Fokus kehrt beim Schliessen in das Feld
 * zurück, in dem die Person war. Dass er beim Öffnen auf die erste
 * Schaltfläche wandert (Standard von `showModal`), ist gewollt: Die steht auf
 * „Sitzung verlängern", einer Aktion ohne Verlust. Ein versehentlicher
 * Tastendruck beim Weitertippen verlängert höchstens – abmelden könnte er nicht.
 *
 * **Abweichungen vom Prototyp:**
 * - Der Griff oben am Sheet fehlt: Er verspricht Wegwischen, und das wäre bei
 *   einem festgehaltenen Dialog gelogen.
 * - Der Satz „Nicht gespeicherte Eingaben werden dann zwischengespeichert"
 *   fehlt: Der Client speichert nichts zwischen (kein Token, keine Eingaben im
 *   Browserspeicher). Statt dessen steht, was wirklich geschieht.
 * - Der Balken zeigt den Rest der Warnzeit, nicht des ganzen Fensters – dessen
 *   Länge kennt der Client nicht (der Server liefert nur die Zeitpunkte).
 * - Keine Restzeit als Zahl (Entscheidung vom 04.10.2026): Der Text sagt „gleich",
 *   der Balken zeigt den Verlauf. Der Prototyp nennt die Minuten.
 *
 * Gehört in den geschützten Bereich (`GeschuetzteRoute`): Er setzt eine
 * abgeschlossene Anmeldung voraus und unterbricht sonst Login-Schritte.
 */
export default function SitzungAblaufDialog() {
  const { restMs, verlaengerbar, warnen } = useRestlaufzeit()
  const verlaengerung = useSitzungErneuern()
  const abmeldung = useAbmelden()
  // Nur für den Fall „nicht mehr verlängerbar": Die Person hat gelesen und
  // arbeitet weiter. Die Obergrenze wandert nie, der Dialog käme sonst jede
  // Sekunde wieder.
  const [weiterarbeiten, setWeiterarbeiten] = useState(false)
  const beschreibungId = useId()

  const offen = warnen && restMs !== null && !(weiterarbeiten && !verlaengerbar)
  const beschaeftigt = verlaengerung.isPending || abmeldung.isPending
  // Immer nur ein Fehler: `beimVerlaengern` und `beimAbmelden` setzen den
  // jeweils anderen Aufruf zurück, bevor sie ihren starten.
  const fehler = abmeldung.error ?? verlaengerung.error

  // Escape oder Zurück-Geste: im festgehaltenen Fall nie, im anderen gilt es
  // als „Weiterarbeiten". Das Schliessen über `offen` meldet sich hier ebenfalls
  // – dann ist `verlaengerbar` wahr und der Zustand bleibt, wie er ist.
  function beimSchliessen() {
    if (!verlaengerbar) setWeiterarbeiten(true)
  }

  function beimVerlaengern() {
    abmeldung.reset()
    verlaengerung.mutate()
  }

  function beimAbmelden() {
    verlaengerung.reset()
    abmeldung.mutate()
  }

  const anteil = restMs === null ? 0 : Math.min(100, (restMs / WARNZEIT_MS) * 100)

  return (
    <Dialog
      offen={offen}
      titel={verlaengerbar ? 'Sitzung läuft ab' : 'Sitzung endet bald'}
      festhalten={verlaengerbar}
      aufSchliessen={beimSchliessen}
      symbol={
        <span className={style.symbol}>
          <Icon name="warning_icon" groesse={1.75} />
        </span>
      }
      beschreibungId={beschreibungId}
      data-testid="sitzung-ablauf-dialog"
    >
      <p id={beschreibungId} className={style.text} data-testid="sitzung-ablauf-text">
        {verlaengerbar
          ? 'Deine Sitzung läuft gleich ab. Verlängere sie, um weiterzuarbeiten.'
          : 'Deine Sitzung endet gleich und lässt sich nicht mehr verlängern. Schließe deine Eingabe jetzt ab; danach ist ein erneuter Login nötig.'}
      </p>

      {/* Der Balken ist die einzige Zeitanzeige und bewusst Schmuck: Die Dringlichkeit
          steht im Text („gleich"), eine tickende Zahl läse ein Screenreader nicht
          sinnvoll vor. */}
      <div className={style.spur} aria-hidden="true" data-testid="sitzung-ablauf-balken">
        <div
          className={style.fuellung}
          style={{ '--fuellung-anteil': `${anteil}%` } as CSSProperties}
        />
      </div>

      {fehler && <Fehlermeldung fehler={fehler} data-testid="sitzung-ablauf-fehler" />}

      <div className={style.aktionen}>
        {verlaengerbar ? (
          <CustomButton
            art="primaer"
            breit
            laedt={verlaengerung.isPending}
            disabled={abmeldung.isPending}
            onClick={beimVerlaengern}
            data-testid="sitzung-ablauf-verlaengern"
          >
            Sitzung verlängern
          </CustomButton>
        ) : (
          <CustomButton
            art="primaer"
            breit
            disabled={beschaeftigt}
            onClick={() => setWeiterarbeiten(true)}
            data-testid="sitzung-ablauf-weiterarbeiten"
          >
            Schließen
          </CustomButton>
        )}
        <CustomButton
          art="sekundaer"
          breit
          laedt={abmeldung.isPending}
          disabled={verlaengerung.isPending}
          onClick={beimAbmelden}
          data-testid="sitzung-ablauf-abmelden"
        >
          Abmelden
        </CustomButton>
      </div>

      <p className={style.hinweis}>Ohne Reaktion wirst du automatisch abgemeldet.</p>
    </Dialog>
  )
}
