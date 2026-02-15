import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { queryKeys } from '../queryKeys';
import { profileApi } from '../services/profileApi';
import type { Profile } from '../database.types';

export function useProfile(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? queryKeys.profile.detail(uid) : queryKeys.profile.all;
  });

  const {
    data: profile,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return null;
      return profileApi.getOrCreate(uid);
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Profile>) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return profileApi.update(uid, updates);
    },
    onMutate: async (updates) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousProfile = queryClient.getQueryData<Profile | null>(
        queryKey.value,
      );

      if (previousProfile) {
        queryClient.setQueryData<Profile>(queryKey.value, {
          ...previousProfile,
          ...updates,
        });
      }

      return { previousProfile };
    },
    onError: (_err, _updates, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKey.value, context.previousProfile);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  async function updateProfile(updates: Partial<Profile>) {
    return updateMutation.mutateAsync(updates);
  }

  async function setCurrency(currency: string) {
    const result = await updateProfile({ currency });
    localStorage.setItem('selectedCurrency', currency);
    return result;
  }

  async function completeOnboarding() {
    const result = await updateProfile({ has_completed_onboarding: true });
    localStorage.setItem('onboardingComplete', 'true');
    return result;
  }

  function hasCompletedOnboarding(): boolean {
    return profile.value?.has_completed_onboarding ?? false;
  }

  // Default account
  const defaultAccountId = computed(
    () => profile.value?.default_account_id ?? null,
  );

  async function setDefaultAccount(accountId: string) {
    return updateProfile({ default_account_id: accountId });
  }

  return {
    profile,
    isLoading,
    error,
    updateProfile,
    setCurrency,
    completeOnboarding,
    hasCompletedOnboarding,
    defaultAccountId,
    setDefaultAccount,
    refetch,
  };
}
