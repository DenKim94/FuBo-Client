/**
 * Versionsnummer der Anwendung, z. B. `1.1.0` (seit 03.11.2026).
 *
 * Einzige Quelle ist `version` in `package.json`; Vite setzt sie beim Bau ein (`define` in `vite.config.ts`). Erhöht wird
 * sie mit `npm version patch|minor|major --no-git-tag-version`. Angezeigt wird sie nur auf der PIN-Seite.
 */
export const APP_VERSION: string = __APP_VERSION__
