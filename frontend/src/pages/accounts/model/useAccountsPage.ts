import { ref, computed, watch, toValue, type MaybeRefOrGetter } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { ROUTE_NAMES } from '@/app/router/routeNames';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { useExchangeRates } from '@/shared/api';
import { useHaptics } from '@/shared/lib/haptics';
import { useAccounts, type AccountWithBalances } from '@/entities/account';
import { useEditAccount } from '@/features/edit-account';
import { transactionsApi, transactionQueryKeys } from '@/entities/transaction';
import type { Account } from '@/shared/api/database.types';

/**
 * Вся логика Счетов, общая для мобильной и десктопной страниц: запросы счетов
 * и балансов, конвертация валют, drag-переупорядочивание, состояния модалок
 * редактирования/удаления.
 *
 * Кто выбран (`selectedAccountId`) страница решает сама — на мобиле выбора нет
 * (клик ведёт на отдельный маршрут `/accounts/:id`), на десктопе он хранится в
 * query-параметре URL. Поэтому композабл принимает id геттером снаружи, а не
 * держит его как собственное состояние.
 */
export function useAccountsPage(selectedAccountId: MaybeRefOrGetter<string | null> = () => null) {
  const router = useRouter();
  const { trigger } = useHaptics();

  const { userId } = useCurrentUser();

  // Get user currency (profile-first, falls back to localStorage)
  const { currency } = useUserCurrency();

  // Exchange rates for currency conversion
  const { convert } = useExchangeRates(currency);

  // Use real data from API
  const { accounts, totalBalancesByCurrency, isLoading, reorderAccounts, refetch } =
    useAccounts(userId);

  // Local mutable list for draggable (mobile only, harmless if unused)
  const localAccounts = ref<AccountWithBalances[]>([]);

  watch(
    accounts,
    (accs) => {
      localAccounts.value = [...accs];
    },
    { immediate: true },
  );

  // Total balance converted to user's main currency
  const totalBalance = computed(() => {
    const balances = totalBalancesByCurrency.value;
    let total = 0;
    for (const [curr, amount] of Object.entries(balances)) {
      total += convert(amount, curr);
    }
    return total;
  });

  function handleAddAccount() {
    router.push({ name: ROUTE_NAMES.NEW_ACCOUNT });
  }

  function handleDragStart() {
    trigger('selection');
  }

  async function handleDragEnd() {
    const accountIds = localAccounts.value.map((a) => a.id);
    try {
      await reorderAccounts(accountIds);
    } catch (error) {
      console.error('Failed to reorder accounts:', error);
    }
  }

  /**
   * Клавиатурная альтернатива перетаскиванию: ручка drag реагирует на стрелки.
   * Ищем позицию по id, а не по индексу из слота vuedraggable — список между
   * рендером слота и нажатием мог переехать (drag, рефетч, оптимистик).
   */
  function moveAccount(accountId: string, delta: -1 | 1) {
    const from = localAccounts.value.findIndex((a) => a.id === accountId);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= localAccounts.value.length) return;

    const next = [...localAccounts.value];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    localAccounts.value = next;

    trigger('selection');
    void handleDragEnd();
  }

  async function handleRefresh() {
    await refetch();
  }

  // ─── Edit / Delete account (desktop detail panel) ─────────────────────
  const selectedAccount = computed<AccountWithBalances | null>(() => {
    const id = toValue(selectedAccountId);
    if (!id) return null;
    return accounts.value.find((a) => a.id === id) ?? null;
  });

  const showEditAccountModal = ref(false);
  const showDeleteAccountModal = ref(false);
  const {
    isUpdating: isUpdatingAccount,
    isDeleting: isDeletingAccount,
    error: accountError,
    update: updateAccountFn,
    remove: removeAccountFn,
  } = useEditAccount(userId);

  // Total transaction count for the selected account (lazy - only fetched when delete modal opens)
  const { data: accountTransactionsCount, isLoading: isLoadingTransactionsCount } = useQuery({
    queryKey: computed(() => transactionQueryKeys.countByAccount(toValue(selectedAccountId) ?? '')),
    queryFn: () => transactionsApi.countByAccount(toValue(selectedAccountId)!),
    enabled: computed(() => showDeleteAccountModal.value && !!toValue(selectedAccountId)),
  });

  function openEditModal() {
    showEditAccountModal.value = true;
  }

  function openDeleteModal() {
    showDeleteAccountModal.value = true;
  }

  async function handleUpdateAccount(updates: Partial<Account>) {
    if (!selectedAccount.value) return false;
    const success = await updateAccountFn(selectedAccount.value.id, updates);
    if (success) {
      showEditAccountModal.value = false;
    }
    return success;
  }

  async function handleDeleteAccount() {
    if (!selectedAccount.value) return false;
    const success = await removeAccountFn(selectedAccount.value.id);
    if (success) {
      showDeleteAccountModal.value = false;
    }
    return success;
  }

  return {
    userId,
    currency,
    accounts,
    isLoading,
    totalBalance,
    totalBalancesByCurrency,
    localAccounts,
    handleAddAccount,
    handleDragStart,
    handleDragEnd,
    handleRefresh,
    moveAccount,
    selectedAccount,
    showEditAccountModal,
    showDeleteAccountModal,
    isUpdatingAccount,
    isDeletingAccount,
    accountError,
    accountTransactionsCount,
    isLoadingTransactionsCount,
    openEditModal,
    openDeleteModal,
    handleUpdateAccount,
    handleDeleteAccount,
  };
}
