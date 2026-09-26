import { Outlet, useLocation, useNavigate } from 'react-router'
import SitzungsWaechter from '@/app/SitzungsWaechter'
import AktualisierungsHinweis from '@/komponenten/AktualisierungsHinweis/AktualisierungsHinweis'
import OfflineHinweis from '@/komponenten/OfflineHinweis/OfflineHinweis'
import style from './AppLayout.module.scss'

/**
 * Rahmen aller Ansichten.
 *
 * Stellt die sichtbare Zurueck-Navigation bereit, die im Anzeigemodus
 * `standalone` an die Stelle der fehlenden Browser-Schaltflaeche tritt (A25a).
 * Auf Android faengt die Systemgeste das ab, auf iOS nicht zuverlaessig – eine
 * eigene Schaltflaeche ist deshalb keine Bequemlichkeit.
 *
 * Die Safe-Area-Raender liegen ebenfalls hier, damit sie jede Ansicht erreichen,
 * ohne dass jede Ansicht sie kennen muss.
 */
export default function AppLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const istStartseite = pathname === '/'

  return (
    <div className={style.rahmen} data-testid="app-layout">
      {/* Rendert nichts; verbindet die globale 401-Behandlung mit dem Router. */}
      <SitzungsWaechter />

      <header className={style.kopf}>
        {!istStartseite && (
          <button
            type="button"
            className={style.zurueck}
            onClick={() => void navigate(-1)}
            data-testid="layout-zurueck"
          >
            Zurück
          </button>
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
