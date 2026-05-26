import { Stack } from 'expo-router';
import { Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import { TransactionForm } from '@/features/add-transaction/TransactionForm';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Spinner } from '@/shared/ui/spinner';

export default function NewTransactionScreen() {
  const user = useUser();
  const { data: profile, isLoading: profileLoading } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(user?.id ?? null);

  if (profileLoading || accountsLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Новая операция' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Новая операция' }} />
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            Сначала создайте счёт
          </Text>
        </View>
      </>
    );
  }

  const defaultAccountId =
    profile?.default_account_id && accounts.some((a) => a.id === profile.default_account_id)
      ? profile.default_account_id
      : accounts[0]!.id;
  const defaultCurrency = profile?.currency ?? accounts[0]!.currency ?? 'USD';

  return (
    <>
      <Stack.Screen options={{ title: 'Новая операция' }} />
      <TransactionForm
        accounts={accounts}
        defaultAccountId={defaultAccountId}
        defaultCurrency={defaultCurrency}
      />
    </>
  );
}
