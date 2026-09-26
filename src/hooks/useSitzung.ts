import { useQuery } from '@tanstack/react-query'
import { schluessel } from '@/api/schluessel'
import { sitzungLesen } from '@/api/sitzung'
import type { SitzungInfo } from '@/api/sitzung'

/** Rueckgabe von {@link useSitzung}. */
export type SitzungZustand = {
  /** Der Server hat noch nicht geantwortet – der Zustand ist unbekannt. */
  laedt: boolean
  /** Rohdaten der Sitzung oder `null`, wenn keine besteht. */
  sitzung: SitzungInfo | null
  /** Anmeldung vollstaendig abgeschlossen (`stage = PROFILE_AUTHENTICATED`). */
  angemeldet: boolean
  /** PIN geprueft, Identitaet aber noch nicht gewaehlt. */
  pinGeprueft: boolean
  /** Rolle ADMIN. */
  istAdmin: boolean
  /** Rolle GAST – erhaelt z. B. keine Push-Benachrichtigungen (A25d). */
  istGast: boolean
}

/**
 * Liest den Zustand der eigenen Sitzung vom Server.
 *
 * Der Zustand kommt bewusst **nicht** aus einem lokalen Kontext: Autoritaet ist
 * der Server, das Sitzungs-Cookie ist HttpOnly und fuer das Frontend unlesbar.
 * Ein lokal gehaltenes Abbild liefe ausserdem beim Ablauf der Sitzung
 * auseinander, ohne dass es jemand bemerkt.
 *
 * `retry: false`: Ein `401` liefert hier `null` und ist kein Fehler; bleibt der
 * Server stumm, hilft ein zweiter Versuch nicht und verzoegert nur die
 * Umleitung zur Anmeldung.
 */
export function useSitzung(): SitzungZustand {
  const abfrage = useQuery({
    queryKey: schluessel.sitzung,
    // Bewusst gekapselt statt `queryFn: sitzungLesen`: TanStack Query uebergibt
    // der Funktion einen Kontext. Der landete sonst im Parameter `keinRefresh`
    // und waere dort truthy – jeder Aufruf truege dann den Kopf
    // `X-FuBo-Kein-Refresh`, und das gleitende Fenster wanderte nie nach hinten.
    queryFn: () => sitzungLesen(),
    retry: false,
    staleTime: 10_000,
  })

  const sitzung = abfrage.data ?? null

  return {
    laedt: abfrage.isPending,
    sitzung,
    angemeldet: sitzung?.stage === 'PROFILE_AUTHENTICATED',
    pinGeprueft: sitzung?.stage === 'PIN_VERIFIED',
    istAdmin: sitzung?.rolle === 'ADMIN',
    istGast: sitzung?.rolle === 'GAST',
  }
}
