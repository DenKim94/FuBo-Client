import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Bauvorgang des Clients.
 *
 * PWA-Strategie ist bewusst `injectManifest` und nicht `generateSW`:
 * A25b verlangt einen Service Worker, der die Ereignisse `push` und
 * `notificationclick` selbst behandelt und aus den Feldern der Nutzlast eine
 * eigene Formulierung baut. Ein von Workbox erzeugter Worker nimmt keinen
 * eigenen Code auf. Der Worker liegt deshalb als `src/sw.ts` im Quellbaum.
 */
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // Kein `autoUpdate`: Ein Neuladen mitten in der Ergebniserfassung waere
      // nicht rueckholbar, weil der erste Eintrag gilt (A21).
      registerType: 'prompt',
      // Die Registrierung uebernimmt `useRegisterSW` in der Anwendung.
      injectRegister: false,
      // Nur was die Offline-Hinweisseite braucht.
      includeAssets: ['icons/no_connection_icon_red.svg'],
      // Die Manifest-Icons liest das Betriebssystem beim Installieren aus dem
      // Manifest; die laufende Anwendung braucht sie nicht. Im Precache waeren
      // sie rund 600 kB, die bei jeder Aktualisierung erneut geprueft werden.
      includeManifestIcons: false,
      manifest: {
        name: 'MONTAGS-KICKER',
        // Der `short_name` ist die Beschriftung unter dem Symbol auf dem
        // Startbildschirm. Startbildschirme kuerzen nach rund zwoelf Zeichen,
        // `MONTAGS-KICKER` hat vierzehn. Deshalb eine Kurzform - aber nicht
        // "FuBo": Das ist Projekt- und Repositoriumsname und erscheint nicht in
        // der Oberflaeche (AGENT_CLIENT.md). Festgelegt am 26.09.2026.
        short_name: 'GUT-KICK',
        description: 'Teameinteilung und Terminverwaltung fuer die Trainingsgruppe.',
        lang: 'de',
        dir: 'ltr',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        background_color: '#ffffff',
        // Muss mit <meta name="theme-color"> in index.html uebereinstimmen.
        theme_color: '#0b6b3a',
        icons: [
          // Ohne `purpose` gilt `any`. Chrome zaehlt ein rein maskierbares Icon
          // fuer die Installierbarkeit nicht mit; fehlt die 512er mit `any`,
          // feuert `beforeinstallprompt` stillschweigend nicht (A25a).
          { src: 'icons/pwa/app-icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa/app-icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/pwa/app-icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/pwa/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      injectManifest: {
        // Nur die App-Shell. Icons und Bilder bleiben draussen, sonst waechst
        // der Precache um rund ein Megabyte, das bei jeder Aktualisierung
        // erneut geprueft wird.
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
      devOptions: {
        // Service Worker auch unter `npm run dev` pruefbar.
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Ueber den Proxy laufen Anwendung und API in der Entwicklung unter
      // demselben Origin: keine CORS-Vorabanfragen, `credentials: 'include'`
      // verhaelt sich wie im Betrieb, und die Denylist `/api/` im Service
      // Worker ist ueberhaupt erst pruefbar.
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
