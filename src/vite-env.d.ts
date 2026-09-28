/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string;
  readonly VITE_APP_BUILT_AT?: string;
  readonly VITE_PLATFORM_RUNTIME_MODE?: string;
  readonly VITE_GIT_COMMIT?: string;
  readonly VITE_GIT_BRANCH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
