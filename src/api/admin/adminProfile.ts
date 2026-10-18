import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/** Ein Profil aus Sicht des Admins, **mit Skillwerten** (`SpielerDetails`; nur unterhalb von `/admin/`, A12). */
export type SpielerDetails = components['schemas']['SpielerDetails']

/** Eine aktive Skillkategorie samt Wertebereich (Definition bei den Hilfsfunktionen in `skills.ts`). */
export type { SkillKategorie } from './skills'
import type { SkillKategorie } from './skills'

/** Body von `POST /admin/user/anlegen`: Name und **alle** Kategorien. */
export type SpielerAnlegen = components['schemas']['SpielerAnlegenRequest']

/** Body von `POST /admin/user/bearbeiten`: Id, dazu **nur das Geänderte**. */
export type SpielerBearbeiten = components['schemas']['SpielerBearbeitenRequest']

/** Antwort von `POST /admin/user/anlegen`. */
export type SpielerAngelegt = components['schemas']['SpielerAngelegt']

/**
 * Alle Profile samt Skillwerten (`GET /admin/user/lesen`, ADMIN).
 *
 * **Das Adminprofil steht in der Liste** (`rolle: 'ADMIN'`), ebenso gesperrte Profile
 * (`aktiv: false`): Sonst liesse sich eine versehentliche Sperre nicht zurücknehmen.
 * Ohne `X-FuBo-Kein-Refresh`: Lesen im Admin ist Bedienung, kein Hintergrundabruf (E4).
 */
export async function profileLesen(): Promise<SpielerDetails[]> {
  return aufrufen<SpielerDetails[]>('GET', '/admin/user/lesen')
}

/**
 * Die aktiven Skillkategorien mit Wertebereich, bereits sortiert (`GET /admin/skills/lesen`, ADMIN).
 *
 * Das Formular wird **aus dieser Antwort gebaut**, nicht aus einer festen Liste.
 */
export async function skillKategorienLesen(): Promise<SkillKategorie[]> {
  return aufrufen<SkillKategorie[]>('GET', '/admin/skills/lesen')
}

/**
 * Legt ein Profil an (`POST /admin/user/anlegen`, `201` mit Rumpf).
 *
 * **Vollständige Skillwerte sind Pflicht** (ein Wert je aktive Kategorie), sonst `400`.
 * Fehler: `409 NAME_BELEGT` (unabhängig von Gross- und Kleinschreibung), `400 EINGABE_UNGUELTIG`.
 *
 * @param anfrage Name und alle Kategorien.
 */
export async function spielerAnlegen(anfrage: SpielerAnlegen): Promise<SpielerAngelegt> {
  return aufrufen<SpielerAngelegt>('POST', '/admin/user/anlegen', { body: anfrage })
}

/**
 * Ändert ein Profil (`POST /admin/user/bearbeiten`, `204`): **Weglassen heisst „nicht ändern“.**
 *
 * Fehler: `404` (Profil weg), `409 NAME_BELEGT`, `409 PROFIL_GESCHUETZT` (Adminprofil; darf nicht
 * vorkommen, die Aktion ist dort ausgeblendet), `400` (weder Name noch Skills, Werte ausserhalb).
 *
 * @param anfrage Id und das Geänderte.
 */
export async function spielerBearbeiten(anfrage: SpielerBearbeiten): Promise<void> {
  await aufrufen<void>('POST', '/admin/user/bearbeiten', { body: anfrage })
}

/**
 * Sperrt oder entsperrt ein Profil (`POST /admin/user/blockieren`, `204`).
 *
 * **Ein Endpunkt für beide Richtungen.** Ein Sperren beendet die laufende Sitzung des Spielers.
 * Fehler: `404`, `409 PROFIL_GESCHUETZT`.
 *
 * @param spielerId Id des Profils.
 * @param blockieren `true` sperrt, `false` gibt frei.
 */
export async function spielerBlockieren(spielerId: number, blockieren: boolean): Promise<void> {
  await aufrufen<void>('POST', '/admin/user/blockieren', { body: { spielerId, blockieren } })
}

/**
 * Entfernt ein Profil, das noch nie benutzt wurde (`POST /admin/user/entfernen`, `204`).
 *
 * Fehler: `409 PROFIL_IN_VERWENDUNG` (es hängen Daten daran; sperren statt entfernen), `404`,
 * `409 PROFIL_GESCHUETZT`.
 *
 * @param spielerId Id des Profils.
 */
export async function spielerEntfernen(spielerId: number): Promise<void> {
  await aufrufen<void>('POST', '/admin/user/entfernen', { body: { spielerId } })
}
