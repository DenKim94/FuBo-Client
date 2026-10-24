import { useEffect, useRef, useState } from 'react'
import type { GastStufe } from '@/api/admin/adminTermine'
import type { ManuelleGenerierung } from '@/api/admin/adminTeams'
import { regelText, verfahrenText } from '@/api/admin/konfigurationText'
import { skillsVollstaendig } from '@/api/admin/skills'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Feld from '@/components/Feld/Feld'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
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

/** Ein frei angelegter Gast der Auswahl; `id` ist nur der Schlüssel der Zeile. */
type GastZeile = { id: number; name: string; stufe: GastStufe }

/** Wohin der Fokus nach dem nächsten Render geht. */
type FokusZiel = { art: 'neuer-gast'; id: number } | { art: 'hinzufuegen' } | null

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
  const naechsteId = useRef(1)
  const [fokus, setFokus] = useState<FokusZiel>(null)
  const namensfelder = useRef(new Map<number, HTMLInputElement>())
  const hinzufuegenKnopf = useRef<HTMLButtonElement>(null)
  const ergebnisKopf = useRef<HTMLHeadingElement>(null)

  const einteilung = generieren.data

  // Fokus nach dem Render: neue Gastzeile, „Gast hinzufügen“ nach dem Entfernen, Überschrift des Ergebnisses. Jedes
  // `setFokus` legt ein neues Objekt an, der Effekt läuft also genau einmal je Auslöser.
  useEffect(() => {
    if (fokus?.art === 'neuer-gast') namensfelder.current.get(fokus.id)?.focus()
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
    anzahl === 0
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

  function gastHinzufuegen() {
    auswahlGeaendert()
    const id = naechsteId.current
    naechsteId.current += 1
    setGaeste((alt) => [...alt, { id, name: '', stufe: 'MITTEL' }])
    setFokus({ art: 'neuer-gast', id })
  }

  function gastAendern(id: number, teil: Partial<Omit<GastZeile, 'id'>>) {
    auswahlGeaendert()
    setGaeste((alt) => alt.map((g) => (g.id === id ? { ...g, ...teil } : g)))
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
          <>
            <p className={style.nebentext} data-testid="admin-teams-gast-hinweis">
              Ohne Namen heißt der Gast Gast 1, Gast 2 …
            </p>
            <ul className={style.liste}>
              {gaeste.map((gast, index) => (
                <li key={gast.id} className={style.gast} data-testid={`admin-teams-gast-${String(index + 1)}`}>
                  <Feld
                    beschriftung={`Name von Gast ${String(index + 1)} (optional)`}
                    value={gast.name}
                    maxLength={GAST_NAME_MAX}
                    autoComplete="off"
                    ref={(element) => {
                      if (element) namensfelder.current.set(gast.id, element)
                      else namensfelder.current.delete(gast.id)
                    }}
                    onChange={(e) => {
                      gastAendern(gast.id, { name: e.target.value })
                    }}
                    data-testid={`admin-teams-gast-name-${String(index + 1)}`}
                  />
                  <StufeWahl
                    legende={`Stufe von Gast ${String(index + 1)}`}
                    wert={gast.stufe}
                    beiAenderung={(stufe) => {
                      gastAendern(gast.id, { stufe })
                    }}
                    data-testid={`admin-teams-gast-stufe-${String(index + 1)}`}
                  />
                  <CustomButton
                    art="sekundaer"
                    aria-label={`Gast ${String(index + 1)} entfernen`}
                    onClick={() => {
                      gastEntfernen(gast.id)
                    }}
                    data-testid={`admin-teams-gast-entfernen-${String(index + 1)}`}
                  >
                    Entfernen
                  </CustomButton>
                </li>
              ))}
            </ul>
          </>
        )}
        <CustomButton 
          ref={hinzufuegenKnopf} 
          art="akzent"
          symbol="add_circle_icon_light"
          onClick={gastHinzufuegen} 
          data-testid="admin-teams-gast-hinzufuegen">
            Gast hinzufügen
        </CustomButton>
      </fieldset>

      {einteilung && (
        <section className={style.ergebnis} aria-labelledby="admin-teams-ergebnis-titel" data-testid="admin-teams-ergebnis">
          <h2 id="admin-teams-ergebnis-titel" tabIndex={-1} ref={ergebnisKopf} className={style.ergebnisTitel}>
            Ergebnis
          </h2>
          <Hinweis data-testid="teams-manuell-hinweis-ergebnis">{TEXT_NICHT_GESPEICHERT}</Hinweis>
          <TeamListen teamA={einteilung.teamA} teamB={einteilung.teamB} data-testid="admin-teams-ergebnis-teams" />

          <div className={style.angaben}>
            <p data-testid="admin-teams-verfahren">Gerechnet mit: {verfahrenText(einteilung.algorithmType)}.</p>
            {grenzen && grenzen.algorithmType !== einteilung.algorithmType && (
              <p className={style.nebentext} data-testid="admin-teams-verfahren-abweichung">
                Abweichend von der Einstellung, weil die Gruppe für das exakte Verfahren zu groß ist.
              </p>
            )}
            <p data-testid="admin-teams-regel">Auswechselspieler nach der Regel: {regelText(einteilung.auswechselModus)}.</p>
            {grenzen && grenzen.auswechselModus !== einteilung.auswechselModus && (
              <p className={style.nebentext} data-testid="admin-teams-regel-abweichung">
                Für diese Berechnung gibt es keine Anmeldereihenfolge; es gilt der schwächste Spieler des größeren Teams.
              </p>
            )}
            <p data-testid="admin-teams-ungleichgewicht">
              Ungleichgewicht: {einteilung.differenzTeamstaerke.toLocaleString('de-DE', { maximumFractionDigits: 2 })}
            </p>
            <p className={style.nebentext}>
              0 heißt vollständig ausgeglichen, größer ist schlechter. Es ist die gewichtete Summe der Unterschiede je Kategorie, nicht
              der Unterschied der Gesamtstärken.
            </p>
          </div>

          <CustomButton
            art="sekundaer"
            laedt={generieren.isPending}
            onClick={() => void berechnen()}
            data-testid="admin-teams-erneut"
          >
            Erneut berechnen
          </CustomButton>
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
            Teams berechnen
          </CustomButton>
        </div>
      </Aktionsleiste>
    </div>
  )
}
