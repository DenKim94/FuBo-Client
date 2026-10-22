import { aufrufen } from '@/api/common/httpService'
import type { components } from '@/api/common/types/schema'

/**
 * Datenzugriff der manuellen Teamgenerierung (C8, Stufe 5; ADMIN).
 *
 * **Keine Funktion trägt `keinRefresh`:** Der Lauf ist eine Bedienung und verlängert das Sitzungsfenster.
 * Das Ergebnis wird **nirgends gespeichert** – weder am Server noch im Cache des Clients (E18); es lebt im Zustand
 * der Seite.
 */

/** Körper von `POST /admin/teams/generieren`: Ids ausgewählter Profile und frei angelegte Gäste. */
export type ManuelleGenerierung = components['schemas']['ManuelleGenerierungRequest']

/** Ein frei angelegter Gast des manuellen Laufs: **Stufe ist Pflicht**, der Name optional. */
export type GastAuswahl = components['schemas']['GastAuswahl']

/**
 * Das Ergebnis des manuellen Laufs, **mit** `differenzTeamstaerke` (nur im Adminbereich erlaubt, A12).
 * `algorithmType` und `auswechselModus` sind die **tatsächlich verwendeten** Werte und können von der Konfiguration abweichen.
 */
export type ManuelleEinteilung = components['schemas']['ManuelleEinteilung']

/**
 * Berechnet Teams für eine frei gewählte Gruppe (`POST /admin/teams/generieren`, `200` mit Rumpf).
 *
 * Nichts wird gespeichert, keine Einteilung eines Termins wird abgelöst. Fehler (`409`): `ZU_WENIG_TEILNEHMER` und
 * `ZU_VIELE_TEILNEHMER` (`detail` nennt die Grenzen), `SKILLWERTE_UNVOLLSTAENDIG` (`detail` nennt die Namen),
 * `PROFIL_GESCHUETZT` (Adminprofil); `400` bei unbekannter oder gesperrter Id (die Auswahl wurde verfälscht).
 * Mit `HEURISTIK` liefert jeder Lauf ein anderes Ergebnis – „Erneut berechnen“ ist derselbe Aufruf.
 *
 * @param anfrage `spielerIds` und `gaeste`; beide dürfen fehlen, aber nicht beide leer sein.
 */
export async function teamsManuellGenerieren(anfrage: ManuelleGenerierung): Promise<ManuelleEinteilung> {
  return aufrufen<ManuelleEinteilung>('POST', '/admin/teams/generieren', { body: anfrage })
}
