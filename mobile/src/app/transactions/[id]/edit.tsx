import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import { useTransaction } from '@/entities/transaction/api';
import { TransactionForm } from '@/features/add-transaction/TransactionForm';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Spinner } from '@/shared/ui/spinner';

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(user?.id ?? null);
  const { data: transaction, isLoading: txLoading } = useTransaction(id ?? null);

  if (accountsLoading || txLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  if (!transaction || !accounts || accounts.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать' }} />
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            Операция не найдена
          </Text>
        </View>
      </>
    );
  }

  // This screen only handles plain income/expense edits. Transfers and
  // adjustments carry extra fields (to_account_id, to_amount, is_informational)
  // that TransactionForm doesn't manage — saving here would corrupt them.
  if (transaction.type !== 'income' && transaction.type !== 'expense') {
    return (
      <>
        <Stack.Screen options={{ title: 'Редактировать' }} />
        <View className="flex-1 items-center justify-center px-6 bg-background-light dark:bg-background-dark">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            Редактирование переводов и корректировок пока недоступно.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Редактировать' }} />
      <TransactionForm
        accounts={accounts}
        defaultAccountId={transaction.account_id}
        defaultCurrency={transaction.currency || profile?.currency || 'USD'}
        editId={transaction.id}
        initialDate={transaction.date}
        initialValues={{
          amount: String(transaction.amount),
          type: transaction.type,
          categoryId: transaction.category_id,
          accountId: transaction.account_id,
          description: transaction.description ?? '',
        }}
      />
    </>
  );
}
