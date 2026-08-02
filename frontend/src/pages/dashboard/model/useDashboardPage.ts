import { ref, computed, onMounted } from 'vue';
import { useLocalStorage, useEventListener, useTimeoutFn } from '@vueuse/core';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';
import { queryClient } from '@/shared/api/queryClient';
import {
  invalidateTransactionRelated,
  invalidateAccountRelated,
  invalidateSubscriptionRelated,
} from '@/shared/api/invalidation';
import { debtQueryKeys } from '@/entities/debt';
import { budgetQueryKeys } from '@/entities/budget';
import { usePwaInstall } from '@/features/install-pwa';
import { usePwaUpdateToast } from '@/shared/lib/composables/usePwaUpdate';
import { useFeatureHints } from '@/features/feature-hints';
import { getGreeting } from '@/shared/lib/format/greeting';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import { useHaptics } from '@/shared/lib/haptics';

import { useDashboardData } from './useDashboardData';
import { useDashboardQuickActions } from './useDashboardQuickActions';
import { useDashboardNavigation } from './useDashboardNavigation';
import { provideDashboardContext } from './dashboardContext';

const BALANCE_SCROLL_THRESHOLD = 80;

/**
 * Вся логика Главной, общая для мобильной и десктопной страниц: провайдит
 * DashboardContext (~40 ключей, потребляемых виджетами), держит feature-hints,
 * PWA-модалку, бюджетные шторки и трекинг скролла для шапки.
 *
 * Разметку каждая платформа рисует своим SFC — единственное, что приходит
 * извне, это DOM-узел скролл-контейнера: у мобильной страницы это
 * `PageContainer`, у десктопной — `DesktopPage`.
 */
