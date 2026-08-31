import { useIsDesktop } from '@/shared/lib/platform/useIsDesktop';

export interface PrefetchTargets {
  primary: string[];
  secondary: string[];
  load: (name: string) => Promise<unknown>;
}

/**
 * Динамический импорт по строке Vite не понимает, поэтому загрузчики
 * перечислены явно. Ключ — то же имя, что и в списках ярусов ниже.
 */
const LOADERS: Record<string, () => Promise<unknown>> = {
  'history/HistoryPage': () => import('@/pages/history/HistoryPage.vue'),
  'analytics/AnalyticsPage': () => import('@/pages/analytics/AnalyticsPage.vue'),
  'profile/ProfilePage': () => import('@/pages/profile/ProfilePage.vue'),
  'transactions/AddTransactionPage': () =>
    import('@/pages/transactions/new/AddTransactionPage.vue'),
  'transactions/desktop/AddTransactionDesktopPage': () =>
    import('@/pages/transactions/new/desktop/AddTransactionDesktopPage.vue'),
  'accounts/AccountsPage': () => import('@/pages/accounts/AccountsPage.vue'),
  'accounts/desktop/AccountsDesktopPage': () =>
    import('@/pages/accounts/desktop/AccountsDesktopPage.vue'),
  'accounts/AccountDetailPage': () => import('@/pages/accounts/AccountDetailPage.vue'),
  'debts/DebtsListPage': () => import('@/pages/debts/list/DebtsListPage.vue'),
  'debts/DebtDetailPage': () => import('@/pages/debts/detail/DebtDetailPage.vue'),
  'changelog/ChangelogPage': () => import('@/pages/changelog/ChangelogPage.vue'),
  'settings/CurrencySettingsPage': () =>
    import('@/pages/settings/currency/CurrencySettingsPage.vue'),
  'settings/CategoriesPage': () => import('@/pages/settings/categories/CategoriesPage.vue'),
  'settings/ImportPage': () => import('@/pages/settings/import/ImportPage.vue'),
};

/** Имена, для которых загрузчик реально есть — опечатку в цели ловит тест. */
export const PREFETCH_LOADER_NAMES = Object.keys(LOADERS);

/** Страницы, у которых мобильный и десктопный варианты — разные чанки. */
const SPLIT = {
  addTransaction: {
    mobile: 'transactions/AddTransactionPage',
    desktop: 'transactions/desktop/AddTransactionDesktopPage',
  },
  accounts: {
    mobile: 'accounts/AccountsPage',
    desktop: 'accounts/desktop/AccountsDesktopPage',
  },
} as const;

/**
 * Что качать впрок. Без разделения по платформе десктопный пользователь тянул
 * бы полтора десятка мобильных чанков, которые никогда не отрендерит, и
 * наоборот.
 *
 * Главной в списках нет намеренно: она и есть первый экран.
 */
export function getPrefetchTargets(): PrefetchTargets {
  const desktop = useIsDesktop().value;
  const pick = (page: { mobile: string; desktop: string }) =>
    desktop ? page.desktop : page.mobile;

  return {
    primary: [
      'history/HistoryPage',
      'analytics/AnalyticsPage',
      'profile/ProfilePage',
      pick(SPLIT.addTransaction),
    ],
    secondary: [
      pick(SPLIT.accounts),
      // На десктопе счёт открывается правой колонкой списка, отдельного экрана нет.
      ...(desktop ? [] : ['accounts/AccountDetailPage']),
      'debts/DebtsListPage',
      'debts/DebtDetailPage',
      'changelog/ChangelogPage',
      'settings/CurrencySettingsPage',
      'settings/CategoriesPage',
      'settings/ImportPage',
    ],
    load: (name) => LOADERS[name]?.() ?? Promise.resolve(),
  };
}
