/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OBSCUR_DESKTOP_UI_LAB_STUBS?: string;
  readonly OBSCUR_PRIVATE_DC_BASE_URL?: string;
  readonly OBSCUR_PRIVATE_DC_BEARER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
