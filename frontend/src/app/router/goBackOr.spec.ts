import { describe, it, expect, vi, afterEach } from 'vitest';
import { router, goBackOr } from './index';
import { ROUTE_NAMES } from './routeNames';

/**
 * `goBackOr` — страховка для экранов, куда можно попасть без истории (deep
 * link, push-уведомление, TMA-старт через `replace`): голый `router.back()`
 * там молча ничего не делает.
 */
describe('goBackOr', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window.history, 'state', { value: null, configurable: true });
  });

  it('уходит через router.back(), когда в истории есть предыдущая запись', () => {
    Object.defineProperty(window.history, 'state', {
      value: { back: '/somewhere' },
      configurable: true,
    });
    const backSpy = vi.spyOn(router, 'back').mockImplementation(() => {});
    const replaceSpy = vi.spyOn(router, 'replace').mockImplementation(() => Promise.resolve());

    goBackOr({ name: ROUTE_NAMES.DASHBOARD });

    expect(backSpy).toHaveBeenCalledOnce();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it('уходит на фолбэк через replace, когда истории нет', () => {
    Object.defineProperty(window.history, 'state', {
      value: { back: null },
      configurable: true,
    });
    const backSpy = vi.spyOn(router, 'back').mockImplementation(() => {});
    const replaceSpy = vi.spyOn(router, 'replace').mockImplementation(() => Promise.resolve());

    goBackOr({ name: ROUTE_NAMES.DASHBOARD });

    expect(replaceSpy).toHaveBeenCalledWith({ name: ROUTE_NAMES.DASHBOARD });
    expect(backSpy).not.toHaveBeenCalled();
  });
});
