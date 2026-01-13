/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_DEMO_PROJECT_ID: string
  readonly VITE_DEMO_USER_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
