import { ref, computed, type MaybeRefOrGetter } from 'vue';
import { useQuickActions as useQuickActionsApi } from '@/entities/quick-action';
import type { QuickAction, QuickActionPayload } from './types';

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
            amount: a.amount,
          }
        : null,
    ),
  );

  const editingAction = ref<QuickAction | null>(null);
  const showModal = ref(false);

  async function handleSave(data: QuickActionPayload) {
    if (editingAction.value) {
      await api.updateAction(editingAction.value.id, data);
    } else {
      await api.addAction(data);
    }
    editingAction.value = null;
    showModal.value = false;
  }

  async function handleDelete() {
    if (editingAction.value) {
      await api.removeAction(editingAction.value.id);
    }
    editingAction.value = null;
    showModal.value = false;
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
