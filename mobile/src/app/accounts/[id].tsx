import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useAccount } from '@/entities/account/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { Spinner } from '@/shared/ui/spinner';

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: account, isLoading } = useAccount(user?.id ?? null, id ?? null);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Spinner />
      </View>
    );
  }

  return (
    <View className="flex-1 px-4 py-6 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: account?.name ?? 'Счёт' }} />
      <Text className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
        {account?.name ?? '—'}
      </Text>
      <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
        История транзакций появится в следующих задачах.
      </Text>
    </View>
  );
}
