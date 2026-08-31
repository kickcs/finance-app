import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import {
  useInfiniteDebts,
  useDebts,
  getDebtDisplayName,
  foldGroupsIntoPeople,
  type Debt,
  type DebtsFilters,
  type PersonDebtSummary,
  type MutualPosition,
} from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { useCloseAllDebts, useCloseDebt, useReopenDebt } from '@/features/close-debt';
import { useOffsetDebts } from '@/features/offset-debts';
import { useDebtPaymentFlow } from '@/features/partial-payment';
import { buildSharePayload, selectShareableDebts, useDebtShare } from '@/features/share-debts';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useExchangeRates, useProfile } from '@/shared/api';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useToast } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import type { Transaction } from '@/shared/api/database.types';

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
  const { toast } = useToast();
  const { accounts } = useAccounts(userId);
  const { updateDebt } = useDebts(userId);
  const { profile } = useProfile(userId);

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

  const availableCurrencies = computed(() => {
    const currencies = new Set<string>();
    for (const c of Object.keys(totalSummary.value.totalGiven)) currencies.add(c);
    for (const c of Object.keys(totalSummary.value.totalTaken)) currencies.add(c);
    return Array.from(currencies).sort();
  });

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

  // --- People ---
  const people = computed(() => foldGroupsIntoPeople(filteredGroups.value, convert));

  // Плоский список для режима «фильтр по человеку»: считается из filteredGroups,
  // чтобы ?type=given из дашборда не тянул за собой встречные долги.
  const filteredDebts = computed(() => filteredGroups.value.flatMap((g) => g.debts));

  // Человек, по которому включён фильтр: сервер в этом режиме отдаёт только его
  // группы, так что в `people` он единственный.
  const filteredPerson = computed<PersonDebtSummary | null>(() => {
    if (!personFilter.value) return null;
    return people.value.find((p) => p.personName === personFilter.value) ?? null;
  });

  const mutualPositions = computed<MutualPosition[]>(() => filteredPerson.value?.mutual ?? []);

  // --- Взаимозачёт ---
  const { isOffsetting, offsetDebts } = useOffsetDebts();
  const showOffsetModal = ref(false);
  const offsetPosition = ref<MutualPosition | null>(null);

  function openOffset(position: MutualPosition) {
    offsetPosition.value = position;
    showOffsetModal.value = true;
  }

  async function handleOffset() {
    if (!offsetPosition.value || !personFilter.value || !userId.value) return;
    const success = await offsetDebts(
      personFilter.value,
      offsetPosition.value.currency,
      userId.value,
    );
    if (success) {
      showOffsetModal.value = false;
      offsetPosition.value = null;
    }
  }

  // --- Поделиться долгами человека ---
  const showShareDrawer = ref(false);

  /**
   * Снимок собирается из того, что сейчас на экране: пришёл человек по фильтру
   * `?type=given` — уходят только эти долги, иначе получатель увидел бы то,
   * чего отправитель не видел.
   */
  const sharePayload = computed(() => {
    if (!personFilter.value) return null;
    return buildSharePayload({
      personName: personFilter.value,
      currency: currency.value,
      debts: filteredDebts.value,
      ownerName: profile.value?.name ?? null,
      convert,
    });
  });

  /** Приватные долги в снимок не идут — их количество показываем в шторке. */
  const hiddenShareCount = computed(
    () => filteredDebts.value.length - selectShareableDebts(filteredDebts.value).length,
  );

  /** Делиться можно только открытыми долгами конкретного человека. */
  const canShare = computed(() => !!personFilter.value && statusFilter.value === 'active');

  function openShare() {
    if (!canShare.value) return;
    showShareDrawer.value = true;
  }

  // --- Selected debt (desktop detail panel) ---
  const selectedDebtId = ref<string | null>(null);
  const selectedDebt = computed<Debt | null>(() => {
    if (!selectedDebtId.value) return null;
    return allDebtsFromGroups.value.find((d) => d.id === selectedDebtId.value) ?? null;
  });
  const selectedDebtCurrency = computed(() => selectedDebt.value?.currency || DEFAULT_CURRENCY);

  /**
   * Шаринг из панели одного долга: у человека с единственным долгом фильтра по
   * имени нет, кнопка в шапке списка не появляется. Правило снимка то же —
   * уходит только открытый в панели долг.
   */
  const {
    isOpen: showDebtShareDrawer,
    payload: debtSharePayload,
    open: openDebtShare,
  } = useDebtShare(userId, selectedDebt);

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

  /**
   * Один долг открываем сразу — промежуточный экран со списком из одной строки
   * не нужен. У кого долгов несколько, показываем их через серверный фильтр по
   * имени: так в списке не появляется вложенных раскрывашек.
   */
  function handlePersonClick(person: PersonDebtSummary) {
    if (person.debts.length === 1) {
      handleDebtClick(person.debts[0]);
      return;
    }
    personFilter.value = person.personName;
    router.replace({ path: '/debts', query: { person: person.personName } });
  }

  function handleAddDebt() {
    router.push({ name: ROUTE_NAMES.NEW_TRANSACTION, query: { type: 'debt' } });
  }

  function clearFilter() {
    personFilter.value = null;
    typeFilter.value = null;
    router.replace({ path: '/debts' });
  }

  // --- Close all debts ---
  const { isClosing, progress, total, closeAllDebts } = useCloseAllDebts();
  const showCloseAllDrawer = ref(false);
  const closeAllPersonName = ref<string | null>(null);

  const closeAllDebtsForPerson = computed(() => {
    if (!closeAllPersonName.value) return allDebtsFromGroups.value;
    return allDebtsFromGroups.value.filter(
      (d) => getDebtDisplayName(d) === closeAllPersonName.value,
    );
  });

  function openCloseAllForPerson(personName: string) {
    closeAllPersonName.value = personName;
    showCloseAllDrawer.value = true;
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
      showCloseAllDrawer.value = false;
      closeAllPersonName.value = null;
      clearFilter();
    }
  }

  // --- Detail panel actions ---
  const showDeleteModal = ref(false);
  const { isDeleting, deleteDebt } = useCloseDebt();
  const paymentFlow = useDebtPaymentFlow({
    userId,
    debt: selectedDebt,
    onClosed: () => {
      selectedDebtId.value = null;
    },
  });

  function handleDetailPayment() {
    paymentFlow.open();
  }

  function handleDetailEdit() {
    if (selectedDebtId.value) {
      router.push({ name: ROUTE_NAMES.DEBT_DETAIL, params: { id: selectedDebtId.value } });
    }
  }

  function handleDetailDelete() {
    showDeleteModal.value = true;
  }

  // Отмена закрытия. Записи закрытия приносит панель: она уже держит
  // транзакции выбранного долга, а список — нет.
  const showReopenModal = ref(false);
  const reopenClosingRecords = ref<Transaction[]>([]);
  const { isReopening, reopenDebt } = useReopenDebt();

  function handleDetailReopen(closingRecords: Transaction[]) {
    reopenClosingRecords.value = closingRecords;
    showReopenModal.value = true;
  }

  async function handleReopenDebt() {
    if (!selectedDebt.value || !userId.value) return;
    const success = await reopenDebt(selectedDebt.value.id, userId.value);
    if (success) showReopenModal.value = false;
  }

  async function handleDeleteDebt() {
    if (!selectedDebt.value || !userId.value) return;
    const success = await deleteDebt(selectedDebt.value, userId.value);
    if (success) {
      showDeleteModal.value = false;
      selectedDebtId.value = null;
    }
  }

  async function handleDetailTogglePrivate(value: boolean) {
    if (!selectedDebt.value) return;
    try {
      await updateDebt(selectedDebt.value.id, { is_private: value });
    } catch {
      // updateDebt (useDebts) уже откатывает оптимистичный патч кэша сама — здесь только тост.
      toast({ title: 'Не удалось обновить', variant: 'error' });
    }
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
    people,
    filteredPerson,
    mutualPositions,
    allDebtsFromGroups,
    filteredDebts,
    totalDebtsCount,
    totalGivenDebts,
    totalTakenDebts,

    // Infinite scroll
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,

    // Close all
    showCloseAllDrawer,
    closeAllPersonName,
    closeAllDebtsForPerson,
    isClosing,
    progress,
    total,
    accounts,

    // Поделиться
    showShareDrawer,
    sharePayload,
    hiddenShareCount,
    canShare,
    openShare,
    showDebtShareDrawer,
    debtSharePayload,
    openDebtShare,

    // Взаимозачёт
    showOffsetModal,
    offsetPosition,
    isOffsetting,

    // Detail panel modals
    showDeleteModal,
    isDeleting,
    showReopenModal,
    reopenClosingRecords,
    isReopening,
    isPaymentOpen: paymentFlow.isOpen,
    paymentDraft: paymentFlow.draft,

    // Functions
    goBack,
    handleDebtClick,
    handlePersonClick,
    handleAddDebt,
    clearFilter,
    openCloseAllForPerson,
    handleCloseAll,
    openOffset,
    handleOffset,
    handleDetailPayment,
    handleDetailEdit,
    handleDetailDelete,
    handleDeleteDebt,
    handleDetailReopen,
    handleReopenDebt,
    submitPayment: paymentFlow.submit,
    handleDetailTogglePrivate,
    handleDetailClose,
    handleRefresh,

    // Helpers
    toCurrencyItems,
  };
}
