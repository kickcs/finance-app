import { describe, it, expect, afterEach, vi } from 'vitest';
import { setupTelegramShell } from './setupTelegramShell';
import type { TelegramWebApp } from './loadTelegramWebApp';

/** Мини-заглушка `Telegram.WebApp`: только то, что трогает setupTelegramShell. */
function fakeWebApp(overrides: Partial<TelegramWebApp> = {}): TelegramWebApp {
  const versions = ['6.0', '6.1', '7.7', '7.10', '8.0'];
  return {
    initData: '',
    colorScheme: 'light',
    version: '8.0',
    platform: 'ios',
    isFullscreen: false,
    BackButton: {
      isVisible: false,
      show: vi.fn(),
      hide: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    },
    ready: vi.fn(),
    expand: vi.fn(),
    openLink: vi.fn(),
    isVersionAtLeast: (v: string) =>
      versions.indexOf(overrides.version ?? '8.0') >= versions.indexOf(v),
    requestFullscreen: vi.fn(),
    disableVerticalSwipes: vi.fn(),
    setHeaderColor: vi.fn(),
    setBackgroundColor: vi.fn(),
    setBottomBarColor: vi.fn(),
    onEvent: vi.fn(),
    offEvent: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  document.documentElement.classList.remove('tma-fullscreen');
});

describe('setupTelegramShell', () => {
  it('iOS 8.0: запрашивает полноэкранный режим и запрещает вертикальные свайпы', () => {
    const wa = fakeWebApp({ platform: 'ios', version: '8.0' });
    setupTelegramShell(wa, 'dark');

    expect(wa.requestFullscreen).toHaveBeenCalledOnce();
    expect(wa.disableVerticalSwipes).toHaveBeenCalledOnce();
  });

  it('десктопный клиент (tdesktop) не запрашивает полноэкранный режим даже на 8.0', () => {
    const wa = fakeWebApp({ platform: 'tdesktop', version: '8.0' });
    setupTelegramShell(wa, 'light');

    expect(wa.requestFullscreen).not.toHaveBeenCalled();
  });

  it('версия ниже 8.0 не запрашивает полноэкранный режим', () => {
    const wa = fakeWebApp({ platform: 'android', version: '7.10' });
    setupTelegramShell(wa, 'light');

    expect(wa.requestFullscreen).not.toHaveBeenCalled();
    // 7.10 всё ещё должно ставить цвета и swipe-блок — это версии из другой ветки
    expect(wa.disableVerticalSwipes).toHaveBeenCalledOnce();
    expect(wa.setBottomBarColor).toHaveBeenCalledOnce();
  });

  it('версия ниже 7.7 не трогает disableVerticalSwipes', () => {
    const wa = fakeWebApp({ platform: 'ios', version: '6.1' });
    setupTelegramShell(wa, 'light');

    expect(wa.disableVerticalSwipes).not.toHaveBeenCalled();
    expect(wa.setHeaderColor).toHaveBeenCalledOnce();
  });

  it('версия ниже 6.1 не выставляет цвета вовсе', () => {
    const wa = fakeWebApp({ platform: 'ios', version: '6.0' });
    setupTelegramShell(wa, 'dark');

    expect(wa.setHeaderColor).not.toHaveBeenCalled();
    expect(wa.setBackgroundColor).not.toHaveBeenCalled();
  });

  it('цвета берутся по теме приложения: dark → фон тёмный, light → светлый', () => {
    const dark = fakeWebApp({ version: '8.0' });
    setupTelegramShell(dark, 'dark');
    expect(dark.setHeaderColor).toHaveBeenCalledWith('#09090b');
    expect(dark.setBackgroundColor).toHaveBeenCalledWith('#09090b');

    const light = fakeWebApp({ version: '8.0' });
    setupTelegramShell(light, 'light');
    expect(light.setHeaderColor).toHaveBeenCalledWith('#f2f2f8');
  });

  it('выставляет html.tma-fullscreen сразу по wa.isFullscreen и на событие fullscreenChanged', () => {
    const wa = fakeWebApp({ isFullscreen: true });
    setupTelegramShell(wa, 'light');
    expect(document.documentElement.classList.contains('tma-fullscreen')).toBe(true);

    const [, handler] = (wa.onEvent as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'fullscreenChanged',
    )!;
    wa.isFullscreen = false;
    handler();
    expect(document.documentElement.classList.contains('tma-fullscreen')).toBe(false);
  });

  it('возвращает cleanup, снимающий подписку на fullscreenChanged', () => {
    const wa = fakeWebApp();
    const cleanup = setupTelegramShell(wa, 'light');
    cleanup();

    const [, handler] = (wa.onEvent as ReturnType<typeof vi.fn>).mock.calls.find(
      ([event]) => event === 'fullscreenChanged',
    )!;
    expect(wa.offEvent).toHaveBeenCalledWith('fullscreenChanged', handler);
  });
});
