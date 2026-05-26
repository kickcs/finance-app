import { Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/entities/account/api';
import { TransactionForm } from '@/features/add-transaction/TransactionForm';
import type { Transaction } from '@/shared/api/database.types';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { Spinner } from '@/shared/ui/spinner';

type Props = {
  transaction: Transaction;
  onClose: () => void;
};

export function EditTransactionSheet({ transaction, onClose }: Props) {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading } = useAccounts(user?.id ?? null);

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-background-light dark:bg-background-dark"
      >
        {isLoading || !accounts ? (
          <View className="flex-1 items-center justify-center">
            <Spinner />
          </View>
        ) : transaction.type !== 'income' && transaction.type !== 'expense' ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
              Редактирование переводов и корректировок пока недоступно.
            </Text>
          </View>
        ) : (
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
            onDone={onClose}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
