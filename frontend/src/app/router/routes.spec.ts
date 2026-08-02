import { describe, it, expect } from 'vitest';
import { router } from './index';
import { ROUTE_NAMES } from './routeNames';

/**
 * Тесты страниц монтируют компоненты напрямую и сами задают meta, поэтому
 * ошибку «забыли пометить настоящий маршрут» они не поймают. Здесь проверяется
 * именно боевая таблица маршрутов.
 */
describe('таблица маршрутов', () => {
  it('«Новая операция» помечена как оверлей — иначе на десктопе она откроется полноэкранной страницей', () => {
    const route = router.getRoutes().find((r) => r.name === ROUTE_NAMES.NEW_TRANSACTION);

    expect(route).toBeDefined();
    expect(route?.meta.desktopOverlay).toBe(true);
  });

  it('страницы подключены ленивыми загрузчиками — иначе роутер не станет их ждать', () => {
    // Синхронный компонент маршрута vue-router не ждёт: заставка снимается по
    // `router.isReady()`, и с ней экран гас бы до прихода чанка.
    const lazyRouteNames = [
      ROUTE_NAMES.DASHBOARD,
      ROUTE_NAMES.ACCOUNTS,
      ROUTE_NAMES.NEW_TRANSACTION,
      ROUTE_NAMES.HISTORY,
    ];

    for (const name of lazyRouteNames) {
      const route = router.getRoutes().find((r) => r.name === name);
      expect(route, `маршрут ${String(name)} не найден`).toBeDefined();
      expect(
        typeof route?.components?.default,
        `маршрут ${String(name)} подключён не ленивым загрузчиком`,
      ).toBe('function');
    }
  });

  it('оболочка приложения тоже подключена лениво', () => {
    const root = router.getRoutes().find((r) => r.path === '/' && r.children.length > 0);

    expect(typeof root?.components?.default).toBe('function');
  });
});
