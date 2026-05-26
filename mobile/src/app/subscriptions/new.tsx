import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

import { useCreateRecurringSubscription } from '@/entities/recurring-subscription/api/useRecurringSubscriptions';
import type { RecurringSubscriptionInsert } from '@/entities/recurring-subscription/model/types';
import { SubscriptionForm } from '@/features/create-subscription/components/SubscriptionForm';

export default function NewSubscriptionScreen() {
  const router = useRouter();
  const createMutation = useCreateRecurringSubscription();

  const handleSubmit = async (data: RecurringSubscriptionInsert) => {
    await createMutation.mutateAsync(data);
    router.back();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SubscriptionForm
        onSubmit={handleSubmit}
        onClose={() => router.back()}
        isSubmitting={createMutation.isPending}
      />
    </>
  );
}
