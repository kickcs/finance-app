import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryClient, useMutation } from '@tanstack/vue-query';
import { useQuickActions, type QuickAction } from '@/features/configure-quick-action';
import { useKeyboardTrigger } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/ui';
import { transactionsApi } from '@/entities/transaction';
import { useAccounts } from '@/entities/account';
import { getTodayISO } from '@/shared/lib/date';
import { formatCurrency } from '@/shared/lib/format/currency';
import { invalidateTransactionRelated, invalidateAccountRelated } from '@/shared/api/invalidation';

export function useDashboardQuickActions(
  allCategories: ComputedRef<Array<{ id: string; icon: string; color: string }>>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { trigger: triggerKeyboard } = useKeyboardTrigger();
  const { trigger: triggerHaptic } = useHaptics();
  const { toast } = useToast();
  const { getAccountById } = useAccounts(userId);

  const oneTapMutation = useMutation({
    mutationFn: (params: {
      accountId: string;
      categoryId: string;
      amount: number;
      currency: string;
    }) =>
      transactionsApi.create({
        user_id: toValue(userId)!,
        account_id: params.accountId,
        category_id: params.categoryId,
        amount: params.amount,
        currency: params.currency,
        type: 'expense',
        date: getTodayISO(),
      }),
    onSettled: async () => {
      const uid = toValue(userId);
      if (!uid) return;
      await Promise.all([
        invalidateTransactionRelated(queryClient, uid),
        invalidateAccountRelated(queryClient, uid),
      ]);
    },
  });

  const {
    slots: quickActionSlots,
    hidden: quickActionsHidden,
    hintDismissed: quickActionsHintDismissed,
    isLoading: quickActionsLoading,
    dismissHint,
    editingAction,
    showModal: showQuickActionModal,
    handleSave,
    handleDelete,
  } = useQuickActions(userId);

  const categoryMap = computed(() => {
    const map = new Map<string, { icon: string; color: string }>();
    for (const cat of allCategories.value) {
      map.set(cat.id, { icon: cat.icon, color: cat.color });
    }
    return map;
  });

  async function handleClick(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }

    // One-tap: create transaction immediately if amount is set
    if (action.amount !== null && action.amount > 0) {
      const account = getAccountById(action.accountId);
      if (!account) return;

      const currency = account.balances[0]?.currency ?? 'USD';

      try {
        await oneTapMutation.mutateAsync({
          accountId: action.accountId,
          categoryId: action.categoryId,
          amount: action.amount,
          currency,
        });

        triggerHaptic('success');
        toast({
          title: 'Транзакция создана',
          description: `${action.label} — ${formatCurrency(action.amount, currency)}`,
          variant: 'default',
        });
      } catch {
        triggerHaptic('error');
        toast({
          title: 'Ошибка',
          description: 'Не удалось создать транзакцию',
          variant: 'error',
        });
      }
      return;
    }

    // No amount: navigate to form
    triggerKeyboard();
    router.push(
      `/transactions/new?type=expense&categoryId=${action.categoryId}&accountId=${action.accountId}`,
    );
  }

  function handleLongPress(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }
    editingAction.value = action;
    showQuickActionModal.value = true;
  }

  return {
    quickActionSlots,
    quickActionsHidden,
    quickActionsHintDismissed,
    quickActionsLoading,
    dismissHint,
    showQuickActionModal,
    editingAction,
    categoryMap,
    handleClick,
    handleLongPress,
    handleSave,
    handleDelete,
  };
}
