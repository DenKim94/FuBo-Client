import { naechsterTermin } from '@/api/termine/terminZeit'
import { ADMIN_PFADE } from '@/app/schutz/zielpfad'
import Fehlerzustand from '@/components/Fehlerzustand/Fehlerzustand'
import Hinweis from '@/components/Hinweis/Hinweis'
import Ladespinner from '@/components/Ladespinner/Ladespinner'
import Leerzustand from '@/components/Leerzustand/Leerzustand'
import TerminAnsicht from '@/components/TerminAnsicht/TerminAnsicht'
import Textlink from '@/components/Textlink/Textlink'
import Verwaltungsliste, { type Verwaltungsgruppe } from '@/components/Verwaltungsliste/Verwaltungsliste'
import { useNavigationsHinweis } from '@/hooks/useNavigationsHinweis'
import { useTermine } from '@/hooks/useTermine'
import style from './AdminDashboard.module.scss'

/**
 * Die Verwaltungsliste im Endzustand (C7, 6.2). „Gastplätze“, „Konfiguration“ und
 * „Teams ohne Termin“ stehen von Anfang an darin; ihre Ziele zeigen bis C8 auf
 * Platzhalter. Die Liste ist die Navigation des Admins (E1): Er sieht keine
 * Tab-Leiste.
 */
const GRUPPEN: Verwaltungsgruppe[] = [
  {
    titel: 'Verwaltung',
    eintraege: [
      {
        to: ADMIN_PFADE.profile,
        titel: 'Spielerprofile',
        text: 'Profile und Skillwerte pflegen, sperren, entfernen',
        symbol: 'manage_accounts_icon_dark',
        'data-testid': 'admin-link-profile',
      },
      {
        to: ADMIN_PFADE.termine,
        titel: 'Termine',
        text: 'Anlegen, ändern, absagen, Ergebnis korrigieren',
        symbol: 'data_table_icon_dark',
        'data-testid': 'admin-link-termine',
      },
      {
        to: ADMIN_PFADE.gaeste,
        titel: 'Gastplätze',
        text: 'Angemeldete Gäste ansehen und Plätze freigeben',
        symbol: 'person_guest_dark',
        'data-testid': 'admin-link-gaeste',
      },
      {
        to: ADMIN_PFADE.konfiguration,
        titel: 'Konfiguration',
        text: 'Teilnehmerzahlen, Team-Generator, Sitzung, Halle, Push',
        symbol: 'settings_icon_dark',
        'data-testid': 'admin-link-konfiguration',
      },
    ],
  },
  {
    titel: 'Werkzeuge',
    eintraege: [
      {
        to: ADMIN_PFADE.teams,
        titel: 'Teams ohne Termin',
        text: 'Eine Einteilung für eine frei gewählte Gruppe rechnen',
        symbol: 'chart_data_icon_dark',
        'data-testid': 'admin-link-teams',
      },
    ],
  },
  {
    titel: 'Zugang',
    eintraege: [
      {
        to: ADMIN_PFADE.pin,
        titel: 'Zentrale PIN',
        text: 'Neue PIN für alle Spieler festlegen',
        symbol: 'login_icon_dark',
        'data-testid': 'admin-link-pin',
      },
      {
        to: ADMIN_PFADE.nameAendern,
        titel: 'Anmeldename',
        text: 'Mit Bestätigung per E-Mail ändern',
        symbol: 'mail_icon_dark',
        'data-testid': 'admin-link-name',
      },
      {
        to: ADMIN_PFADE.passwortAendern,
        titel: 'Passwort',
        text: 'Bisheriges Passwort wird abgefragt',
        symbol: 'admin_icon_dark',
        'data-testid': 'admin-link-passwort',
      },
    ],
  },
]

/**
 * Admin-Dashboard (`/admin`, A9/A10, C7 6.2): Teilnehmerübersicht des nächsten
 * Termins und die Verwaltungsliste.
 *
 * **Der Admin sieht den Termin nur lesend** (E2, `TerminAnsicht nurLesen`): Er kann
 * nicht zu- oder absagen (`409 PROFIL_GESCHUETZT`), und ein „Anmeldung
 * ausstehend“ wäre falsch. Statt der Leiste steht der Link „Termin verwalten“.
 *
 * **Die Terminabfrage und die Liste sind unabhängig:** Ein Fehler beim Laden der
 * Termine blockiert die Verwaltung nicht – ohne Termine bliebe dem Admin sonst
 * kein Weg, einen anzulegen.
 *
 * Keine Aktionsleiste und keine Tab-Leiste: Das Dashboard hat keine primäre Aktion,
 * die Liste ist die Navigation. Ein Hinweis aus der Navigation („Anmeldename
 * geändert …“) steht oben.
 */
export default function AdminDashboard() {
  const termine = useTermine()
  const hinweis = useNavigationsHinweis()
  const liste = termine.data
  const termin = liste ? naechsterTermin(liste).termin : undefined

  let naechster
  if (!liste) {
    naechster = termine.isPending ? (
      <Ladespinner groesse="gross" zentriert text="Termine werden geladen" />
    ) : (
      <Fehlerzustand fehler={termine.error} erneut={() => void termine.refetch()} data-testid="admin-dashboard-fehler" />
    )
  } else if (termin) {
    naechster = (
      <div className={style.termin}>
        <TerminAnsicht terminId={termin.terminId} eingeklappt nurLesen kartenEbene={3}>
          <Textlink to={ADMIN_PFADE.terminVerwaltung(termin.terminId)} data-testid="admin-termin-verwalten-link">
            Termin verwalten
          </Textlink>
        </TerminAnsicht>
      </div>
    )
  } else {
    naechster = (
      <Leerzustand
        titel="Kein Termin geplant"
        text="Lege einen Termin an, damit sich die Spieler anmelden können."
        aktion={
          <Textlink to={ADMIN_PFADE.terminNeu} data-testid="admin-termin-anlegen-link">
            Termin anlegen
          </Textlink>
        }
        data-testid="admin-dashboard-leer"
      />
    )
  }

  return (
    <section className={style.dashboard} data-testid="admin-dashboard">
      <h1 className={style.titel}>Administration</h1>

      {hinweis.hinweis !== null && <Hinweis data-testid="admin-dashboard-hinweis">{hinweis.hinweis}</Hinweis>}

      <section className={style.abschnitt} aria-labelledby="admin-naechster-termin">
        <h2 id="admin-naechster-termin" className={style.abschnittTitel}>
          Nächster Termin
        </h2>
        {naechster}
      </section>

      <Verwaltungsliste gruppen={GRUPPEN} />
    </section>
  )
}
