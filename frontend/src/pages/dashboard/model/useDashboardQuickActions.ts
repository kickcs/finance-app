import { ref, computed, type ComputedRef } from 'vue';
import { useRouter } from 'vue-router';
import {
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';

export function useDashboardQuickActions(
  allCategories: ComputedRef<Array<{ id: string; icon: string; color: string }>>,
) {
  const router = useRouter();

  const {
    slots: quickActionSlots,
    addAction,
    updateAction,
    removeAction,
    hidden: quickActionsHidden,
  } = useQuickActions();

  const showQuickActionModal = ref(false);
  const editingAction = ref<QuickAction | null>(null);

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

  function handleSave(data: {
    label: string;
    categoryId: string;
    accountId: string;
  }) {
    if (editingAction.value) {
      updateAction(editingAction.value.id, data);
    } else {
      addAction(data);
    }
    editingAction.value = null;
  }

  function handleDelete() {
    if (editingAction.value) {
      removeAction(editingAction.value.id);
    }
    editingAction.value = null;
  }

  return {
    quickActionSlots,
    quickActionsHidden,
    showQuickActionModal,
    editingAction,
    categoryMap,
    handleClick,
    handleLongPress,
    handleSave,
    handleDelete,
  };
}
