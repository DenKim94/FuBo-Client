import { useId, useRef, useState, type SubmitEvent } from 'react'
import { useNavigate } from 'react-router'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import { profilAenderung, skillZahl, vorgabe, type SkillKategorie } from '@/api/admin/skills'
import { SKILL_VORGABEN } from '@/api/admin/skillVorgaben'
import { ApiFehler } from '@/api/common/fehler'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Fehlermeldung from '@/components/Fehlermeldung/Fehlermeldung'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Feld from '@/components/Feld/Feld'
import Knopfgruppe from '@/components/Knopfgruppe/Knopfgruppe'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import ProfilLader from '@/components/ProfilLader/ProfilLader'
import SkillFelder from '@/components/SkillFelder/SkillFelder'
import { useProfilAnlegen } from '@/hooks/admin/useProfilAnlegen'
import { useProfilBearbeiten } from '@/hooks/admin/useProfilBearbeiten'
import { useProfile } from '@/hooks/admin/useProfile'
import { useSkillKategorien } from '@/hooks/admin/useSkillKategorien'
import { useSpielerParameter } from '@/hooks/useSpielerParameter'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import ProfilStatus from './ProfilStatus'
import style from './AdminProfilFormular.module.scss'

/** Längster Name: so lang darf ein Profilname sein (Kontrakt). */
const NAME_MAX = 60

/** Rückfalltexte, falls der Fehler weder vom Server stammt noch ein Netzfehler ist. */
const FEHLER_ERSATZ_ANLEGEN = 'Das Profil konnte nicht angelegt werden. Bitte versuche es erneut.'
const FEHLER_ERSATZ_SPEICHERN = 'Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut.'

/** Eigenschaften des Profilformulars. */
type FormularEigenschaften = {
  /** `neu` legt an (`/admin/profile/neu`), `bearbeiten` ändert (`/admin/profile/:spielerId/bearbeiten`). */
  modus: 'neu' | 'bearbeiten'
}

/**
 * Profilformular (C7, 7.3): ein Baustein, zwei Routen.
 *
 * `bearbeiten` (`/admin/profile/:spielerId/bearbeiten`, Prototyp 09b) prüft `:spielerId` zuerst (ungültig heisst
 * „nicht gefunden“ und **kein Abruf**). **Das Formular entsteht aus den Kategorien des Servers** – ohne sie lässt
 * sich keines bauen, und es wird nichts geraten: Solange sie laden steht ein Spinner, bei einem Fehler ein
 * Fehlerzustand (beides in `ProfilLader`).
 */
export default function AdminProfilFormular({ modus }: FormularEigenschaften) {
  const parameter = useSpielerParameter()
  if (modus === 'neu') return <NeuLader />
  const spielerId = parameter.spielerId
  if (!parameter.gueltig || spielerId === undefined) return <NichtGefunden />
  return (
    <ProfilLader spielerId={spielerId} ladetext="Formular wird geladen">
      {({ profil, kategorien }) => <BearbeitenFormular profil={profil} kategorien={kategorien} />}
    </ProfilLader>
  )
}

/** Lädt die Kategorien, bevor das Anlegen-Formular gebaut wird. */
function NeuLader() {
  const kategorien = useSkillKategorien()
  // Beim Anlegen braucht es die Profile nicht; die Abfrage bleibt dennoch beobachtet, damit die Liste warm ist.
  useProfile()

  if (!kategorien.data) {
    return kategorien.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Formular wird geladen" />
    ) : (
      <Fehlerzustand fehler={kategorien.error} erneut={() => void kategorien.refetch()} data-testid="admin-profil-kategorien-fehler" />
    )
  }
  return <AnlegenFormular kategorien={kategorien.data} />
}

/** Startwerte der Skillfelder als Text: der Wert der Karte, sonst leer (E7). */
function werteAus(skills: Record<string, number>, kategorien: SkillKategorie[]): Record<string, string> {
  return Object.fromEntries(kategorien.map((k) => [k.schluessel, skills[k.schluessel] === undefined ? '' : String(skills[k.schluessel])]))
}

