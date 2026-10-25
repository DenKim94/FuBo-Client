/**
 * Inhalt der Push-Benachrichtigungen (C9, 6.5, E31).
 *
 * **Ohne Imports aus der Anwendung und ohne DOM- oder WebWorker-Typen:** Die Datei wird über `sw.ts` mit
 * `tsconfig.worker.json` (`lib: WebWorker`) und über die Seite mit `tsconfig.app.json` (`lib: DOM`) übersetzt, dazu in
 * Vitest. Nur ECMAScript (`Intl`, `Date`) ist in allen drei vorhanden.
 *
 * Der Worker ruft **nie** die API auf (P10): Zur Versandzeit ist die Sitzung meist abgelaufen. Was hier steht, kommt
 * aus der Nutzlast des Servers (`PushNutzlast`, nicht im Vertrag).
 */

/** Nachricht vom Worker an die Seite: in der Anwendung zu `url` navigieren (statt neu zu laden). */
export const NACHRICHT_NAVIGIEREN = 'NAVIGIEREN'

/**
 * Nutzlast des Servers (P9). `titel` und `text` sind ein **immer gefüllter Rückfalltext**; die übrigen Felder können
 * als `null` **oder** gar nicht ankommen. `datum` ist `YYYY-MM-DD`, `uhrzeit` `HH:MM` oder `HH:MM:SS`.
 */
export type Nutzlast = {
  typ?: string
  titel?: string
  text?: string
  terminId?: number | null
  datum?: string | null
  uhrzeit?: string | null
  ort?: string | null
  url?: string | null
}

/** Was der Worker anzeigt. */
export type Anzeige = {
  titel: string
  text: string
  /** `termin-{id}` (die Absage ersetzt die Erinnerung desselben Termins), `probe` für den Probeversand. */
  tag?: string
  /** Bei der Absage `true`: Ersetzt sie eine Erinnerung, soll das Gerät trotzdem erneut melden. */
  renotify: boolean
  /** Pfad des eigenen Ursprungs, zu dem das Antippen führt. */
  url: string
}

/** Letzter Rückfall, wenn selbst der Rückfalltext fehlt (kaputte Nutzlast). Ohne Anwendungsnamen (P13). */
const ERSATZ = { titel: 'Neue Nachricht', text: 'Öffne die App für Einzelheiten.' }

/**
 * Lässt nur Pfade des eigenen Ursprungs durch, sonst `/`.
 *
 * `//fremd.example` und `/\fremd.example` wären fremde Adressen (Browser lesen `\` in der Adresse wie `/`), ebenso
 * jede absolute Adresse.
 *
 * @param url Ein beliebiger Wert aus der Nutzlast oder den Daten der Benachrichtigung.
 */
export function zielPfad(url: unknown): string {
  if (typeof url !== 'string' || !url.startsWith('/')) return '/'
  if (url.startsWith('//') || url.startsWith('/\\')) return '/'
  return url
}

/** Wochentag zu einem Datum `YYYY-MM-DD`, oder `null` bei anderer Form. */
function wochentag(datum: string): string | null {
  const teile = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum)
  if (!teile) return null
  // Aus Teilen gebaut, nicht `new Date('YYYY-MM-DD')`: Das wäre Mitternacht UTC und je nach Zeitzone der Vortag (C5).
  const [jahr, monat, tagImMonat] = [Number(teile[1]), Number(teile[2]) - 1, Number(teile[3])]
  const tag = new Date(jahr, monat, tagImMonat, 12)
  // `Date` rollt Überläufe weiter (13. Monat ⇒ Januar); ein solches Datum ist kaputt, nicht verschoben.
  if (tag.getMonth() !== monat || tag.getDate() !== tagImMonat) return null
  return new Intl.DateTimeFormat('de-DE', { weekday: 'long' }).format(tag)
}

/** `HH:MM` aus `HH:MM` oder `HH:MM:SS`, sonst `null`. */
function uhrzeitKurz(uhrzeit: string | null | undefined): string | null {
  return uhrzeit && /^\d{2}:\d{2}/.test(uhrzeit) ? uhrzeit.slice(0, 5) : null
}

/**
 * Baut die Benachrichtigung aus der Nutzlast (E31).
 *
 * Bei bekanntem `typ` formuliert der Client selbst (Wochentag statt Datum, ohne Anwendungsnamen); fehlen dafür
 * Felder oder ist der `typ` unbekannt (ein älterer Worker), gilt der Rückfalltext des Servers. Liefert **immer**
 * etwas: `userVisibleOnly: true` verpflichtet zur Anzeige.
 *
 * @param n Die Nutzlast oder `null`, wenn sie fehlt oder kein JSON ist.
 */
export function benachrichtigungBauen(n: Nutzlast | null): Anzeige {
  const tag = typeof n?.terminId === 'number' ? `termin-${n.terminId}` : n?.typ === 'PROBE' ? 'probe' : undefined
  const url = zielPfad(n?.url)
  const zeit = uhrzeitKurz(n?.uhrzeit)
  const wtag = n?.datum ? wochentag(n.datum) : null

  if (n?.typ === 'ERINNERUNG' && wtag && zeit) {
    return {
      titel: `Kicken am ${wtag}, ${zeit} Uhr`,
      text: n.ort ? `Bitte gib Bescheid, ob du dabei bist. Ort: ${n.ort}` : 'Bitte gib Bescheid, ob du dabei bist.',
      tag,
      renotify: false,
      url,
    }
  }
  if (n?.typ === 'TERMIN_ABGESAGT' && wtag) {
    return { titel: `Kicken am ${wtag} fällt aus`, text: 'Der Termin wurde abgesagt.', tag, renotify: true, url }
  }
  if (n?.typ === 'PROBE') {
    return {
      titel: 'Testbenachrichtigung',
      text: n.text || 'Der Versand funktioniert auf diesem Gerät.',
      tag,
      renotify: false,
      url,
    }
  }
  return { titel: n?.titel || ERSATZ.titel, text: n?.text || ERSATZ.text, tag, renotify: false, url }
}
