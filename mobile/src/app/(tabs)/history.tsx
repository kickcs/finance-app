import { SectionList, Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import {
  TransactionItem,
  useInfiniteTransactions,
} from '@/entities/transaction';
import { useUser } from '@/shared/api/composables/useAuth';
import { useGroupedTransactions } from '@/shared/lib/hooks/useGroupedTransactions';
import { Spinner } from '@/shared/ui/spinner';
import { useMemo } from 'react';

export default function HistoryScreen() {
  const user = useUser();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions(user?.id ?? null);
  const { data: accounts } = useAccounts(user?.id ?? null);

  const allTransactions = useMemo(
    () => data?.pages.flatMap((p) => p.data) ?? [],
    [data],
  );
  const sections = useGroupedTransactions(allTransactions);

  const accountById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts ?? []) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Spinner />
      </View>
    );
  }

  if (allTransactions.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark px-6">
        <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
          Пока нет операций
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background-light dark:bg-background-dark"
      contentContainerStyle={{ paddingBottom: 32 }}
      sections={sections}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View className="px-4">
          <TransactionItem
            transaction={item}
            accountName={accountById.get(item.account_id)}
            toAccountName={item.to_account_id ? accountById.get(item.to_account_id) : undefined}
          />
        </View>
      )}
      renderSectionHeader={({ section }) => (
        <View className="bg-background-light dark:bg-background-dark px-4 py-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            {section.title}
          </Text>
        </View>
      )}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-4">
            <Spinner />
          </View>
        ) : null
      }
      stickySectionHeadersEnabled
    />
  );
}
