/// <reference types="vite/client" />

/**
 * Eigene Umgebungsvariablen. Ohne diese Deklaration waeren sie `any` und ein
 * Tippfehler im Namen fiele erst zur Laufzeit auf.
 */
interface ImportMetaEnv {
  /** Basis der API, z. B. `/api/v1` (Entwicklung, ueber den Vite-Proxy). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Versionsnummer aus `package.json`, beim Bau von Vite eingesetzt (`define` in `vite.config.ts`). Nur über `@/app/version` lesen. */
declare const __APP_VERSION__: string
