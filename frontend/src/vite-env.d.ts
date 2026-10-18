/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://fieldcard.onrender.com */
  readonly VITE_API_URL?: string
  readonly NEXT_PUBLIC_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
