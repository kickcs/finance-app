/**
 * Ленивая загрузка SDK Telegram Mini Apps.
 * Скрипт нужен только странице /tma, поэтому не подключён в index.html.
 */
const SCRIPT_SRC = 'https://telegram.org/js/telegram-web-app.js';

export interface TelegramWebApp {
  /** Сырая строка initData для серверной валидации; пустая вне Telegram */
  initData: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  openLink(url: string): void;
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
