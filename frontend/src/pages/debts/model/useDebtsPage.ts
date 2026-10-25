import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useRouteQuery } from '@vueuse/router';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import {
  foldGroupsIntoPeople,
  getDebtDisplayName,
  useDebts,
  useInfiniteDebts,
  type Debt,
  type DebtsFilters,
  type MutualPosition,
  type PersonDebtSummary,
} from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import { useOffsetDebts } from '@/features/offset-debts';
import { canSettleTogether, useCloseAllDebts } from '@/features/pay-debt';
import { buildSharePayload, selectShareableDebts } from '@/features/share-debts';
import { useExchangeRates, useProfile } from '@/shared/api';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { navigateBack } from '@/app/router';
import { useDebtDetail } from './useDebtDetail';

const STATUS_TABS = [
  { id: 'active', label: 'Активные' },
  { id: 'closed', label: 'Закрытые' },
];

function toCurrencyItems(currencies: string[]) {
  return currencies.map((c) => ({ id: c, label: c }));
}

export function useDebtsPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { userId } = useCurrentUser();
  const { currency } = useUserCurrency();
  const { convert, isReady: ratesReady } = useExchangeRates(currency);
  const { profile } = useProfile(userId);
  const { accounts } = useAccounts(userId);

  // --- Фильтры ---
  // Живут в адресе: раньше каждый из них вели дважды — локальным ref'ом и
  // `router.replace`, а третьим местом был watch, тянувший ref обратно из
  // query. Теперь состояние одно, и возврат на экран поднимает тот же список.
  const personFilter = useRouteQuery<string | null>('person', null);
  const statusFilter = useRouteQuery<'active' | 'closed'>('status', 'active');
  // Валюта в адрес не идёт: она перебирает то, что уже загружено, и сбрасывается
  // при смене вкладки — делиться такой ссылкой нечем.
  const currencyFilter = ref<string | null>(null);

  watch(statusFilter, () => {
    currencyFilter.value = null;
  });

  const serverFilters = computed<DebtsFilters>(() => ({
    status: statusFilter.value,
    ...(currencyFilter.value ? { currency: currencyFilter.value } : {}),
    ...(personFilter.value ? { personName: personFilter.value } : {}),
  }));

  const {
    groups,
    totalDebtsCount,
    totalSummary,
    isLoading: debtsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteDebts(userId, serverFilters);

  /**
   * Курсы — часть данных списка, а не украшение: сводка и нетто по людям без
   * них считаются как будто все долги в валюте пользователя, и доллары
   * мелькают числом сумов. Ждём их так же, как самих долгов.
   */
  const isLoading = computed(() => debtsLoading.value || !ratesReady.value);

  const allDebtsFromGroups = computed(() => groups.value.flatMap((g) => g.debts));

  const availableCurrencies = computed(() => {
    const currencies = new Set<string>();
    for (const c of Object.keys(totalSummary.value.totalGiven)) currencies.add(c);
    for (const c of Object.keys(totalSummary.value.totalTaken)) currencies.add(c);
    return Array.from(currencies).sort();
  });

  const totalGivenDebts = computed(() =>
    Object.entries(totalSummary.value.totalGiven).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur || DEFAULT_CURRENCY),
      0,
    ),
  );

  const totalTakenDebts = computed(() =>
    Object.entries(totalSummary.value.totalTaken).reduce(
      (sum, [cur, amount]) => sum + convert(amount, cur || DEFAULT_CURRENCY),
      0,
    ),
  );

  const people = computed(() => foldGroupsIntoPeople(groups.value, convert));

  // Человек, по которому включён фильтр: сервер в этом режиме отдаёт только его
  // группы, так что в `people` он единственный.
  const filteredPerson = computed<PersonDebtSummary | null>(() => {
    if (!personFilter.value) return null;
    return people.value.find((p) => p.personName === personFilter.value) ?? null;
  });

  const mutualPositions = computed<MutualPosition[]>(() => filteredPerson.value?.mutual ?? []);

  // --- Взаимозачёт ---
  const { isOffsetting, offsetDebts } = useOffsetDebts(userId);
  const showOffsetModal = ref(false);
  const offsetPosition = ref<MutualPosition | null>(null);

  function openOffset(position: MutualPosition) {
    offsetPosition.value = position;
    showOffsetModal.value = true;
  }

  async function handleOffset() {
    if (!offsetPosition.value || !personFilter.value || !userId.value) return;
    const success = await offsetDebts(personFilter.value, offsetPosition.value.currency);
    if (success) {
      showOffsetModal.value = false;
      offsetPosition.value = null;
    }
  }

  // --- Поделиться долгами человека ---
  const showShareDrawer = ref(false);

  /** Снимок — ровно то, что на экране: все открытые долги человека. */
  const sharePayload = computed(() => {
    if (!personFilter.value) return null;
    return buildSharePayload({
      personName: personFilter.value,
      currency: currency.value,
      debts: allDebtsFromGroups.value,
      ownerName: profile.value?.name ?? null,
      convert,
    });
  });

  /** Приватные долги в снимок не идут — их количество показываем в шторке. */
  const hiddenShareCount = computed(
    () => allDebtsFromGroups.value.length - selectShareableDebts(allDebtsFromGroups.value).length,
  );

  /** Делиться можно только открытыми долгами конкретного человека. */
  const canShare = computed(() => !!personFilter.value && statusFilter.value === 'active');

  function openShare() {
    if (!canShare.value) return;
    showShareDrawer.value = true;
  }

  // --- Выбранный долг (десктопная панель) ---
  // Тоже в адресе: обновление страницы и возврат назад оставляют панель открытой.
  const selectedDebtId = useRouteQuery<string | null>('debt', null);
  const debtFromGroups = computed<Debt | null>(() => {
    if (!selectedDebtId.value) return null;
    return allDebtsFromGroups.value.find((d) => d.id === selectedDebtId.value) ?? null;
  });

  // Ссылка на долг, которого нет в загруженной ленте (другая вкладка, страница
  // за курсором), — единственный повод сходить за плоским списком. Пока выбор
  // приходит тапом по экрану, запрос выключен.
  const lookupUserId = computed(() =>
    selectedDebtId.value && !debtFromGroups.value ? userId.value : null,
  );
  const { debts: lookupDebts, isPending: lookupPending } = useDebts(lookupUserId);

  const selectedDebt = computed<Debt | null>(
    () =>
      debtFromGroups.value ?? lookupDebts.value.find((d) => d.id === selectedDebtId.value) ?? null,
  );

  /**
   * Панель открывается и по адресу, когда лента ещё едет, а долг может лежать
   * за курсором — тогда за ним уходит плоский запрос. Пока хоть один из них не
   * ответил, «Долг не найден» был бы враньём.
   */
  const isDetailLoading = computed(() => {
    if (!selectedDebtId.value || selectedDebt.value) return false;
    return debtsLoading.value || lookupPending.value;
  });

  function closeDetail() {
    selectedDebtId.value = null;
  }

  const detail = useDebtDetail({
    debt: selectedDebt,
    isLoading: isDetailLoading,
    onGone: closeDetail,
  });

  // --- Навигация ---
  function goBack() {
    navigateBack();
  }

  /**
   * Фильтр едет с переходом на экран долга и возвращается оттуда обратно:
   * закрытый платежом долг уводит на список, и без этого человек оказывался в
   * общем списке вместо того, из которого пришёл.
   */
  const listQuery = computed(() => ({
    ...(personFilter.value ? { person: personFilter.value } : {}),
    ...(statusFilter.value !== 'active' ? { status: statusFilter.value } : {}),
  }));

  function handleDebtClick(debt: Debt) {
    if (isDesktop.value) {
      selectedDebtId.value = debt.id;
    } else {
      router.push({
        name: ROUTE_NAMES.DEBT_DETAIL,
        params: { id: debt.id },
        query: listQuery.value,
      });
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
  }

  function handleAddDebt() {
    router.push({ name: ROUTE_NAMES.NEW_TRANSACTION, query: { type: 'debt' } });
  }

  function clearFilter() {
    personFilter.value = null;
  }

  // --- Закрыть все долги человека ---
  const { isClosing, progress, total, closeAllDebts } = useCloseAllDebts();
  const showCloseAllDrawer = ref(false);
  const closeAllPersonName = ref<string | null>(null);

  const closeAllDebtsForPerson = computed(() => {
    if (!closeAllPersonName.value) return allDebtsFromGroups.value;
    return allDebtsFromGroups.value.filter(
      (d) => getDebtDisplayName(d) === closeAllPersonName.value,
    );
  });

  // Встречные долги в разных валютах одним расчётом не свести — их закрывают по одному.
  const canCloseAll = computed(
    () => allDebtsFromGroups.value.length > 1 && canSettleTogether(allDebtsFromGroups.value),
  );

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

  async function handleRefresh() {
    await refetch();
  }

  return {
    // Состояние
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

    // Списки
    groups,
    people,
    filteredPerson,
    mutualPositions,
    allDebtsFromGroups,
    totalDebtsCount,
    totalGivenDebts,
    totalTakenDebts,

    // Бесконечная лента
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,

    // Закрыть все
    showCloseAllDrawer,
    closeAllPersonName,
    closeAllDebtsForPerson,
    canCloseAll,
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

    // Взаимозачёт
    showOffsetModal,
    offsetPosition,
    isOffsetting,

    // Действия над выбранным долгом
    detail,

    // Функции
    goBack,
    handleDebtClick,
    closeDetail,
    handlePersonClick,
    handleAddDebt,
    clearFilter,
    openCloseAllForPerson,
    handleCloseAll,
    openOffset,
    handleOffset,
    handleRefresh,

    // Хелперы
    toCurrencyItems,
  };
}
