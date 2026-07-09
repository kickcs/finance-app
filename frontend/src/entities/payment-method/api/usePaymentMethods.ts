import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { paymentMethodQueryKeys } from './queryKeys';
import { paymentMethodApi } from './paymentMethodApi';
import type { PaymentMethod, PaymentMethodInsert } from '../model/types';

export function usePaymentMethods(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? paymentMethodQueryKeys.list(uid) : paymentMethodQueryKeys.all;
  });

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return paymentMethodApi.getAll();
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const paymentMethods = computed(() => data.value ?? []);

  const createMutation = useMutation({
    mutationFn: (method: PaymentMethodInsert) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return paymentMethodApi.create(method);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paymentMethodApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previous = queryClient.getQueryData<PaymentMethod[]>(queryKey.value);

      queryClient.setQueryData<PaymentMethod[]>(
        queryKey.value,
        (old) => old?.filter((m) => m.id !== id) ?? [],
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey.value, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  async function createPaymentMethod(method: PaymentMethodInsert) {
    return createMutation.mutateAsync(method);
  }

  async function deletePaymentMethod(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    paymentMethods,
    isLoading,
    error,
    createPaymentMethod,
    deletePaymentMethod,
    refetch,
  };
}
