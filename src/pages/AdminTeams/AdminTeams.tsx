import { useEffect, useRef, useState } from 'react'
import type { GastStufe } from '@/api/admin/adminTermine'
import type { ManuelleGenerierung } from '@/api/admin/adminTeams'
import { verfahrenText } from '@/api/admin/konfigurationText'
import { skillsVollstaendig } from '@/api/admin/skills'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Feld from '@/components/Feld/Feld'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import StufeWahl from '@/components/StufeWahl/StufeWahl'
import TeamListen from '@/components/TeamListen/TeamListen'
import Textlink from '@/components/Textlink/Textlink'
import { useKonfiguration } from '@/hooks/admin/useKonfiguration'
import { useProfile } from '@/hooks/admin/useProfile'
import { useSkillKategorien } from '@/hooks/admin/useSkillKategorien'
import { useTeamsManuell } from '@/hooks/admin/useTeamsManuell'
import style from './AdminTeams.module.scss'

/** Höchstlänge des Gastnamens (Vertrag). */
const GAST_NAME_MAX = 40

/** Text des dauerhaften Hinweises (E18): Er steht oberhalb der Auswahl und bei jedem Ergebnis. */
const TEXT_NICHT_GESPEICHERT =
  'Die Einteilung wird nicht gespeichert, löst keine Einteilung eines Termins ab und ist für niemanden sonst sichtbar. Sie ist weg, sobald du die Seite verlässt.'

/** Ein übernommener Gast der Auswahl; `id` ist nur der Schlüssel der Zeile. */
type GastZeile = { id: number; name: string; stufe: GastStufe }

/** Der Gast, der gerade eingegeben wird: Er zählt erst nach „Übernehmen“ (24.10.2026). */
type GastEntwurf = { name: string; stufe: GastStufe }

const STUFEN_TEXT: Record<GastStufe, string> = { STARK: 'Stark', MITTEL: 'Mittel', SCHWACH: 'Schwach' }

/** Wohin der Fokus nach dem nächsten Render geht. */
type FokusZiel = { art: 'entwurf' } | { art: 'hinzufuegen' } | null

/**
 * Team-Generator (`/admin/teams`, C8 10.3, A24; bis 24.10.2026 „Teams ohne Termin“): Der Admin wählt Profile und frei angelegte Gäste und lässt Teams
 * berechnen – zum Ausprobieren, für einen Spieltag ohne Termin.
 *
 * **Nichts davon wird gespeichert** (E18): kein Schlüssel im Cache, das Ergebnis lebt im Zustand der Mutation und damit
 * dieser Seite; ein dauerhafter Hinweis steht über der Auswahl **und** bei jedem Ergebnis, sonst hielte der Admin es für die
 * Einteilung des Spieltags. Es gibt keinen Blocker beim Verlassen.
 *
 * **Ändert sich die Auswahl, verschwindet das Ergebnis** (`reset()`): Es zeigt nie eine andere Gruppe als die gewählte.
 * Auswählbar sind aktive Profile mit Rolle `USER`; eines mit **unvollständiger Skillkarte** (E7) ist deaktiviert mit dem
 * Grund als Text – der Server lehnte es sonst mit `409 SKILLWERTE_UNVOLLSTAENDIG` ab. Skillwerte stehen nirgends im DOM;
 * einzig die Zahl „Ungleichgewicht“ (`differenzTeamstaerke`) ist erlaubt und nur hier (A12).
 *
 * **Gäste in zwei Schritten** (24.10.2026): „Gast hinzufügen“ öffnet eine Eingabe (Name optional, Stufe), die der Admin
 * **übernimmt** oder **abbricht**. Erst ein übernommener Gast steht in der Liste, zählt mit und geht an den Server; solange
 * eine Eingabe offen ist, ist „Teams einteilen“ gesperrt (mit Grund), damit kein halb eingegebener Gast verloren geht.
 *
 * Der Zähler „Ausgewählt: n. Erlaubt: min bis max.“ nutzt die Konfiguration; „Teams berechnen“ ist außerhalb des Bereichs
 * `aria-disabled` mit Grund als Text. Der Server bleibt die Wahrheit. **Verfahren und Regel werden angezeigt, wie der Server
 * sie meldet** – sie können von der Konfiguration abweichen (über 24 Teilnehmer, keine Anmeldereihenfolge).
 */
