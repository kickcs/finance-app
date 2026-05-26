import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { quickActionsApi, type QuickActionInput } from './quickActionsApi';
import { quickActionKeys } from './queryKeys';

export function useQuickActions(userId: string | null) {
  return useQuery({
    queryKey: quickActionKeys.list(userId ?? '__disabled__'),
    queryFn: () => quickActionsApi.list(),
    enabled: !!userId,
  });
}

export function useCreateQuickAction(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: QuickActionInput) => quickActionsApi.create(input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: quickActionKeys.list(userId) });
    },
  });
}

export function useUpdateQuickAction(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<QuickActionInput> }) =>
      quickActionsApi.update(id, input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: quickActionKeys.list(userId) });
    },
  });
}

export function useDeleteQuickAction(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quickActionsApi.remove(id),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: quickActionKeys.list(userId) });
    },
  });
}

export function useReorderQuickActions(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => quickActionsApi.reorder(orderedIds),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: quickActionKeys.list(userId) });
    },
  });
}
