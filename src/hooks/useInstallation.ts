import { useSyncExternalStore } from 'react'
import { installationAbonnieren, installationMoeglich } from '@/pwa/installation'
import { umgebungLesen } from '@/pwa/umgebung'

/**
 * Weg zur Installation (E32): `knopf` (Ereignis zurückgehalten), `ios` (iOS, nicht abgelegt), `menue` (sonst, nicht
 * installiert) oder `null` (läuft schon als App).
 */
export type InstallationsWeg = 'knopf' | 'ios' | 'menue' | null

/** Meldet Änderungen an Ereignis und Anzeigemodus (nach der Installation wechselt `display-mode`). */
function abonnieren(rueckruf: () => void): () => void {
  const abmelden = installationAbonnieren(rueckruf)
  const medien = typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)') : null
  medien?.addEventListener?.('change', rueckruf)
  return () => {
    abmelden()
    medien?.removeEventListener?.('change', rueckruf)
  }
}

/** Schnappschuss als Zeichenkette: `useSyncExternalStore` vergleicht mit `Object.is`, ein Objekt wäre jedes Mal neu. */
function schnappschuss(): Exclude<InstallationsWeg, null> | 'installiert' {
  const umgebung = umgebungLesen()
  if (umgebung.standalone) return 'installiert'
  if (installationMoeglich()) return 'knopf'
  if (umgebung.ios) return 'ios'
  return 'menue'
}

/**
 * Wie sich die App auf diesem Gerät installieren lässt (C9, 7.1).
 *
 * Über `useSyncExternalStore` statt eines Werts beim Rendern: Das Ereignis kann jederzeit nach dem ersten Rendern
 * kommen, und nach der Installation ändert sich der Anzeigemodus.
 */
export function useInstallation(): InstallationsWeg {
  const stand = useSyncExternalStore(abonnieren, schnappschuss, () => 'menue' as const)
  return stand === 'installiert' ? null : stand
}
