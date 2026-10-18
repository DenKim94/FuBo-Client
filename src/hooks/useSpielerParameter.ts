import { useParams } from 'react-router'

/** Ergebnis von {@link useSpielerParameter}. */
export type SpielerParameter = {
  /** Die Route trägt überhaupt einen `:spielerId`. */
  vorhanden: boolean
  /** Der Parameter ist eine positive ganze Zahl. */
  gueltig: boolean
  /** Die Id, wenn `gueltig`; sonst `undefined`. */
  spielerId: number | undefined
}

/** Positive ganze Zahl ohne führende Null. */
const SPIELER_ID = /^[1-9]\d*$/

/**
 * Liest `:spielerId` aus der Route und prüft ihn – dasselbe Muster wie `useTerminParameter`.
 *
 * `profile/abc` liefe sonst als Suche in der Liste ins Leere; ungültig heisst „nicht gefunden“
 * und **kein Abruf**. Zahlen über `Number.MAX_SAFE_INTEGER` gelten als ungültig.
 */
export function useSpielerParameter(): SpielerParameter {
  const { spielerId: roh } = useParams()
  const vorhanden = roh !== undefined
  const zahl = vorhanden && SPIELER_ID.test(roh) ? Number(roh) : undefined
  const gueltig = zahl !== undefined && Number.isSafeInteger(zahl)
  return { vorhanden, gueltig, spielerId: gueltig ? zahl : undefined }
}
