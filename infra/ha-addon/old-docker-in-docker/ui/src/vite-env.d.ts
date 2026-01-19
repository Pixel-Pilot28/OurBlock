/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HC_PORT: string;
  readonly VITE_HC_ADMIN_PORT: string;
  readonly VITE_HC_HOST: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
