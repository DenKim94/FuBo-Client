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
  teams: (terminId: string) => ['teams', terminId] as const,
  bilanz: ['bilanz'] as const,
  pushStatus: ['push', 'status'] as const,
} as const
