/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string;
  readonly VITE_VAPID_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}

interface Window {
  LemonSqueezy?: {
    Url: { Open(url: string): void };
  };
  /** Создаёт `window.LemonSqueezy`. lemon.js вызывает это сам только по событию
   *  `load` окна — при ленивом подключении инициализировать нужно вручную. */
  createLemonSqueezy?: () => void;
}
