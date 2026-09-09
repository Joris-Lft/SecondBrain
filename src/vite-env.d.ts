/// <reference types="vite/client" />

/** Version applicative injectée au build (voir `define` dans vite.config.ts). */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  /**
   * Clé publique par conception : elle n'ouvre que ce que les politiques Row
   * Level Security autorisent. La clé secrète, elle, ne doit jamais être
   * préfixée `VITE_` — Vite n'expose que ce préfixe au bundle.
   */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
