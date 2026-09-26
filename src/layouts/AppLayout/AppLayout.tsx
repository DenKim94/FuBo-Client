import { Outlet, useLocation, useNavigate } from 'react-router'
import AktualisierungsHinweis from '@/komponenten/AktualisierungsHinweis/AktualisierungsHinweis'
import stile from './AppLayout.module.scss'

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
    <div className={stile.rahmen} data-testid="app-layout">
      <header className={stile.kopf}>
        {!istStartseite && (
          <button
            type="button"
            className={stile.zurueck}
            onClick={() => void navigate(-1)}
            data-testid="layout-zurueck"
          >
            Zurueck
          </button>
        )}
      </header>

      <main className={stile.inhalt}>
        <Outlet />
      </main>

      <AktualisierungsHinweis />
    </div>
  )
}