/** Sind alle Skillfelder gültig (nicht leer, ganze Zahl im Bereich)? */
function allesGueltig(werte: Record<string, string>, kategorien: SkillKategorie[]): boolean {
  return kategorien.every((k) => skillZahl(werte[k.schluessel] ?? '', k) !== null)
}

/** Gibt die Fehlertexte des Servers je Kategorie zurück (Schlüssel, die keine Kategorie sind, fallen weg). */
function skillFehlerAus(fehler: ApiFehler | null, kategorien: SkillKategorie[]): Record<string, string> {
  const ergebnis: Record<string, string> = {}
  for (const k of kategorien) {
    const text = fehler?.status === 400 ? fehler.felder?.[k.schluessel] : undefined
    if (text) ergebnis[k.schluessel] = text
  }
  return ergebnis
}

/**
 * Anlegen: Werte vorbelegt und sichtbar (Mitte der Skala, Torwart 0; `SKILL_VORGABEN`); gesendet werden **alle**
 * Kategorien.
 */
function AnlegenFormular({ kategorien }: { kategorien: SkillKategorie[] }) {
  const [name, setName] = useState('')
  const [werte, setWerte] = useState(() => Object.fromEntries(kategorien.map((k) => [k.schluessel, String(vorgabe(k, SKILL_VORGABEN))])))
  const anlegen = useProfilAnlegen()
  const navigate = useNavigate()
  const nameFeld = useRef<HTMLInputElement>(null)
  const grundId = useId()

  const getrimmt = name.trim()
  const gueltig = getrimmt !== '' && allesGueltig(werte, kategorien)
  const grund = getrimmt === '' ? 'Bitte gib einen Namen ein.' : gueltig ? null : 'Bitte prüfe die Skillwerte.'

  const apiFehler = anlegen.error instanceof ApiFehler ? anlegen.error : null
  const nameFehler = apiFehler?.code === 'NAME_BELEGT' ? apiFehler.message : apiFehler?.status === 400 ? (apiFehler.felder?.name ?? null) : null
  const skillFehler = skillFehlerAus(apiFehler, kategorien)
  const skillKasten = apiFehler?.status === 400 && nameFehler === null && Object.keys(skillFehler).length === 0
  const allgemein = anlegen.error !== null && nameFehler === null && !skillKasten && Object.keys(skillFehler).length === 0

  /** Legt an und geht mit Hinweis zur Liste. `mutateAsync`: Die Seite wird beim Wechsel ausgehängt. */
  async function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!gueltig || anlegen.isPending) return
    try {
      const angelegt = await anlegen.mutateAsync({
        name: getrimmt,
        skills: Object.fromEntries(kategorien.map((k) => [k.schluessel, skillZahl(werte[k.schluessel] ?? '', k) as number])),
      })
      void navigate(ADMIN_PFADE.profile, { state: { hinweis: `Profil „${angelegt.name}“ angelegt.` } })
    } catch (fehler) {
      if (fehler instanceof ApiFehler && (fehler.code === 'NAME_BELEGT' || fehler.felder?.name)) nameFeld.current?.focus()
    }
  }

  /** Mit der nächsten Eingabe hat ein Fehler seine Aufgabe erfüllt. */
  function eingabe() {
    if (anlegen.isError) anlegen.reset()
  }

  return (
    <form className={style.seite} onSubmit={(e) => void absenden(e)} noValidate data-testid="admin-profil-formular">
      <div className={style.bereich}>
        <h1 className={style.titel}>Profil anlegen</h1>
        <Feld
          ref={nameFeld}
          beschriftung="Name"
          hinweis="Eindeutig; Groß- und Kleinschreibung zählen nicht als Unterschied."
          value={name}
          onChange={(e) => {
            eingabe()
            setName(e.target.value)
          }}
          fehler={nameFehler}
          maxLength={NAME_MAX}
          autoComplete="off"
          autoCapitalize="words"
          readOnly={anlegen.isPending}
          data-testid="admin-profil-name"
        />
        {skillKasten && <Fehlermeldung fehler={anlegen.error} ersatz={FEHLER_ERSATZ_ANLEGEN} data-testid="admin-profil-skills-fehler" />}
        <SkillFelder
          kategorien={kategorien}
          werte={werte}
          beiAenderung={(schluessel, text) => {
            eingabe()
            setWerte((alt) => ({ ...alt, [schluessel]: text }))
          }}
          fehler={skillFehler}
          vorbelegtHinweis
          schreibgeschuetzt={anlegen.isPending}
        />
      </div>

      <Aktionsleiste>
        <div className={style.aktionen}>
          {allgemein && <Fehlermeldung fehler={anlegen.error} ersatz={FEHLER_ERSATZ_ANLEGEN} data-testid="admin-profil-fehler" />}
          {grund !== null && (
            <p id={grundId} className={style.nebentext} data-testid="admin-profil-grund">
              {grund}
            </p>
          )}
          <CustomButton
            type="submit"
            art="primaer"
            breit
            className={style.aktion}
            laedt={anlegen.isPending}
            aria-disabled={grund !== null ? true : undefined}
            aria-describedby={grund !== null ? grundId : undefined}
            data-testid="admin-profil-speichern"
          >
            Profil anlegen
          </CustomButton>
        </div>
      </Aktionsleiste>
    </form>
  )
}

