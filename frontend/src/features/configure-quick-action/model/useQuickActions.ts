import { ref, computed, type MaybeRefOrGetter } from 'vue';
import { useQuickActions as useQuickActionsApi } from '@/entities/quick-action';
import type { QuickAction } from './types';

export function useQuickActions(userId: MaybeRefOrGetter<string | null>) {
  const api = useQuickActionsApi(userId);

  // Transform snake_case DB type to camelCase view type
  const slots = computed<(QuickAction | null)[]>(() =>
    api.slots.value.map((a) =>
      a
        ? {
            id: a.id,
            label: a.label,
            categoryId: a.category_id,
            accountId: a.account_id,
          }
        : null,
    ),
  );

  const editingAction = ref<QuickAction | null>(null);
  const showModal = ref(false);

  async function handleSave(data: { label: string; categoryId: string; accountId: string }) {
    if (editingAction.value) {
      await api.updateAction(editingAction.value.id, data);
    } else {
      await api.addAction(data);
    }
    editingAction.value = null;
  }

  async function handleDelete() {
    if (editingAction.value) {
      await api.removeAction(editingAction.value.id);
    }
    editingAction.value = null;
  }

  return {
    slots,
    hidden: api.hidden,
    hintDismissed: api.hintDismissed,
    isLoading: api.isLoading,
    editingAction,
    showModal,
    handleSave,
    handleDelete,
    toggleHidden: api.toggleHidden,
    dismissHint: api.dismissHint,
  };
}
