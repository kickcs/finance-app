import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import {
  useInfiniteDebts,
  getDebtDisplayName,
  type Debt,
  type DebtGroupResponse,
  type DebtsFilters,
} from '@/entities/debt';
import { debtsApi } from '@/entities/debt/api/debtsApi';
import { debtQueryKeys } from '@/entities/debt/api/queryKeys';
import { useAccounts } from '@/entities/account';
import { useCloseAllDebts, useCloseDebt } from '@/features/close-debt';
import { usePartialPayment } from '@/features/partial-payment';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { navigateBack } from '@/app/router';
import { useQueryClient } from '@tanstack/vue-query';

const STATUS_TABS = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
];

function toCurrencyItems(currencies: string[]) {
  return currencies.map((c) => ({ id: c, label: c }));
}

export function useDebtsPageState() {
  const router = useRouter();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const { userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { convert } = useExchangeRates(currency);
  const queryClient = useQueryClient();
  const { accounts } = useAccounts(userId);

  // --- Filters ---
  const personFilter = ref<string | null>(route.query.person as string | null);
  const typeFilter = ref<'given' | 'taken' | null>(route.query.type as 'given' | 'taken' | null);
  const currencyFilter = ref<string | null>(null);
  const statusFilter = ref<'active' | 'closed'>('active');

  watch(statusFilter, () => {
    currencyFilter.value = null;
  });

  watch(
    () => route.query,
    (newQuery) => {
      personFilter.value = newQuery.person as string | null;
      typeFilter.value = newQuery.type as 'given' | 'taken' | null;
    },
  );

  // --- Server-side filters ---
  const serverFilters = computed<DebtsFilters>(() => ({
    status: statusFilter.value,
    ...(currencyFilter.value ? { currency: currencyFilter.value } : {}),
    ...(personFilter.value ? { personName: personFilter.value } : {}),
  }));

  // --- Infinite debts ---
  const {
    groups,
    totalDebtsCount,
    totalSummary,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteDebts(userId, serverFilters);

  // --- Derived from groups ---
  const allDebtsFromGroups = computed(() => groups.value.flatMap((g) => g.debts));

  // TODO: typeFilter is client-side only. Currently safe because typeFilter
  // is always paired with personFilter (server-side), so groups are few.
  // Consider moving debtType to server-side filters if needed.
  const filteredGroups = computed(() => {
    if (!typeFilter.value) return groups.value;
    return groups.value.filter((g) => g.debt_type === typeFilter.value);
  });

  const availableCurrencies = computed(() =>
    Array.from(new Set(allDebtsFromGroups.value.map((d) => d.currency))).sort(),
  );

  // --- Totals from server summary ---
  const totalGivenDebts = computed(() => {
    const given = totalSummary.value.totalGiven;
    return Object.entries(given).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur || DEFAULT_CURRENCY),
      0,
    );
  });

  const totalTakenDebts = computed(() => {
    const taken = totalSummary.value.totalTaken;
    return Object.entries(taken).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur || DEFAULT_CURRENCY),
      0,
    );
  });

  // --- Grouping ---
  function isGroupDefaultOpen(group: DebtGroupResponse): boolean {
    return personFilter.value === group.person_name;
  }

  // --- Selected debt (desktop detail panel) ---
  const selectedDebtId = ref<string | null>(null);
  const selectedDebt = computed<Debt | null>(() => {
    if (!selectedDebtId.value) return null;
    return allDebtsFromGroups.value.find((d) => d.id === selectedDebtId.value) ?? null;
  });
  const selectedDebtCurrency = computed(() => selectedDebt.value?.currency || DEFAULT_CURRENCY);

  // --- Navigation ---
  function goBack() {
    navigateBack();
  }

  function handleDebtClick(debt: Debt) {
    if (isDesktop.value) {
      selectedDebtId.value = debt.id;
    } else {
      router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: debt.id } });
    }
  }

  const showCreateDrawer = ref(false);

  function handleAddDebt() {
    showCreateDrawer.value = true;
  }

  function clearFilter() {
    personFilter.value = null;
    typeFilter.value = null;
    router.replace({ path: '/debts' });
  }

  // --- Close all debts ---
  const { isClosing, progress, total, closeAllDebts } = useCloseAllDebts();
  const showCloseAllModal = ref(false);
  const closeAllPersonName = ref<string | null>(null);

  const closeAllDebtsForPerson = computed(() => {
    if (!closeAllPersonName.value) return allDebtsFromGroups.value;
    return allDebtsFromGroups.value.filter(
      (d) => getDebtDisplayName(d) === closeAllPersonName.value,
    );
  });

  function openCloseAllForPerson(personName: string) {
    closeAllPersonName.value = personName;
    showCloseAllModal.value = true;
  }

  async function handleCloseAll(
    accountId: string,
    options: { paymentAmount: number; forgiveRemainder?: boolean; excessCategoryId?: string },
  ) {
    if (!userId.value) return;
    const success = await closeAllDebts(
      closeAllDebtsForPerson.value,
      accountId,
      userId.value,
      options,
    );
    if (success) {
      showCloseAllModal.value = false;
      closeAllPersonName.value = null;
      clearFilter();
    }
  }

  // --- Detail panel actions ---
  const showDeleteModal = ref(false);
  const showPartialPaymentModal = ref(false);
  const { isDeleting, deleteDebt } = useCloseDebt();
  const { isPaying, makePartialPayment } = usePartialPayment();

  function handleDetailPayment() {
    showPartialPaymentModal.value = true;
  }

  function handleDetailEdit() {
    if (selectedDebtId.value) {
      router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: selectedDebtId.value } });
    }
  }

  function handleDetailDelete() {
    showDeleteModal.value = true;
  }

  async function handleDeleteDebt() {
    if (!selectedDebt.value || !userId.value) return;
    const success = await deleteDebt(selectedDebt.value, userId.value);
    if (success) {
      showDeleteModal.value = false;
      selectedDebtId.value = null;
    }
  }

  // TODO: This logic is duplicated in DebtDetailPage.vue (with different post-payment navigation).
  // Consider extracting a shared helper, e.g. `makePartialPaymentFlow(debt, amount, accountId, userId, options)`.
  async function handlePartialPayment(
    amount: number,
    accountId: string,
    options: { forgiveRemainder?: boolean; excessCategoryId?: string } = {},
  ) {
    if (!selectedDebt.value || !userId.value) return;
    const willClose = amount >= selectedDebt.value.remaining_amount || options.forgiveRemainder;
    const success = await makePartialPayment(
      selectedDebt.value,
      amount,
      accountId,
      userId.value,
      options,
    );
    if (success) {
      showPartialPaymentModal.value = false;
      if (willClose) {
        selectedDebtId.value = null;
      }
    }
  }

  async function handleDetailTogglePrivate(value: boolean) {
    if (!selectedDebt.value) return;
    await debtsApi.update(selectedDebt.value.id, { is_private: value });
    // Invalidate all debt queries (covers both infinite and list caches)
    await queryClient.invalidateQueries({ queryKey: debtQueryKeys.all });
  }

  function handleDetailClose() {
    selectedDebtId.value = null;
  }

  async function handleRefresh() {
    await refetch();
  }

  return {
    // State
    userId,
    currency,
    isLoading,
    isDesktop,
    statusFilter,
    statusTabs: STATUS_TABS,
    personFilter,
    currencyFilter,
    availableCurrencies,
    selectedDebtId,
    selectedDebt,
    selectedDebtCurrency,

    // Debt lists
    groups: filteredGroups,
    allDebtsFromGroups,
    totalDebtsCount,
    totalGivenDebts,
    totalTakenDebts,

    // Infinite scroll
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,

    // Close all
    showCloseAllModal,
    closeAllPersonName,
    closeAllDebtsForPerson,
    isClosing,
    progress,
    total,
    accounts,

    // Create drawer
    showCreateDrawer,

    // Detail panel modals
    showDeleteModal,
    showPartialPaymentModal,
    isDeleting,
    isPaying,

    // Functions
    goBack,
    handleDebtClick,
    handleAddDebt,
    clearFilter,
    isGroupDefaultOpen,
    openCloseAllForPerson,
    handleCloseAll,
    handleDetailPayment,
    handleDetailEdit,
    handleDetailDelete,
    handleDeleteDebt,
    handlePartialPayment,
    handleDetailTogglePrivate,
    handleDetailClose,
    handleRefresh,

    // Helpers
    toCurrencyItems,
  };
}
