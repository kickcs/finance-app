import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import { useDebt } from '@/entities/debt';
import { DebtForm } from '@/features/create-debt/DebtForm';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Spinner } from '@/shared/ui/spinner';

export default function EditDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(user?.id ?? null);
  const { data: debt, isLoading: debtLoading } = useDebt(id ?? null);

  if (accountsLoading || debtLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать долг' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  if (!debt || !accounts || accounts.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать долг' }} />
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            Долг не найден
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Редактировать долг' }} />
      <DebtForm
        accounts={accounts}
        defaultCurrency={profile?.currency ?? debt.currency}
        defaultAccountId={debt.account_id ?? undefined}
        editId={debt.id}
        initialValues={{
          direction: debt.debt_type,
          personName: debt.person_name ?? '',
          totalAmount: String(debt.total_amount),
          currency: debt.currency,
          accountId: debt.account_id ?? '',
          description: debt.description ?? '',
        }}
      />
    </>
  );
}
