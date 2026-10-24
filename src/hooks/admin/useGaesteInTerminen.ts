import { useQueries, useQuery } from '@tanstack/react-query'
import type { TeilnehmerEintragAdmin } from '@/api/admin/adminTermine'
import { schluessel } from '@/api/common/schluessel'
import { terminLesen, termineLesen, type TerminDetails } from '@/api/termine/termine'
import { heuteIso } from '@/api/termine/terminZeit'

/** Ein kommender Termin mit den Gästen seiner Teilnehmerliste. */
export type TerminMitGaesten = {
  termin: TerminDetails
  /** Die Einträge mit `gast: true`, in der Reihenfolge des Servers; `gastStufe` nur, wenn der Server sie liefert. */
  gaeste: TeilnehmerEintragAdmin[]
}

/** Ergebnis von {@link useGaesteInTerminen}. */
export type GaesteInTerminen = {
  /** Termine mit mindestens einem Gast, nach Beginn sortiert wie vom Server geliefert; `undefined` beim ersten Laden. */
  daten: TerminMitGaesten[] | undefined
  /** Der erste Fehler der Liste oder einer Einzelansicht. */
  fehler: Error | null
  /** Irgendein Abruf läuft (auch beim Aktualisieren). */
  laedt: boolean
  /** Liest Liste und Einzelansichten neu. */
  neuLesen: () => Promise<unknown>
}

/**
 * Die Gäste der kommenden Termine (Gäste-Verwaltung): Wer hat sich als Gast für welchen Termin gemeldet?
 *
 * **Warum nicht die Gastplätze?** Ein Gastplatz hält nur die **Anmeldung** eines Gastes. Meldet er sich ab oder läuft
 * seine Sitzung ab und räumt der nächtliche Lauf auf, wird der Platz frei – seine Zusage am Termin bleibt aber
 * bestehen. Wer „Gäste“ sucht, meint diese Zusagen; dort setzt auch die Stufe an (`POST /admin/teilnahme/gast-stufe`
 * nennt Termin und Gastname).
 *
 * **Zwei Stufen:** Die Terminliste (`GET /termine/lesen?ab=heute`) nennt nur die Zahl der Zusagen. Für jeden geplanten
 * Termin **mit Zusagen** liest der Hook die Einzelansicht mit der Teilnehmerliste – unter **demselben Schlüssel** wie
 * `useTermin`, damit Änderungen über `termineNeuLesen` überall ankommen. Termine ohne Zusage brauchen keinen Abruf.
 *
 * Lesen im Admin ohne Polling und ohne `X-FuBo-Kein-Refresh` (die Ansicht ist eine Bedienung); „Aktualisieren“ ruft
 * {@link GaesteInTerminen.neuLesen}.
 */
export function useGaesteInTerminen(): GaesteInTerminen {
  const liste = useQuery({
    queryKey: schluessel.termine,
    queryFn: () => termineLesen({ ab: heuteIso(new Date()) }),
    staleTime: 0,
    refetchOnWindowFocus: false,
  })

  const kandidaten = (liste.data ?? []).filter((termin) => termin.status === 'GEPLANT' && termin.zusagen > 0)

  const einzeln = useQueries({
    queries: kandidaten.map((termin) => ({
      queryKey: schluessel.termin(String(termin.terminId)),
      queryFn: () => terminLesen(termin.terminId),
      staleTime: 0,
      refetchOnWindowFocus: false,
    })),
  })

  const alleDa = liste.data !== undefined && einzeln.every((abfrage) => abfrage.data !== undefined)
  const daten = alleDa
    ? einzeln
        .map((abfrage) => abfrage.data as TerminDetails)
        // Zwischen Liste und Einzelansicht kann sich der Status ändern (abgesagt, abgeschlossen).
        .filter((termin) => termin.status === 'GEPLANT')
        .map((termin) => ({
          termin,
          gaeste: (termin.teilnehmerliste.teilnehmer as TeilnehmerEintragAdmin[]).filter((eintrag) => eintrag.gast),
        }))
        .filter((eintrag) => eintrag.gaeste.length > 0)
    : undefined

  const fehler = liste.error ?? einzeln.find((abfrage) => abfrage.error)?.error ?? null

  return {
    daten,
    fehler,
    laedt: liste.isFetching || einzeln.some((abfrage) => abfrage.isFetching),
    neuLesen: () => Promise.all([liste.refetch(), ...einzeln.map((abfrage) => abfrage.refetch())]),
  }
}
