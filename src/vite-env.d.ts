/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STOREFRONT_URL: string;
  // V3 BYOT storefront host template ({subdomain} placeholder); used only for
  // previewing V3 marketplace themes. Empty/undefined on envs without a V3
  // storefront (preview falls back to VITE_STOREFRONT_URL).
  readonly VITE_V3_STOREFRONT_URL?: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_ENVIRONMENT: string;
  readonly VITE_SENTRY_RELEASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
