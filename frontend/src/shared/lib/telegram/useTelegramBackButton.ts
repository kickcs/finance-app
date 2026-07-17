import { onMounted, onUnmounted } from 'vue';

/**
 * Нативная стрелка «назад» Telegram Mini App. Вне Telegram (обычный веб,
 * SDK не загружен или initData пуст) — no-op. SDK уже загружен точкой входа
 * /tma, поэтому здесь только window.Telegram, без ленивой подгрузки скрипта.
 */
export function useTelegramBackButton(handler: () => void) {
  const webApp = () => window.Telegram?.WebApp;

  onMounted(() => {
    const wa = webApp();
    if (!wa?.initData) return;
    wa.BackButton.onClick(handler);
    wa.BackButton.show();
  });

  onUnmounted(() => {
    const wa = webApp();
    if (!wa?.initData) return;
    wa.BackButton.offClick(handler);
    wa.BackButton.hide();
  });
}
