import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { pushSubscriptionApi } from './pushSubscriptionApi';
import { pushSubscriptionQueryKeys } from './queryKeys';
import type { NotificationPreferences } from '../model/types';

export function useNotificationPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: pushSubscriptionQueryKeys.preferences(),
    queryFn: () => pushSubscriptionApi.getPreferences(),
    staleTime: 1000 * 60 * 5,
  });

  const updateMutation = useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) =>
      pushSubscriptionApi.updatePreferences(prefs),
    onMutate: async (newPrefs) => {
      await queryClient.cancelQueries({ queryKey: pushSubscriptionQueryKeys.preferences() });
      const previous = queryClient.getQueryData<NotificationPreferences>(
        pushSubscriptionQueryKeys.preferences(),
      );
      if (previous) {
        queryClient.setQueryData<NotificationPreferences>(pushSubscriptionQueryKeys.preferences(), {
          ...previous,
          ...newPrefs,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(pushSubscriptionQueryKeys.preferences(), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pushSubscriptionQueryKeys.preferences() });
    },
  });

  return {
    preferences: query.data,
    isLoading: query.isLoading,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
