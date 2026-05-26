import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import { DebtForm } from '@/features/create-debt/DebtForm';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Spinner } from '@/shared/ui/spinner';

export default function NewDebtScreen() {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading } = useAccounts(user?.id ?? null);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Новый долг' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Новый долг' }} />
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            Сначала создайте счёт
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Новый долг' }} />
      <DebtForm
        accounts={accounts}
        defaultCurrency={profile?.currency ?? 'USD'}
        defaultAccountId={profile?.default_account_id ?? undefined}
      />
    </>
  );
}
