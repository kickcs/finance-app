import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useRouter } from 'vue-router';
import { useQuickActions, type QuickAction } from '@/features/configure-quick-action';
import { useKeyboardTrigger } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/ui';
import { useTransactions } from '@/entities/transaction';
import { useAccounts } from '@/entities/account';
import { getTodayISO } from '@/shared/lib/date';

export function useDashboardQuickActions(
  allCategories: ComputedRef<Array<{ id: string; icon: string; color: string }>>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const router = useRouter();
  const { trigger: triggerKeyboard } = useKeyboardTrigger();
  const { trigger: triggerHaptic } = useHaptics();
  const { toast } = useToast();
  const { getAccountById, updateBalance } = useAccounts(userId);
  const { createTransaction } = useTransactions(userId);

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
    if (action.amount !== null && action.amount !== undefined && action.amount > 0) {
      const uid = toValue(userId);
      if (!uid) return;

      const account = getAccountById(action.accountId);
      if (!account) return;

      const currency = account.balances[0]?.currency ?? 'USD';

      try {
        await createTransaction(
          {
            account_id: action.accountId,
            category_id: action.categoryId,
            amount: action.amount,
            currency,
            type: 'expense',
            date: getTodayISO(),
          },
          async (accountId, amount) => {
            await updateBalance(accountId, amount);
          },
        );

        triggerHaptic('success');
        toast({
          title: 'Транзакция создана',
          description: `${action.label} — ${action.amount} ${currency}`,
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
