import type { PushStatus } from '@/api/push/push'
import type { GeraetStand } from './pushGeraet'
import type { Umgebung } from './umgebung'

/**
 * Lage der Geräteebene (C9, 4.3, E24). Die Reihenfolge der Prüfungen ist fachlich: Was der Nutzer **nicht** ändern
 * kann, kommt zuerst.
 */
export type GeraetLage =
  | 'server'
  | 'unsicher'
  | 'iosAblegen'
  | 'nichtMoeglich'
  | 'blockiert'
  | 'eingerichtet'
  | 'nichtEingerichtet'

/** Eingaben der Lageberechnung; `undefined` heißt „noch nicht gelesen“. */
export type LageEingabe = {
  /** Kommt mit dem Gerätestand aus `usePushGeraet`; `undefined`, solange er lädt. */
  umgebung: Umgebung | undefined
  geraet: GeraetStand | undefined
  /** `false` bei `503 PUSH_NICHT_KONFIGURIERT`. */
  schluesselVerfuegbar: boolean | undefined
}

/**
 * Bestimmt die Gerätelage.
 *
 * @returns Die Lage oder `undefined`, solange eine nötige Angabe fehlt (Ladezustand).
 */
export function geraetLage({ umgebung, geraet, schluesselVerfuegbar }: LageEingabe): GeraetLage | undefined {
  if (schluesselVerfuegbar === undefined) return undefined
  if (!schluesselVerfuegbar) return 'server'
  if (umgebung === undefined) return undefined
  if (!umgebung.sicher) return 'unsicher'
  if (umgebung.ios && !umgebung.standalone) return 'iosAblegen'
  if (!umgebung.pushMoeglich) return 'nichtMoeglich'
  if (geraet === undefined) return undefined
  if (geraet.berechtigung === 'denied') return 'blockiert'
  if (geraet.abo !== null) return 'eingerichtet'
  return 'nichtEingerichtet'
}

/**
 * Anleitung zum Ablegen auf dem iPhone (C9, 7.1), ohne fremde Markensymbole. Steht in den Einstellungen statt eines
 * toten Schalters und im Onboarding.
 */
export const IOS_ANLEITUNG =
  'Tippe in Safari auf „Teilen“ und dann auf „Zum Home-Bildschirm“. Danach startest du die App vom Home-Bildschirm – erst dort gibt es Benachrichtigungen.'

/** Text der Gerätezeile je Lage. */
export const GERAET_TEXT: Record<GeraetLage, string> = {
  server: 'Benachrichtigungen sind auf diesem Server nicht eingerichtet.',
  unsicher: 'Nur über eine sichere Verbindung (https) möglich.',
  iosAblegen: 'Auf dem iPhone erst, wenn die App auf dem Home-Bildschirm liegt.',
  nichtMoeglich: 'Dieser Browser unterstützt keine Benachrichtigungen.',
  blockiert: 'Im Browser blockiert. Erlaube Benachrichtigungen in den Einstellungen des Browsers für diese Seite.',
  eingerichtet: 'Auf diesem Gerät eingerichtet.',
  nichtEingerichtet: 'Auf diesem Gerät nicht eingerichtet.',
}

/** Kurzer Grund je Lage für den Gesamtsatz (ohne „eingerichtet“, das hindert nicht). */
const GERAET_GRUND: Record<Exclude<GeraetLage, 'eingerichtet'>, string> = {
  server: 'Sie sind auf diesem Server nicht eingerichtet',
  unsicher: 'Die Verbindung ist nicht sicher',
  iosAblegen: 'Die App liegt noch nicht auf dem Home-Bildschirm',
  nichtMoeglich: 'Der Browser unterstützt sie nicht',
  blockiert: 'Sie sind im Browser blockiert',
  nichtEingerichtet: 'Es ist noch nicht eingerichtet',
}

/** Text der Anlagenebene. */
export function anlageText(anlageAktiv: boolean): string {
  return anlageAktiv ? 'Vom Admin eingeschaltet' : 'Vom Admin abgeschaltet – zurzeit gehen an niemanden Benachrichtigungen.'
}

/** Text der Personenebene. */
export function personText(pushErwuenscht: boolean): string {
  return pushErwuenscht ? 'Für dich eingeschaltet (alle deine Geräte)' : 'Von dir abgeschaltet'
}

/**
 * Ein Gesamtsatz unter den drei Zeilen (E24): Passt alles, sagt er es; sonst nennt er die **erste** hindernde Ebene
 * in der Reihenfolge Anlage, Person, Gerät.
 *
 * **Für den Admin** zählen Anlage und Person nicht (P12): Er bekommt nur den Probeversand, und der prüft die Schalter
 * nicht. Sein Satz betrifft nur das Gerät.
 *
 * @returns Der Satz oder `undefined`, solange eine Angabe fehlt.
 */
export function gesamtsatz(lage: GeraetLage | undefined, status: PushStatus | undefined, istAdmin: boolean): string | undefined {
  if (lage === undefined) return undefined
  if (istAdmin) {
    return lage === 'eingerichtet'
      ? 'Dieses Gerät empfängt den Probeversand.'
      : `Dieses Gerät empfängt keinen Probeversand: ${GERAET_GRUND[lage]}.`
  }
  if (status === undefined) return undefined
  if (!status.anlageAktiv) return 'Zurzeit kommen keine Benachrichtigungen an: Der Admin hat den Versand abgeschaltet.'
  if (!status.pushErwuenscht) return 'Zurzeit kommen keine Benachrichtigungen an: Du hast sie für dich abgeschaltet.'
  if (lage !== 'eingerichtet') return `Auf diesem Gerät kommen keine Benachrichtigungen an: ${GERAET_GRUND[lage]}.`
  return 'Du bekommst Erinnerungen und Absagen auf diesem Gerät.'
}
