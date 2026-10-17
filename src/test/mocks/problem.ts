import { HttpResponse } from 'msw'
import type { components } from '@/api/common/types/schema'

/**
 * Baut eine Fehlerantwort im Vertragsformat.
 *
 * `type` ist im Generat Pflichtfeld, weil der Kontrakt dafür einen Vorgabewert
 * angibt – ein handgeschriebenes Fehlerobjekt ohne dieses Feld meldet `TS2741`.
 *
 * Eigene Datei (C5): `handlers.ts` und `termine.ts` brauchen sie beide, und ein
 * gegenseitiger Import der beiden wäre ein Zirkelbezug. `handlers.ts` führt sie
 * weiter unter dem alten Namen aus, bestehende Importe bleiben gültig.
 *
 * @param status HTTP-Statuscode der Antwort.
 * @param code Maschinenlesbarer Fehlercode, nach dem die Programmlogik verzweigt.
 * @param detail Deutschsprachiger Anzeigetext.
 */
export function problem(
  status: number,
  code: components['schemas']['Fehlercode'],
  detail: string,
): Response {
  const rumpf: components['schemas']['ProblemDetail'] = {
    type: 'about:blank',
    status,
    code,
    detail,
  }
  // Jede Fehlerantwort des Servers trägt `application/problem+json`, nie
  // `application/json` – der Mock bildet das nach, damit ein Test die
  // Unterscheidung überhaupt prüfen kann.
  return HttpResponse.json(rumpf, {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}