export function useDashboardPage() {
  const {
    isDotDismissed,
    dismissDot,
    incrementCounter,
    shouldShowHint,
    dismissHint,
    markHintShown,
    getHintConfig,
  } = useFeatureHints();
  const showSettingsDot = computed(() => !isDotDismissed('dashboard-settings'));

  const showSettingsHint = ref(false);
  const settingsHintConfig = getHintConfig('dashboard-settings');

  const { start: showSettingsHintDelayed } = useTimeoutFn(
    () => {
      showSettingsHint.value = true;
      markHintShown();
    },
    1000,
    { immediate: false },
  );

  onMounted(() => {
    incrementCounter('dashboard_visits');
    if (shouldShowHint('dashboard-settings')) {
      showSettingsHintDelayed();
    }
  });

  const greeting = getGreeting();

  const data = useDashboardData();
  const quickActions = useDashboardQuickActions(data.allCategories, data.userId);
  const nav = useDashboardNavigation();

  const { showModal: showInstallModal } = usePwaInstall();
  const showBudgetSheet = ref(false);
  const showFinancialPeriodModal = ref(false);
  usePwaUpdateToast();

  const isHidden = useLocalStorage(STORAGE_KEYS.BALANCE_HIDDEN, false);
  const isCompactMode = useLocalStorage(STORAGE_KEYS.DASHBOARD_COMPACT_MODE, false);
  const { trigger: triggerHaptic } = useHaptics();

  // Скролл-контейнер приходит извне: у мобильной страницы это PageContainer,
  // у десктопной — DesktopPage. Обе связывают его через setScrollContainer.
  const scrollContainerRef = ref<HTMLElement | undefined>();
  const isScrolledPastBalance = ref(false);

  function setScrollContainer(el: HTMLElement | undefined) {
    scrollContainerRef.value = el;
  }

  useEventListener(scrollContainerRef, 'scroll', (e: Event) => {
    const scrolled = (e.target as HTMLElement).scrollTop > BALANCE_SCROLL_THRESHOLD;
    if (scrolled !== isScrolledPastBalance.value) {
      isScrolledPastBalance.value = scrolled;
    }
  });

  function toggleCompactMode() {
    triggerHaptic('selection');
    isCompactMode.value = !isCompactMode.value;
    const scrollEl = scrollContainerRef.value;
    if (scrollEl instanceof HTMLElement) {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function handleRefresh() {
    const uid = data.userId.value;
    if (!uid) return;
    await Promise.all([
      invalidateTransactionRelated(queryClient, uid),
      invalidateAccountRelated(queryClient, uid),
      queryClient.invalidateQueries({ queryKey: debtQueryKeys.list(uid) }),
      queryClient.invalidateQueries({ queryKey: budgetQueryKeys.all }),
      invalidateSubscriptionRelated(queryClient, uid),
    ]);
  }

  // Переопределения бюджета хранятся по ФИНАНСОВОМУ месяцу — тому же, который
  // бэкенд резолвит для GET /budgets/current. Календарный месяц записал бы
  // переопределение не в тот период, что показан на дашборде.
  const { currentPeriod: financialPeriod } = useFinancialPeriod();

  async function handleBudgetSave(amount: number) {
    if (data.budget.value?.budget?.isDefault === false) {
      const { year, month } = financialPeriod.value;
      await data.setBudgetOverride(year, month, amount);
    } else {
      await data.setBudgetDefault(amount);
    }
    showBudgetSheet.value = false;
  }

  async function handleBudgetReset() {
    const { year, month } = financialPeriod.value;
    await data.removeBudgetOverride(year, month);
    showBudgetSheet.value = false;
  }

  function toggleHidden() {
    isHidden.value = !isHidden.value;
  }

  function handleSettingsClick() {
    dismissDot('dashboard-settings');
    nav.toDashboardSettings();
  }

  function dismissSettingsHint() {
    showSettingsHint.value = false;
    dismissHint('dashboard-settings');
  }

  function handleSettingsHintAction() {
    showSettingsHint.value = false;
    dismissHint('dashboard-settings');
    nav.toDashboardSettings();
  }

  provideDashboardContext({
    totalBalance: data.totalBalance,
    currency: data.currency,
    avgDailyExpense: data.avgDailyExpense,
    safeDailyLimit: data.safeDailyLimit,
    daysRemainingInMonth: data.daysRemainingInMonth,
    visibleAccounts: data.visibleAccounts,
    hiddenAccountCount: data.hiddenAccountCount,
    recentTransactions: data.recentTransactions,
    categoryBreakdown: data.categoryBreakdown,
    debts: data.debts,
    budget: data.budget,
    upcomingSubscriptions: data.upcomingSubscriptions,
    getCategoryById: data.getCategoryById,
    quickActionSlots: quickActions.quickActionSlots,
    quickActionsHidden: quickActions.quickActionsHidden,
    quickActionsHintDismissed: quickActions.quickActionsHintDismissed,
    categoryMap: quickActions.categoryMap,
    userId: data.userId,
    isHidden,
    isCompactMode,
    convert: data.convert,
    widgetOrder: data.widgetOrder,
    hiddenWidgets: data.hiddenWidgets,
    accountsLoading: data.accountsLoading,
    ratesLoading: data.ratesLoading,
    analyticsLoading: data.analyticsLoading,
    recentTxLoading: data.recentTxLoading,
    debtsLoading: data.debtsLoading,
    budgetLoading: data.budgetLoading,
    quickActionsLoading: quickActions.quickActionsLoading,
    subscriptionsLoading: data.subscriptionsLoading,
    balanceLoading: data.balanceLoading,
    showSettingsDot,
    scrollContainerRef,
    onRefresh: handleRefresh,
    nav,
    toggleHidden,
    toggleCompactMode,
    openBudgetSheet: () => {
      showBudgetSheet.value = true;
    },
    openFinancialPeriodModal: () => {
      showFinancialPeriodModal.value = true;
    },
    openDashboardSettings: handleSettingsClick,
    handleQuickActionClick: quickActions.handleClick,
    handleQuickActionLongPress: quickActions.handleLongPress,
    dismissQuickActionsHint: quickActions.dismissHint,
  });

  return {
    greeting,
    userName: data.userName,
    isHidden,
    isCompactMode,
    showInstallModal,
    showBudgetSheet,
    showFinancialPeriodModal,
    showSettingsDot,
    showSettingsHint,
    settingsHintConfig,
    isScrolledPastBalance,
    setScrollContainer,
    handleSettingsClick,
    dismissSettingsHint,
    handleSettingsHintAction,
    handleBudgetSave,
    handleBudgetReset,
    toggleHidden,
    quickActions,
    data,
    /** Не входят в буквальный список плана, но нужны обеим страницам: шапки
     *  ходят через nav напрямую (toProfile, toAccounts), а BalanceCard и
     *  SetBudgetSheet — через toggleHidden/handleBudgetSave/handleBudgetReset. */
    nav,
  };
}
