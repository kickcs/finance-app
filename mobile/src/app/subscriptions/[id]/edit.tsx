import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';

import {
  useRecurringSubscription,
  useUpdateRecurringSubscription,
} from '@/entities/recurring-subscription/api/useRecurringSubscriptions';
import type { RecurringSubscriptionInsert } from '@/entities/recurring-subscription/model/types';
import { SubscriptionForm } from '@/features/create-subscription/components/SubscriptionForm';
import { Spinner } from '@/shared/ui/spinner';

export default function EditSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: sub, isLoading } = useRecurringSubscription(id ?? null);
  const updateMutation = useUpdateRecurringSubscription();

  const handleSubmit = async (data: RecurringSubscriptionInsert) => {
    if (!id) return;
    await updateMutation.mutateAsync({ id, updates: data });
    router.back();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Stack.Screen options={{ headerShown: false }} />
        <Spinner />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SubscriptionForm
        initial={sub}
        onSubmit={handleSubmit}
        onClose={() => router.back()}
        isSubmitting={updateMutation.isPending}
      />
    </>
  );
}
