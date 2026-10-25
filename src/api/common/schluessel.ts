/**
 * Alle Query-Schlüssel der Anwendung.
 *
 * An einem Ort, weil das Invalidieren sonst rät: Nach einer Zu- oder Absage muss
 * die Teilnehmerliste neu geladen werden, und wer den Schlüssel dort
 * abschreibt, trifft ihn irgendwann knapp daneben – ohne Fehlermeldung, nur mit
 * einer Ansicht, die alte Zahlen zeigt.
 *
 * Die Einträge entstehen mit den Paketen, die sie brauchen; hier stehen die
 * bereits absehbaren.
 */
export const schluessel = {
  sitzung: ['sitzung'] as const,
  /**
   * Restlaufzeit der Sitzung (Countdown, Ablauf-Dialog). **Eigener Schlüssel**, weil
   * dieser Abruf mit `X-FuBo-Kein-Refresh` läuft und `sitzung` ohne – beide teilten
   * sich sonst eine Abfragefunktion und damit entweder den Kopf oder dessen Fehlen.
   * Beginnt mit `sitzung`: Der Stufenwechsel (`useSitzungswechsel`) behält und
   * invalidiert ihn gemeinsam mit der Sitzung.
   */
  sitzungFrist: ['sitzung', 'frist'] as const,
  namensliste: ['namensliste'] as const,
  termine: ['termine'] as const,
  termin: (terminId: string) => ['termin', terminId] as const,
  /** Präfix aller Einzeltermine, für `invalidateQueries` nach einer Rückmeldung. */
  terminAlle: ['termin'] as const,
  /** Verlaufsabruf (E14). Eigener Wurzelschlüssel: `invalidateQueries(termine)` trifft ihn nicht. */
  termineVerlauf: ['termineVerlauf'] as const,
  bilanz: ['bilanz'] as const,
  /**
   * Push (C9). Alle drei unter der Wurzel `push`: `useSitzungswechsel` entfernt sie beim Personenwechsel mit.
   * `pushStatus` ist Anlagen- und Personenebene vom Server, `pushSchluessel` der VAPID-Schlüssel (bei `503` ohne
   * Wiederholung), `pushGeraet` der **lokale** Gerätezustand aus dem Browser (kein Netz).
   */
  pushStatus: ['push', 'status'] as const,
  pushSchluessel: ['push', 'schluessel'] as const,
  pushGeraet: ['push', 'geraet'] as const,
  /** Admin-Abfragen. Wurzel `admin`: hebt sie von den Abfragen der Spieler ab. */
  adminProfile: ['admin', 'profile'] as const,
  adminSkills: ['admin', 'skills'] as const,
  /** Konfiguration des Admins (C8). Jeder Besuch liest frisch (`gcTime: 0`). */
  adminKonfiguration: ['admin', 'konfiguration'] as const,
  /** Gastplätze und ihr Zustand (C8). */
  adminGaeste: ['admin', 'gaeste'] as const,
} as const
