import { useNavigate } from 'react-router'
import type { SpielerDetails } from '@/api/admin/adminProfile'
import { skillsVollstaendig, type SkillKategorie } from '@/api/admin/skills'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Aktionsleiste from '@/components/Aktionsleiste/Aktionsleiste'
import CustomButton from '@/components/CustomButton/CustomButton'
import Hinweis from '@/components/Hinweis/Hinweis'
import Netzdiagramm from '@/components/Netzdiagramm/Netzdiagramm'
import ProfilKennzeichen from '@/components/ProfilKennzeichen/ProfilKennzeichen'
import ProfilLader from '@/components/ProfilLader/ProfilLader'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useSpielerParameter } from '@/hooks/useSpielerParameter'
import NichtGefunden from '@/pages/NichtGefunden/NichtGefunden'
import style from './AdminProfilDetail.module.scss'

/** Anteil des Werts am Bereich der Kategorie in Prozent, begrenzt auf 0 bis 100; ein fehlender Wert ist 0. */
function prozent(wert: number | undefined, kategorie: SkillKategorie): number {
  if (wert === undefined) return 0
  const spanne = kategorie.maxWert - kategorie.minWert
  if (spanne <= 0) return 100
  return Math.min(100, Math.max(0, ((wert - kategorie.minWert) / spanne) * 100))
}

/** „31 Spiele“, „1 Spiel“ oder „Noch keine Spiele“: die Zahl der gewerteten Spiele aus der Bilanz. */
function spieleText(bilanz: SpielerDetails['bilanz']): string {
  const anzahl = bilanz.siege + bilanz.niederlagen + bilanz.unentschieden
  if (anzahl === 0) return 'Noch keine Spiele'
  return anzahl === 1 ? '1 Spiel' : `${String(anzahl)} Spiele`
}

/** Eigenschaften der Ansicht. */
type AnsichtEigenschaften = { profil: SpielerDetails; kategorien: SkillKategorie[] }

/**
 * Die Profilansicht (Prototyp 09c): Kopf mit Name und Eckdaten, Netzdiagramm, Werte als Balken, darunter in der
 * Leiste „Skills bearbeiten“.
 *
 * **Die Werte stehen als Zahl und Balken neben dem Diagramm:** Das Diagramm ist nie die einzige Quelle. Alles kommt
 * aus den Kategorien des Servers (Zahl, Namen, Bereich); der Kopf nennt nur die Spielzahl (die Skala dort ist am
 * 19.10.2026 entfallen). **Alle Balken sind gleich breit**; die Füllung ist der Anteil am Bereich der eigenen
 * Kategorie (Torwart 3 von 3 füllt den Balken wie Angriff 6 von 6).
 * **Skillwerte erscheinen nur hier und im Formular, nie in der Liste.**
 */
function Ansicht({ profil, kategorien }: AnsichtEigenschaften) {
  const hinweis = useNavigationsHinweis()
  const navigate = useNavigate()

  return (
    <section className={style.seite} data-testid="admin-profil-detail">
      <div className={style.bereich}>
        {hinweis.hinweis !== null && <Hinweis data-testid="admin-profil-detail-hinweis">{hinweis.hinweis}</Hinweis>}

        <header className={style.kopf}>
          <h1 className={style.name} data-testid="admin-profil-detail-name">
            {profil.name}
          </h1>
          <p className={style.eckdaten} data-testid="admin-profil-detail-eckdaten">
            {spieleText(profil.bilanz)}
          </p>
          <ProfilKennzeichen profil={profil} skillsUnvollstaendig={!skillsVollstaendig(profil.skills, kategorien)} />
        </header>

        <section className={style.karte} aria-labelledby="admin-profil-detail-profil-titel">
          <h2 id="admin-profil-detail-profil-titel" className="nurFuerScreenreader">
            Skill-Profil
          </h2>
          <Netzdiagramm kategorien={kategorien} skills={profil.skills} data-testid="admin-profil-netzdiagramm" />
        </section>

        <section className={style.karte} aria-labelledby="admin-profil-detail-werte-titel">
          <h2 id="admin-profil-detail-werte-titel" className="nurFuerScreenreader">
            Skillwerte
          </h2>
          <ul className={style.werte} data-testid="admin-profil-werte">
            {kategorien.map((kategorie) => {
              const wert = profil.skills[kategorie.schluessel]
              return (
                <li key={kategorie.schluessel} className={style.wertZeile} data-testid={`admin-profil-wert-${kategorie.schluessel}`}>
                  <span className={style.wertName}>{kategorie.bezeichnung}</span>
                  <span className={style.balken} aria-hidden="true" data-testid={`admin-profil-balken-${kategorie.schluessel}`}>
                    <span className={style.balkenFuellung} style={{ inlineSize: `${String(prozent(wert, kategorie))}%` }} />
                  </span>
                  <span className={style.wertZahl}>{wert === undefined ? '–' : wert}</span>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <Aktionsleiste>
        <CustomButton
          art="primaer"
          symbol="person_edit_dark"
          breit
          className={style.aktion}
          onClick={() => void navigate(ADMIN_PFADE.profilBearbeiten(profil.spielerId))}
          data-testid="admin-profil-skills-bearbeiten"
        >
          Profil bearbeiten
        </CustomButton>
      </Aktionsleiste>
    </section>
  )
}

/**
 * Profilansicht eines Spielers (`/admin/profile/:spielerId`, Prototyp 09c).
 *
 * **Die Adresse wird geprüft, bevor etwas abgerufen wird** (`useSpielerParameter`): `profile/abc` zeigt „nicht
 * gefunden“, ohne Abruf. Kategorien und Profil lädt `ProfilLader`; das Adminprofil hat keine Ansicht (Hinweis auf den
 * Anmeldenamen). Ein Hinweis aus der Navigation („Gespeichert.“ nach dem Bearbeiten) steht oben.
 */
export default function AdminProfilDetail() {
  const { gueltig, spielerId } = useSpielerParameter()
  if (!gueltig || spielerId === undefined) return <NichtGefunden />
  return (
    <ProfilLader spielerId={spielerId} ladetext="Profil wird geladen">
      {(daten) => <Ansicht profil={daten.profil} kategorien={daten.kategorien} />}
    </ProfilLader>
  )
}
