import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileApi } from '@/shared/api/services/profileApi';
import type { DashboardSettings, Profile } from '@/shared/api/database.types';

const profileKeys = {
  all: ['profile'] as const,
  detail: (userId: string) => [...profileKeys.all, 'detail', userId] as const,
};

export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: profileKeys.detail(userId ?? '__disabled__'),
    queryFn: () => profileApi.getOrCreate(),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateProfile(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<Profile>) => profileApi.update(updates),
    onMutate: async (updates) => {
      if (!userId) return { previous: undefined };
      const key = profileKeys.detail(userId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Profile | null>(key);
      if (previous) {
        qc.setQueryData<Profile>(key, { ...previous, ...updates });
      }
      return { previous };
    },
    onError: (_err, _updates, context) => {
      if (!userId || !context?.previous) return;
      qc.setQueryData(profileKeys.detail(userId), context.previous);
    },
    onSettled: () => {
      if (!userId) return;
      qc.invalidateQueries({ queryKey: profileKeys.detail(userId) });
    },
  });
}

export function useSetCurrency(userId: string | null) {
  const update = useUpdateProfile(userId);
  return {
    setCurrency: (currency: string) => update.mutateAsync({ currency }),
    isPending: update.isPending,
  };
}

export function useCompleteOnboarding(userId: string | null) {
  const update = useUpdateProfile(userId);
  return {
    completeOnboarding: () => update.mutateAsync({ has_completed_onboarding: true }),
    isPending: update.isPending,
  };
}

export function useSetDefaultAccount(userId: string | null) {
  const update = useUpdateProfile(userId);
  return {
    setDefaultAccount: (accountId: string) =>
      update.mutateAsync({ default_account_id: accountId }),
    isPending: update.isPending,
  };
}

export function useSetDashboardSettings(userId: string | null) {
  const update = useUpdateProfile(userId);
  return {
    setDashboardSettings: (settings: DashboardSettings) =>
      update.mutateAsync({ dashboard_settings: settings }),
    isPending: update.isPending,
  };
}
