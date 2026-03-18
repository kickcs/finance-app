import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useDebts, getDebtDisplayName, type Debt } from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { useCloseAllDebts, useCloseDebt } from '@/features/close-debt';
import { usePartialPayment } from '@/features/partial-payment';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { navigateBack } from '@/app/router';

const STATUS_TABS = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
];

export interface PersonGroup {
  personName: string;
  debts: Debt[];
  debtType: 'given' | 'taken';
  totalRemainingDisplay: { amount: number; currency: string; approximate: boolean };
  hasPrivate: boolean;
}

export function useDebtsPageState() {
  const router = useRouter();
  const route = useRoute();
  const isDesktop = useIsDesktop();
  const { userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { convert } = useExchangeRates(currency);
  const { debts, isLoading, updateDebt } = useDebts(userId);
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

  // --- Computed debt lists ---
  const baseActiveDebts = computed(() => {
    let filtered = debts.value.filter((d) => !d.is_closed);
    if (personFilter.value) {
      filtered = filtered.filter(
        (d) =>
          getDebtDisplayName(d) === personFilter.value &&
          (!typeFilter.value || d.debt_type === typeFilter.value),
      );
    }
    return filtered;
  });

  const availableCurrencies = computed(() =>
    Array.from(new Set(baseActiveDebts.value.map((d) => d.currency))).sort(),
  );

  const activeDebts = computed(() => {
    if (!currencyFilter.value) return baseActiveDebts.value;
    return baseActiveDebts.value.filter((d) => d.currency === currencyFilter.value);
  });

  const baseClosedDebts = computed(() => debts.value.filter((d) => d.is_closed));

  const availableClosedCurrencies = computed(() =>
    Array.from(new Set(baseClosedDebts.value.map((d) => d.currency))).sort(),
  );

  function toCurrencyItems(currencies: string[]) {
    return currencies.map((c) => ({ id: c, label: c }));
  }

  const activeCurrencyItems = computed(() => toCurrencyItems(availableCurrencies.value));
  const closedCurrencyItems = computed(() => toCurrencyItems(availableClosedCurrencies.value));

  const closedDebts = computed(() => {
    if (!currencyFilter.value) return baseClosedDebts.value;
    return baseClosedDebts.value.filter((d) => d.currency === currencyFilter.value);
  });

  const totalGivenDebts = computed(() =>
    activeDebts.value
      .filter((d) => d.debt_type === 'given' && !d.is_private)
      .reduce((sum, d) => sum + convert(d.remaining_amount, d.currency || DEFAULT_CURRENCY), 0),
  );

  const totalTakenDebts = computed(() =>
    activeDebts.value
      .filter((d) => d.debt_type === 'taken' && !d.is_private)
      .reduce((sum, d) => sum + convert(d.remaining_amount, d.currency || DEFAULT_CURRENCY), 0),
  );

  // --- Grouping ---
  const debtsByPerson = computed<PersonGroup[]>(() => {
    const groups = new Map<string, { debts: Debt[]; debtType: 'given' | 'taken' }>();

    for (const debt of activeDebts.value) {
      const personName = getDebtDisplayName(debt);
      const key = `${personName}_${debt.debt_type}`;
      const existing = groups.get(key);
      if (existing) {
        existing.debts.push(debt);
      } else {
        groups.set(key, { debts: [debt], debtType: debt.debt_type });
      }
    }

    return Array.from(groups.entries()).map(([, { debts: personDebts, debtType }]) => {
      const personName = getDebtDisplayName(personDebts[0]);
      const currencies = new Set(personDebts.map((d) => d.currency));
      const isMixed = currencies.size > 1;

      return {
        personName,
        debts: personDebts,
        debtType,
        totalRemainingDisplay: {
          amount: isMixed
            ? personDebts.reduce((sum, d) => sum + convert(d.remaining_amount, d.currency), 0)
            : personDebts.reduce((s, d) => s + d.remaining_amount, 0),
          currency: isMixed ? currency.value : personDebts[0].currency,
          approximate: isMixed,
        },
        hasPrivate: personDebts.some((d) => d.is_private),
      };
    });
  });

  function isGroupDefaultOpen(group: PersonGroup): boolean {
    return personFilter.value === group.personName;
  }

  // --- Selected debt (desktop detail panel) ---
  const selectedDebtId = ref<string | null>(null);
  const selectedDebt = computed<Debt | null>(() => {
    if (!selectedDebtId.value) return null;
    return debts.value.find((d) => d.id === selectedDebtId.value) ?? null;
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
    if (!closeAllPersonName.value) return activeDebts.value;
    return activeDebts.value.filter((d) => getDebtDisplayName(d) === closeAllPersonName.value);
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
    await updateDebt(selectedDebt.value.id, { is_private: value });
  }

  function handleDetailClose() {
    selectedDebtId.value = null;
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
    availableClosedCurrencies,
    activeCurrencyItems,
    closedCurrencyItems,
    selectedDebtId,
    selectedDebt,
    selectedDebtCurrency,

    // Debt lists
    activeDebts,
    closedDebts,
    debtsByPerson,
    totalGivenDebts,
    totalTakenDebts,

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
  };
}
