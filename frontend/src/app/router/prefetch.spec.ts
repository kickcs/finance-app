import { describe, it, expect, afterEach } from 'vitest';
import { setIsDesktopForTests } from '@/shared/lib/platform';
import { getPrefetchTargets, PREFETCH_LOADER_NAMES } from './prefetchTargets';

afterEach(() => setIsDesktopForTests(null));

describe('цели префетча', () => {
  it('на мобиле не качает десктопные варианты страниц', () => {
    setIsDesktopForTests(false);
    const { primary, secondary } = getPrefetchTargets();

    expect([...primary, ...secondary].every((name) => !name.includes('desktop'))).toBe(true);
  });

  it('на десктопе берёт десктопные варианты разделённых страниц', () => {
    setIsDesktopForTests(true);
    const { primary, secondary } = getPrefetchTargets();

    expect(primary).toContain('transactions/desktop/AddTransactionDesktopPage');
    expect(secondary).toContain('accounts/desktop/AccountsDesktopPage');
    expect([...primary, ...secondary]).not.toContain('accounts/AccountsPage');
  });

  it('на десктопе не качает экран одного счёта — там его роль играет правая колонка', () => {
    setIsDesktopForTests(true);
    const { secondary } = getPrefetchTargets();

    expect(secondary).not.toContain('accounts/AccountDetailPage');
  });

  it('у каждой цели есть загрузчик', () => {
    setIsDesktopForTests(false);
    const mobile = getPrefetchTargets();
    setIsDesktopForTests(true);
    const desktop = getPrefetchTargets();

    const names = new Set([
      ...mobile.primary,
      ...mobile.secondary,
      ...desktop.primary,
      ...desktop.secondary,
    ]);

    for (const name of names) {
      // Опечатка в имени тихо превратила бы префетч в no-op, а заметили бы её
      // только по просевшему времени открытия страницы.
      expect(PREFETCH_LOADER_NAMES, `нет загрузчика для ${name}`).toContain(name);
    }
  });
});
