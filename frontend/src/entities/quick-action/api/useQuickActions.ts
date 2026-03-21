import { computed, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { quickActionQueryKeys } from './queryKeys';
import { quickActionApi } from './quickActionApi';
import type { QuickAction } from '@/shared/api/database.types';
import { useProfile } from '@/shared/api/composables/useProfile';
import { STORAGE_KEYS } from '@/shared/config/storageKeys';

export const MAX_SLOTS = 6;
let migrationRun = false;

export function useQuickActions(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();
  const { profile, updateProfile } = useProfile(userId);

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? quickActionQueryKeys.list(uid) : quickActionQueryKeys.all;
  });

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => quickActionApi.getAll(),
    enabled: computed(() => !!toValue(userId)),
  });

  const actions = computed(() => data.value ?? []);

  const slots = computed(() => {
    const sorted = [...actions.value].sort((a, b) => a.position - b.position);
    const result: (QuickAction | null)[] = [];
    for (let i = 0; i < MAX_SLOTS; i++) {
      result.push(sorted[i] ?? null);
    }
    return result;
  });

  const hidden = computed(() => profile.value?.quick_actions_hidden ?? false);
  const hintDismissed = computed(() => profile.value?.quick_actions_hint_dismissed ?? false);

  const createMutation = useMutation({
    mutationFn: (params: {
      categoryId: string;
      accountId: string;
      label: string;
      amount?: number | null;
    }) => quickActionApi.create(params),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      ...params
    }: {
      id: string;
      categoryId?: string;
      accountId?: string;
      label?: string;
      amount?: number | null;
    }) => quickActionApi.update(id, params),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
      queryClient.setQueryData<QuickAction[]>(
        queryKey.value,
        (old) =>
          old?.map((a) => {
            if (a.id !== id) return a;
            return {
              ...a,
              ...(updates.categoryId !== undefined && { category_id: updates.categoryId }),
              ...(updates.accountId !== undefined && { account_id: updates.accountId }),
              ...(updates.label !== undefined && { label: updates.label }),
              ...(updates.amount !== undefined && { amount: updates.amount }),
            };
          }) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => quickActionApi.reorder(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
      queryClient.setQueryData<QuickAction[]>(queryKey.value, (old) => {
        if (!old) return old;
        const ordered: QuickAction[] = [];
        for (let i = 0; i < ids.length; i++) {
          const item = old.find((a) => a.id === ids[i]);
          if (item) ordered.push({ ...item, position: i });
        }
        const remaining = old.filter((a) => !ids.includes(a.id));
        return [...ordered, ...remaining];
      });
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quickActionApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<QuickAction[]>(queryKey.value);
      queryClient.setQueryData<QuickAction[]>(
        queryKey.value,
        (old) => old?.filter((a) => a.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey.value, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKey.value }),
  });

  async function addAction(params: {
    label: string;
    categoryId: string;
    accountId: string;
    amount?: number | null;
  }) {
    if (actions.value.length >= MAX_SLOTS) return;
    return createMutation.mutateAsync(params);
  }

  async function updateAction(
    id: string,
    updates: { categoryId?: string; accountId?: string; label?: string; amount?: number | null },
  ) {
    return updateMutation.mutateAsync({ id, ...updates });
  }

  async function removeAction(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  async function reorderActions(ids: string[]) {
    return reorderMutation.mutateAsync(ids);
  }

  async function toggleHidden() {
    await updateProfile({ quick_actions_hidden: !hidden.value });
  }

  async function dismissHint() {
    await updateProfile({ quick_actions_hint_dismissed: true });
  }

  // Auto-migrate from localStorage on first load (one-time, self-contained)
  watch(
    () => toValue(userId),
    (uid) => {
      if (!uid || migrationRun) return;
      migrationRun = true;
      migrateFromLocalStorage();
    },
    { immediate: true },
  );

  async function migrateFromLocalStorage() {
    const raw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS);
    if (!raw) return;

    try {
      const localActions = JSON.parse(raw) as Array<{
        categoryId: string;
        accountId: string;
        label: string;
      }>;
      if (localActions.length === 0) {
        cleanupLocalStorage();
        return;
      }

      const serverActions = await quickActionApi.getAll();
      if (serverActions.length > 0) {
        cleanupLocalStorage();
        return;
      }

      await Promise.all(
        localActions.map((action) =>
          quickActionApi.create({
            categoryId: action.categoryId,
            accountId: action.accountId,
            label: action.label,
          }),
        ),
      );

      const hiddenRaw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS_HIDDEN);
      const hintRaw = localStorage.getItem(STORAGE_KEYS.QUICK_ACTIONS_HINT_DISMISSED);
      const profileUpdates: Record<string, boolean> = {};
      if (hiddenRaw === 'true') profileUpdates.quick_actions_hidden = true;
      if (hintRaw === 'true') profileUpdates.quick_actions_hint_dismissed = true;
      if (Object.keys(profileUpdates).length > 0) {
        await updateProfile(profileUpdates);
      }

      cleanupLocalStorage();
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    } catch {
      // Silent fail — user can reconfigure manually
    }
  }

  return {
    actions,
    slots,
    hidden,
    hintDismissed,
    isLoading,
    addAction,
    updateAction,
    removeAction,
    reorderActions,
    toggleHidden,
    dismissHint,
  };
}

function cleanupLocalStorage() {
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS);
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS_HIDDEN);
  localStorage.removeItem(STORAGE_KEYS.QUICK_ACTIONS_HINT_DISMISSED);
}
