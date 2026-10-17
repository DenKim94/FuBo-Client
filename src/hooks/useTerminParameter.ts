import { useParams } from 'react-router'

/** Ergebnis von {@link useTerminParameter}. */
export type TerminParameter = {
  /** Die Route trägt überhaupt einen `:terminId` (Detailroute, nicht Hub). */
  vorhanden: boolean
  /** Der Parameter ist eine positive ganze Zahl. */
  gueltig: boolean
  /** Die Id, wenn `gueltig`; sonst `undefined`. */
  terminId: number | undefined
}

/** Positive ganze Zahl ohne führende Null. */
const TERMIN_ID = /^[1-9]\d*$/

/**
 * Liest `:terminId` aus der Route und prüft ihn (9.4).
 *
 * `termine/abc` liefe sonst als `400` an den Server und `termine/0` als `404`.
 * Alle Detailansichten brauchen dieselbe Prüfung: Ungültig heißt „nicht
 * gefunden“ und **kein Abruf**. Eine Zahl über `Number.MAX_SAFE_INTEGER` gilt
 * ebenfalls als ungültig, sie ließe sich nicht verlustfrei zurückschicken.
 */
export function useTerminParameter(): TerminParameter {
  const { terminId: roh } = useParams()
  const vorhanden = roh !== undefined
  const zahl = vorhanden && TERMIN_ID.test(roh) ? Number(roh) : undefined
  const gueltig = zahl !== undefined && Number.isSafeInteger(zahl)
  return { vorhanden, gueltig, terminId: gueltig ? zahl : undefined }
}