/**
 * Bearbeiten (Prototyp 09b): Name, Skills als Segmente, Schalter „Aktiv in der Auswahlliste“, Entfernen; in der
 * Leiste „Abbrechen“ und „Speichern“. Das Formular zeigt den **Stand des Profils** und sendet **nur das Geänderte** (E6).
 *
 * **Nach dem Speichern** geht es mit dem Hinweis „Gespeichert.“ zurück zur Profilansicht (dort zeigt das Netzdiagramm
 * den neuen Stand); „Abbrechen“ führt ohne Senden dorthin. Der Schalter des Status wirkt dagegen sofort und ist
 * nicht Teil des Speicherns.
 *
 * **Neuer Stand ⇒ neue Eingaben, ohne Neuaufbau:** Ändert sich das Profil unter dem Formular (nach dem
 * eigenen Speichern oder durch eine fremde Änderung), übernehmen die Felder den neuen Stand. Das
 * geschieht beim Rendern über den Vergleich mit dem zuletzt gesehenen Stand und nicht über `key`: Die
 * Schaltfläche bleibt dasselbe Element, und der **Fokus bleibt** dort, wo er war.
 */
function BearbeitenFormular({ profil, kategorien }: { profil: SpielerDetails; kategorien: SkillKategorie[] }) {
  const stand = JSON.stringify([profil.name, kategorien.map((k) => profil.skills[k.schluessel] ?? null)])
  const [gesehen, setGesehen] = useState(stand)
  const [name, setName] = useState(profil.name)
  const [werte, setWerte] = useState(() => werteAus(profil.skills, kategorien))
  const speichern = useProfilBearbeiten()
  const navigate = useNavigate()
  const nameFeld = useRef<HTMLInputElement>(null)
  const grundId = useId()

  if (stand !== gesehen) {
    setGesehen(stand)
    setName(profil.name)
    setWerte(werteAus(profil.skills, kategorien))
  }

  const nichtBewertet = kategorien.filter((k) => profil.skills[k.schluessel] === undefined).map((k) => k.schluessel)
  const aenderung = profilAenderung({ name: profil.name, skills: profil.skills }, { name, skills: werte }, kategorien)
  // Ein Feld mit Text ausserhalb des Bereichs sperrt; ein leeres Feld einer fehlenden Kategorie bleibt ungesendet.
  const eingabenGueltig =
    name.trim() !== '' && kategorien.every((k) => (werte[k.schluessel] ?? '').trim() === '' || skillZahl(werte[k.schluessel], k) !== null)
  const darfSpeichern = aenderung !== null && eingabenGueltig
  const grund = darfSpeichern ? null : !eingabenGueltig ? 'Bitte prüfe die Eingaben.' : 'Es gibt keine Änderungen.'

  const apiFehler = speichern.error instanceof ApiFehler ? speichern.error : null
  const nameFehler = apiFehler?.code === 'NAME_BELEGT' ? apiFehler.message : apiFehler?.status === 400 ? (apiFehler.felder?.name ?? null) : null
  const skillFehler = skillFehlerAus(apiFehler, kategorien)
  const skillKasten = apiFehler?.status === 400 && nameFehler === null && Object.keys(skillFehler).length === 0
  const allgemein = speichern.error !== null && nameFehler === null && !skillKasten && Object.keys(skillFehler).length === 0

  /** Sendet das Geänderte. */
  async function absenden(ereignis: SubmitEvent<HTMLFormElement>) {
    ereignis.preventDefault()
    if (!darfSpeichern || speichern.isPending) return
    try {
      await speichern.mutateAsync({ spielerId: profil.spielerId, ...aenderung })
      void navigate(ADMIN_PFADE.profilDetail(profil.spielerId), { state: { hinweis: 'Gespeichert.' } })
    } catch (fehler) {
      if (fehler instanceof ApiFehler && fehler.status === 404) {
        void navigate(ADMIN_PFADE.profile, { replace: true, state: { hinweis: 'Dieses Profil gibt es nicht mehr.' } })
      } else if (fehler instanceof ApiFehler && (fehler.code === 'NAME_BELEGT' || fehler.felder?.name)) {
        nameFeld.current?.focus()
      }
    }
  }

  /** Mit der nächsten Eingabe hat ein Fehler seine Aufgabe erfüllt. */
  function eingabe() {
    if (speichern.isError) speichern.reset()
  }

  return (
    <form className={style.seite} onSubmit={(e) => void absenden(e)} noValidate data-testid="admin-profil-formular">
        <div className={style.bereich}>
          <h1 className={style.titel}>{profil.name}</h1>
          <Feld
            ref={nameFeld}
            beschriftung="Name"
            hinweis="Eindeutig; Groß- und Kleinschreibung zählen nicht als Unterschied."
            value={name}
            onChange={(e) => {
              eingabe()
              setName(e.target.value)
            }}
            fehler={nameFehler}
            maxLength={NAME_MAX}
            autoComplete="off"
            autoCapitalize="words"
            readOnly={speichern.isPending}
            data-testid="admin-profil-name"
          />
          {skillKasten && <Fehlermeldung fehler={speichern.error} ersatz={FEHLER_ERSATZ_SPEICHERN} data-testid="admin-profil-skills-fehler" />}
          <SkillFelder
            kategorien={kategorien}
            werte={werte}
            beiAenderung={(schluessel, text) => {
              eingabe()
              setWerte((alt) => ({ ...alt, [schluessel]: text }))
            }}
            fehler={skillFehler}
            nichtBewertet={nichtBewertet}
            schreibgeschuetzt={speichern.isPending}
          />
          {/* Im Bereich, nicht daneben: Die haftende Aktionsleiste bleibt das letzte Element der Seite. */}
          <ProfilStatus profil={profil} />
        </div>

        <Aktionsleiste>
          <div className={style.aktionen}>
            {allgemein && <Fehlermeldung fehler={speichern.error} ersatz={FEHLER_ERSATZ_SPEICHERN} data-testid="admin-profil-fehler" />}
            {grund !== null && (
              <p id={grundId} className={style.nebentext} data-testid="admin-profil-grund">
                {grund}
              </p>
            )}
            <Knopfgruppe>
              <CustomButton
                art="sekundaer"
                className={style.aktion}
                onClick={() => void navigate(ADMIN_PFADE.profilDetail(profil.spielerId))}
                data-testid="admin-profil-abbrechen"
              >
                Abbrechen
              </CustomButton>
              <CustomButton
                type="submit"
                art="primaer"
                className={style.aktion}
                laedt={speichern.isPending}
                aria-disabled={grund !== null ? true : undefined}
                aria-describedby={grund !== null ? grundId : undefined}
                data-testid="admin-profil-speichern"
              >
                Speichern
              </CustomButton>
            </Knopfgruppe>
          </div>
        </Aktionsleiste>
    </form>
  )
}
