/**
 * Ленивая загрузка SDK Telegram Mini Apps.
 * Скрипт нужен только странице /tma, поэтому не подключён в index.html.
 */
const SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js';

export interface TelegramWebApp {
  /** Сырая строка initData для серверной валидации; пустая вне Telegram */
  initData: string;
  colorScheme: 'light' | 'dark';
  /** Версия Bot API клиента, напр. "8.0" — сверяется через isVersionAtLeast */
  version: string;
  platform: 'ios' | 'android' | 'tdesktop' | 'weba' | 'webk' | 'macos' | 'unknown' | string;
  /** Развёрнута ли мини-апа в полноэкранном режиме (Bot API 8.0) */
  isFullscreen: boolean;
  BackButton: {
    isVisible: boolean;
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
  ready(): void;
  expand(): void;
  openLink(url: string): void;
  isVersionAtLeast(version: string): boolean;
  requestFullscreen(): void;
  disableVerticalSwipes(): void;
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor?(color: string): void;
  onEvent(eventType: string, callback: () => void): void;
  offEvent(eventType: string, callback: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

let loadPromise: Promise<TelegramWebApp | null> | null = null;

export function loadTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  loadPromise ??= new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return loadPromise;
}