export default function AdminTeams() {
  const profile = useProfile()
  const kategorien = useSkillKategorien()
  const konfiguration = useKonfiguration()
  const generieren = useTeamsManuell()
  const [auswahl, setAuswahl] = useState<ReadonlySet<number>>(new Set())
  const [gaeste, setGaeste] = useState<GastZeile[]>([])
  const [entwurf, setEntwurf] = useState<GastEntwurf | null>(null)
  const naechsteId = useRef(1)
  const [fokus, setFokus] = useState<FokusZiel>(null)
  const entwurfName = useRef<HTMLInputElement>(null)
  const hinzufuegenKnopf = useRef<HTMLButtonElement>(null)
  const ergebnisKopf = useRef<HTMLHeadingElement>(null)

  const einteilung = generieren.data

  // Fokus nach dem Render: Namensfeld der neuen Eingabe, „Gast hinzufügen“ nach Übernehmen, Abbrechen oder Entfernen.
  // Jedes `setFokus` legt ein neues Objekt an, der Effekt läuft also genau einmal je Auslöser.
  useEffect(() => {
    if (fokus?.art === 'entwurf') entwurfName.current?.focus()
    if (fokus?.art === 'hinzufuegen') hinzufuegenKnopf.current?.focus()
  }, [fokus])
  useEffect(() => {
    if (einteilung) ergebnisKopf.current?.focus()
  }, [einteilung])

  const alleProfile = profile.data
  if (!alleProfile) {
    return profile.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Profile werden geladen" />
    ) : (
      <Fehlerzustand fehler={profile.error} erneut={() => void profile.refetch()} data-testid="admin-teams-laden-fehler" />
    )
  }

  const vorhandeneKategorien = kategorien.data
  /** Ein Profil ist auswählbar: aktiver Spieler (nicht Admin, nicht gesperrt). Unvollständige sind sichtbar, aber gesperrt. */
  const spieler = alleProfile.filter((p) => p.rolle === 'USER' && p.aktiv)
  const unvollstaendig = (skills: Record<string, number>) =>
    vorhandeneKategorien !== undefined && !skillsVollstaendig(skills, vorhandeneKategorien)
  const waehlbar = new Set(spieler.filter((p) => !unvollstaendig(p.skills)).map((p) => p.spielerId))
  // Abgeleitet statt gespeichert: Ein inzwischen gesperrtes Profil fällt von selbst aus der Auswahl.
  const gewaehlteProfile = [...auswahl].filter((id) => waehlbar.has(id))
  const anzahl = gewaehlteProfile.length + gaeste.length

  const grenzen = konfiguration.data
  const min = grenzen?.minTeilnehmer
  const max = grenzen?.maxTeilnehmer
  const grund =
    entwurf !== null
      ? 'Bitte übernimm den Gast oder brich die Eingabe ab.'
      : anzahl === 0
      ? 'Bitte wähle Spieler oder füge Gäste hinzu.'
      : min !== undefined && anzahl < min
        ? `Es braucht mindestens ${String(min)} Teilnehmer.`
        : max !== undefined && anzahl > max
          ? `Es sind höchstens ${String(max)} Teilnehmer erlaubt.`
          : null
  const gesperrt = grund !== null

  /** Jede Änderung der Auswahl verwirft das Ergebnis: Es zeigt nie eine andere Gruppe. */
  function auswahlGeaendert() {
    if (!generieren.isIdle) generieren.reset()
  }

  function umschalten(id: number) {
    auswahlGeaendert()
    setAuswahl((alt) => {
      const neu = new Set(alt)
      if (neu.has(id)) neu.delete(id)
      else neu.add(id)
      return neu
    })
  }

  function alleWaehlen() {
    auswahlGeaendert()
    setAuswahl(new Set(waehlbar))
  }

  function keineWaehlen() {
    auswahlGeaendert()
    setAuswahl(new Set())
  }

  /** Öffnet die Eingabe eines Gastes; die Stufe ist sichtbar mit „Mittel“ vorbelegt. */
  function gastHinzufuegen() {
    setEntwurf({ name: '', stufe: 'MITTEL' })
    setFokus({ art: 'entwurf' })
  }

  /** Übernimmt die Eingabe in die Liste: Erst jetzt ändert sich die Auswahl. */
  function gastUebernehmen() {
    if (!entwurf) return
    auswahlGeaendert()
    const id = naechsteId.current
    naechsteId.current += 1
    setGaeste((alt) => [...alt, { id, ...entwurf }])
    setEntwurf(null)
    setFokus({ art: 'hinzufuegen' })
  }

  /** Verwirft die Eingabe; die Auswahl bleibt, wie sie war (auch ein vorhandenes Ergebnis). */
  function gastAbbrechen() {
    setEntwurf(null)
    setFokus({ art: 'hinzufuegen' })
  }

  function gastEntfernen(id: number) {
    auswahlGeaendert()
    setGaeste((alt) => alt.filter((g) => g.id !== id))
    setFokus({ art: 'hinzufuegen' })
  }

  /** Berechnet die Teams; „Erneut berechnen“ ist derselbe Aufruf. Leere Listen und leere Namen entfallen. */
  async function berechnen() {
    if (gesperrt || generieren.isPending) return
    const anfrage: ManuelleGenerierung = {
      ...(gewaehlteProfile.length > 0 ? { spielerIds: gewaehlteProfile } : {}),
      ...(gaeste.length > 0
        ? { gaeste: gaeste.map((g) => ({ stufe: g.stufe, ...(g.name.trim() !== '' ? { name: g.name.trim() } : {}) })) }
        : {}),
    }
    try {
      await generieren.mutateAsync(anfrage)
    } catch (fehler) {
      // Die Auswahl wurde verfälscht (Profil inzwischen gesperrt oder geschützt): Profile neu lesen.
      if (fehler instanceof ApiFehler && (fehler.status === 400 || fehler.code === 'PROFIL_GESCHUETZT')) void profile.refetch()
    }
  }

  const fehler = generieren.isError ? generieren.error : null
  const unvollstaendigFehler = fehler instanceof ApiFehler && fehler.code === 'SKILLWERTE_UNVOLLSTAENDIG'

  return (
    <div className={style.seite} data-testid="admin-teams">
      <h1 className={style.titel}>Team-Generator</h1>
      <Hinweis data-testid="teams-manuell-hinweis">{TEXT_NICHT_GESPEICHERT}</Hinweis>

      {fehler && (
        <div className={style.fehler}>
          <Fehlermeldung fehler={fehler} ersatz="Die Teams konnten nicht berechnet werden. Bitte versuche es erneut." data-testid="admin-teams-fehler" />
          {unvollstaendigFehler && (
            <Textlink to={ADMIN_PFADE.profile} data-testid="admin-teams-zu-profilen">
              Zu den Profilen
            </Textlink>
          )}
        </div>
      )}

      <fieldset className={style.gruppe}>
        <legend className={style.legende}>Spielerprofile</legend>
        <div className={style.textaktionen}>
          <button type="button" className={style.textaktion} onClick={alleWaehlen} data-testid="admin-teams-alle">
            Alle auswählen
          </button>
          <button type="button" className={style.textaktion} onClick={keineWaehlen} data-testid="admin-teams-keine">
            Keine
          </button>
        </div>
        {spieler.length === 0 ? (
          <p className={style.nebentext} data-testid="admin-teams-keine-profile">
            Es gibt keine aktiven Spielerprofile.
          </p>
        ) : (
          <ul className={style.liste}>
            {spieler.map((profil) => {
              const luecke = unvollstaendig(profil.skills)
              const grundId = `admin-teams-grund-${String(profil.spielerId)}`
              return (
                <li key={profil.spielerId}>
                  <label className={style.zeile} data-deaktiviert={luecke ? '' : undefined}>
                    <input
                      type="checkbox"
                      checked={!luecke && auswahl.has(profil.spielerId)}
                      disabled={luecke}
                      aria-describedby={luecke ? grundId : undefined}
                      onChange={() => {
                        umschalten(profil.spielerId)
                      }}
                      data-testid={`admin-teams-profil-${String(profil.spielerId)}`}
                    />
                    <span className={style.name}>{profil.name}</span>
                    {luecke && (
                      <span id={grundId} className={style.grund} data-testid={`admin-teams-unvollstaendig-${String(profil.spielerId)}`}>
                        Skillwerte unvollständig
                      </span>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </fieldset>

      <fieldset className={style.gruppe}>
        <legend className={style.legende}>Gäste</legend>
        {gaeste.length > 0 && (
          <ul className={style.gastListe} data-testid="admin-teams-gaeste">
            {gaeste.map((gast, index) => {
              const nummer = String(index + 1)
              const name = gast.name.trim() !== '' ? gast.name.trim() : `Gast ${nummer}`
              return (
                <li key={gast.id} className={style.gastZeile} data-testid={`admin-teams-gast-${nummer}`}>
                  <span className={style.gastText}>
                    <span className={style.name}>{name}</span>
                    <span className={style.nebentext}>Stufe: {STUFEN_TEXT[gast.stufe]}</span>
                  </span>
                  <CustomButton
                    art="gefahrUmriss"
                    aria-label={`Entfernen: ${name}`}
                    onClick={() => {
                      gastEntfernen(gast.id)
                    }}
                    data-testid={`admin-teams-gast-entfernen-${nummer}`}
                  >
                    Entfernen
                  </CustomButton>
                </li>
              )
            })}
          </ul>
        )}

        {entwurf ? (
          <div className={style.gast} data-testid="admin-teams-gast-eingabe">
            <p className={style.nebentext} data-testid="admin-teams-gast-hinweis">
              Ohne Namen heißt der Gast z.B. „Gast {String(gaeste.length + 1)}“.
            </p>
            <Feld
              beschriftung={`Name von Gast ${String(gaeste.length + 1)} (optional)`}
              value={entwurf.name}
              maxLength={GAST_NAME_MAX}
              autoComplete="off"
              ref={entwurfName}
              onChange={(e) => {
                setEntwurf({ ...entwurf, name: e.target.value })
              }}
              data-testid="admin-teams-gast-name"
            />
            <StufeWahl
              legende={`Stufe von Gast ${String(gaeste.length + 1)}`}
              wert={entwurf.stufe}
              beiAenderung={(stufe) => {
                setEntwurf({ ...entwurf, stufe })
              }}
              data-testid="admin-teams-gast-stufe"
            />
            <Knopfgruppe>
              <CustomButton art="sekundaer" onClick={gastAbbrechen} data-testid="admin-teams-gast-abbrechen">
                Abbrechen
              </CustomButton>
              <CustomButton art="akzent" onClick={gastUebernehmen} data-testid="admin-teams-gast-uebernehmen">
                Übernehmen
              </CustomButton>
            </Knopfgruppe>
          </div>
        ) : (
          <CustomButton
            ref={hinzufuegenKnopf}
            art="akzent"
            symbol="add_circle_icon_light"
            onClick={gastHinzufuegen}
            data-testid="admin-teams-gast-hinzufuegen"
          >
            Gast hinzufügen
          </CustomButton>
        )}
      </fieldset>

      {einteilung && (
        <section className={style.ergebnis} aria-labelledby="admin-teams-ergebnis-titel" data-testid="admin-teams-ergebnis">
          <h2 id="admin-teams-ergebnis-titel" tabIndex={-1} ref={ergebnisKopf} className={style.ergebnisTitel}>
            Ergebnis
          </h2>
          <Hinweis data-testid="teams-manuell-hinweis-ergebnis">{TEXT_NICHT_GESPEICHERT}</Hinweis>
          <TeamListen teamA={einteilung.teamA} teamB={einteilung.teamB} data-testid="admin-teams-ergebnis-teams" />

          <div className={style.angaben}>
            <p data-testid="admin-teams-verfahren">Algorithmus-Typ: {verfahrenText(einteilung.algorithmType)}</p>
            {grenzen && grenzen.algorithmType !== einteilung.algorithmType && (
              <p className={style.nebentext} data-testid="admin-teams-verfahren-abweichung">
                Abweichend von der Einstellung, weil die Gruppe für das Standard-Verfahren zu groß ist.
              </p>
            )}
            {grenzen && grenzen.auswechselModus !== einteilung.auswechselModus && (
              <p className={style.nebentext} data-testid="admin-teams-regel-abweichung">
                Für diese Berechnung gibt es keine Anmeldereihenfolge; es gilt der schwächste Spieler des größeren Teams.
              </p>
            )}
          </div>
        </section>
      )}

      <Aktionsleiste>
        <div className={style.leiste}>
          <p className={style.zaehler} data-testid="admin-teams-zaehler">
            Ausgewählt: {String(anzahl)}.
            {min !== undefined && max !== undefined && ` Erlaubt: ${String(min)} bis ${String(max)}.`}
          </p>
          {gesperrt && (
            <p id="admin-teams-grund" className={style.nebentext} data-testid="admin-teams-grund">
              {grund}
            </p>
          )}
          <CustomButton
            art="primaer"
            breit
            symbol="football_icon_dark"
            className={style.aktion}
            laedt={generieren.isPending && !einteilung}
            aria-disabled={gesperrt ? true : undefined}
            aria-describedby={gesperrt ? 'admin-teams-grund' : undefined}
            onClick={() => void berechnen()}
            data-testid="admin-teams-berechnen"
          >
            Teams einteilen
          </CustomButton>
        </div>
      </Aktionsleiste>
    </div>
  )
}
