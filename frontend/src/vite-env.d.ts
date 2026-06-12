/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base da API em produção (ex.: https://pulso-api.onrender.com/api). Vazio em dev → usa proxy /api. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
