import { Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import type { RoutenAngaben } from '@/app/routenAngaben'
import { LOGIN_PFADE } from '@/app/schutz/zielpfad'
import SitzungsWaechter from '@/app/SitzungsWaechter'
import AktualisierungsHinweis from '@/components/AktualisierungsHinweis/AktualisierungsHinweis'
import CustomButton from '@/components/CustomButton/CustomButton'
import OfflineHinweis from '@/components/OfflineHinweis/OfflineHinweis'
import style from './AppLayout.module.scss'

/**
 * Erkennt, ob die aktuelle Ansicht der erste Eintrag dieser Anwendung im Verlauf ist.
 *
 * Beim Direkteinstieg – Deeplink, Lesezeichen, Start der installierten PWA –
 * gibt es nichts, wohin `navigate(-1)` innerhalb der Anwendung führen könnte:
 * Der Schritt verliesse sie oder bliebe wirkungslos.
 *
 * **Erkennung über `history.state.idx`**, den Zähler, den React Router in jeden
 * Verlaufseintrag schreibt (0 = erster Eintrag). Nachgemessen: Beim
 * Direkteinstieg steht `{"idx":0}`. `history.length` taugt nicht – es zählt
 * auch Einträge anderer Seiten im selben Tab (Wert 2 trotz Direkteinstieg).
 * Auch der Schlüssel `location.key === 'default'` reicht nicht: Eine Umleitung
 * mit `replace` (etwa nach der Anmeldung zurück zum Deeplink) vergibt einen
 * neuen Schlüssel, `idx` bleibt dagegen 0.
 */
function istDirekteinstieg(): boolean {
  const idx = (window.history.state as { idx?: unknown } | null)?.idx
  return typeof idx !== 'number' || idx <= 0
}

/**
 * Rahmen aller Ansichten.
 *
 * Stellt die sichtbare Zurueck-Navigation bereit, die im Anzeigemodus
 * `standalone` an die Stelle der fehlenden Browser-Schaltflaeche tritt (A25a).
 * Auf Android faengt die Systemgeste das ab, auf iOS nicht zuverlaessig – eine
 * eigene Schaltflaeche ist deshalb keine Bequemlichkeit.
 *
 * **Wohin „Zurück" führt** (C2, Abschnitt 6.1), in dieser Reihenfolge:
 * 1. zur übergeordneten Ansicht aus `handle.zurueck` der Route,
 * 2. sonst einen Schritt im Verlauf zurück,
 * 3. beim Direkteinstieg zur Startseite statt aus der Anwendung hinaus.
 *
 * Die Safe-Area-Raender liegen ebenfalls hier, damit sie jede Ansicht erreichen,
 * ohne dass jede Ansicht sie kennen muss.
 */
export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const istStartseite = pathname === LOGIN_PFADE.start
  const angaben = useMatches().map((treffer) => treffer.handle as RoutenAngaben | undefined)
  // Eine Route kann die Schaltflaeche ueber ihr `handle` abbestellen (Login-Schritte).
  const ohneZurueck = angaben.some((angabe) => angabe?.ohneZurueck)
  // Die innerste Route mit Zielangabe gilt.
  const ziel = angaben.findLast((angabe) => angabe?.zurueck)?.zurueck

  /** Führt zur übergeordneten Ansicht, einen Schritt zurück oder zur Startseite. */
  function zurueck() {
    if (ziel) return void navigate(ziel)
    if (istDirekteinstieg()) return void navigate(LOGIN_PFADE.start)
    return void navigate(-1)
  }

  return (
    <div className={style.rahmen} data-testid="app-layout">
      {/* Rendert nichts; verbindet die globale 401-Behandlung mit dem Router. */}
      <SitzungsWaechter />

      <header className={style.kopf}>
        {!istStartseite && !ohneZurueck && (
          <CustomButton art="sekundaer" onClick={zurueck} data-testid="layout-zurueck">
            Zurück
          </CustomButton>
        )}
      </header>

      <OfflineHinweis />

      <main className={style.inhalt}>
        <Outlet />
      </main>

      <AktualisierungsHinweis />
    </div>
  )
}
