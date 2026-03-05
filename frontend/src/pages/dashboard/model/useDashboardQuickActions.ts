import { computed, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useRouter } from 'vue-router';
import { useQuickActions, type QuickAction } from '@/features/configure-quick-action';

export function useDashboardQuickActions(
  allCategories: ComputedRef<Array<{ id: string; icon: string; color: string }>>,
  userId: MaybeRefOrGetter<string | null>,
) {
  const router = useRouter();

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

  function handleClick(action: QuickAction | null) {
    if (!action) {
      editingAction.value = null;
      showQuickActionModal.value = true;
      return;
    }

    // Pre-focus a temporary numeric input to open the keyboard within the user gesture chain.
    // Mobile browsers block programmatic focus() outside tap handlers, so we open the keyboard
    // here and HeroAmount.onMounted will transfer focus to the real input, keeping it open.
    const tmp = document.createElement('input');
    tmp.type = 'number';
    tmp.inputMode = 'numeric';
    tmp.style.cssText = 'position:fixed;opacity:0;top:0;left:0;width:1px;height:1px';
    document.body.appendChild(tmp);
    tmp.focus();
    setTimeout(() => tmp.remove(), 2000);

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
