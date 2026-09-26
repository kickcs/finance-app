import type { TelegramWebApp } from './loadTelegramWebApp';

// Совпадает с --color-background-dark/--color-background-light в
// app/styles/index.css — шапка/фон/нижняя панель Telegram красятся под фон
// приложения, а не остаются дефолтным telegram-синим.
const BACKGROUND_DARK = '#09090b';
const BACKGROUND_LIGHT = '#f2f2f8';

/** Полноэкранный режим (Bot API 8.0) есть только у мобильных клиентов — у
 * десктопа/веба своя оконная модель, им достаточно обычного expand(). */
function shouldRequestFullscreen(
  wa: Pick<TelegramWebApp, 'isVersionAtLeast' | 'platform'>,
): boolean {
  return wa.isVersionAtLeast('8.0') && (wa.platform === 'ios' || wa.platform === 'android');
}

/** `html.tma-fullscreen` включает --safe-area-inset-top с учётом кнопок
 * Telegram поверх контента (см. app/styles/index.css). */
function applyFullscreenClass(isFullscreen: boolean): void {
  document.documentElement.classList.toggle('tma-fullscreen', isFullscreen);
}

/**
 * Донастраивает TMA-шелл поверх голого ready()/expand(): полноэкранный режим
 * на мобильных клиентах, запрет свайпа вниз (иначе им тянет шторку — сворачивает
 * всю мини-апу вместо неё), цвета хрома под тему приложения. Вызывать один раз
 * сразу после ready()/expand().
 *
 * Возвращает cleanup, снимающий подписку на fullscreenChanged.
 */
export function setupTelegramShell(wa: TelegramWebApp, colorScheme: 'light' | 'dark'): () => void {
  if (shouldRequestFullscreen(wa)) wa.requestFullscreen();

  // 7.7 — версия, с которой клиент вообще умеет disableVerticalSwipes.
  if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes();

  // 6.1 — минимальная версия, принимающая hex в setHeaderColor/setBackgroundColor.
  if (wa.isVersionAtLeast('6.1')) {
    const background = colorScheme === 'dark' ? BACKGROUND_DARK : BACKGROUND_LIGHT;
    wa.setHeaderColor(background);
    wa.setBackgroundColor(background);
    // 7.10 — нижняя панель (Android) появилась позже хедера и фона.
    if (wa.isVersionAtLeast('7.10')) wa.setBottomBarColor?.(background);
  }

  applyFullscreenClass(wa.isFullscreen);
  const onFullscreenChanged = () => applyFullscreenClass(wa.isFullscreen);
  wa.onEvent('fullscreenChanged', onFullscreenChanged);

  return () => wa.offEvent('fullscreenChanged', onFullscreenChanged);
}
