import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { categoriesApi, type CategoryInput } from './categoriesApi';
import { categoryKeys } from './queryKeys';

export function useCategories(userId: string | null) {
  return useQuery({
    queryKey: categoryKeys.list(userId ?? '__disabled__'),
    queryFn: () => categoriesApi.list(),
    enabled: !!userId,
  });
}

export function useCreateCategory(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => categoriesApi.create(input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: categoryKeys.list(userId) });
    },
  });
}

export function useUpdateCategory(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
      categoriesApi.update(id, input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: categoryKeys.list(userId) });
    },
  });
}

export function useDeleteCategory(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.remove(id),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: categoryKeys.list(userId) });
    },
  });
}

export function useReorderCategories(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      type,
      orderedIds,
    }: {
      type: 'expense' | 'income';
      orderedIds: string[];
    }) => categoriesApi.reorder(type, orderedIds),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: categoryKeys.list(userId) });
    },
  });
}
