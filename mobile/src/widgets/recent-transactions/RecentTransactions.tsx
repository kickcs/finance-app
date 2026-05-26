import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import { TransactionItem, useRecentTransactions } from '@/entities/transaction';
import { useUser } from '@/shared/api/composables/useAuth';
import { Spinner } from '@/shared/ui/spinner';

interface Props {
  limit?: number;
}

export function RecentTransactions({ limit = 5 }: Props) {
  const user = useUser();
  const router = useRouter();
  const { data: transactions, isLoading } = useRecentTransactions(user?.id ?? null, limit);
  const { data: accounts } = useAccounts(user?.id ?? null);

  const accountById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts ?? []) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-6">
        <Spinner />
      </View>
    );
  }

  const list = transactions ?? [];
  if (list.length === 0) {
    return (
      <View className="rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 items-center">
        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
          Нет операций
        </Text>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark">
      {list.map((tx, index) => {
        const isLast = index === list.length - 1;
        return (
          <View
            key={tx.id}
            className={isLast ? '' : 'border-b border-border-light dark:border-border-dark'}
          >
            <TransactionItem
              transaction={tx}
              accountName={accountById.get(tx.account_id)}
              toAccountName={tx.to_account_id ? accountById.get(tx.to_account_id) : undefined}
              onPress={
                tx.type === 'income' || tx.type === 'expense'
                  ? () =>
                      router.push({
                        pathname: '/transactions/[id]/edit',
                        params: { id: tx.id },
                      })
                  : undefined
              }
            />
          </View>
        );
      })}
    </View>
  );
}
