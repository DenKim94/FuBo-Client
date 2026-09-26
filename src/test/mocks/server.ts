import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/**
 * Abfangender Server für Unit- und Komponententests.
 *
 * Bewusst neben den Handlern und nicht in `setup.ts`: Tests, die einen Handler
 * für einen Einzelfall überschreiben, importieren dann die Mock-Schicht und
 * nicht die Testrahmen-Konfiguration.
 *
 * MSW fängt auf der Netzebene ab statt `fetch` zu ersetzen. Damit prüft ein Test
 * nicht nur, **dass** eine Funktion aufgerufen wird, sondern dass die Anwendung
 * die richtige Anfrage stellt – Pfad, Methode, Rumpf und Kopfzeilen. Genau dort
 * liegen die Fehler, die sonst erst im Betrieb auffallen.
 */
export const mockServer = setupServer(...handlers)
