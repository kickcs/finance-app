import { useCallback, useMemo } from 'react';
import { Alert, Pressable, RefreshControl, SectionList, Text, View } from 'react-native';

import { useAccounts } from '@/entities/account/api';
import {
  TransactionItem,
  useDeleteTransaction,
  useInfiniteTransactions,
} from '@/entities/transaction';
import { EditTransactionSheet } from '@/features/edit-transaction/components/EditTransactionSheet';
import { useTransactionEditFlow } from '@/features/edit-transaction/composables/useTransactionEditFlow';
import { SearchInput } from '@/features/search-transactions/components/SearchInput';
import { useServerSearch } from '@/features/search-transactions/composables/useServerSearch';
import { useHistoryFilters } from '@/features/transaction-filters/composables/useHistoryFilters';
import { useUser } from '@/shared/api/composables/useAuth';
import type { Transaction } from '@/shared/api/database.types';
import { trigger } from '@/shared/lib/haptics';
import { useGroupedTransactions } from '@/shared/lib/hooks/useGroupedTransactions';
import { usePullToRefresh } from '@/shared/lib/hooks/usePullToRefresh';
import { SelectChips, Spinner, SwipeableRow, Tabs } from '@/shared/ui';

const TYPE_TABS = [
  { id: 'all' as const, label: 'Все' },
  { id: 'income' as const, label: 'Доходы' },
  { id: 'expense' as const, label: 'Расходы' },
];

export default function HistoryScreen() {
  const user = useUser();
  const { type, setType, accountId, setAccountId, query, setQuery } = useHistoryFilters();
  const { editing, openEdit, closeEdit } = useTransactionEditFlow();

  const isSearching = query.trim().length > 0;

  // Build filters for the paginated list (type + accountId are fully server-side).
  const filters = useMemo(
    () => ({
      type: type !== 'all' ? (type as 'income' | 'expense') : undefined,
      accountId: accountId ?? undefined,
    }),
    [type, accountId],
  );

  const {
    data: listData,
    isLoading: listLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTransactions(isSearching ? null : (user?.id ?? null), filters);

  const {
    data: searchData,
    isLoading: searchLoading,
    fetchNextPage: fetchNextSearchPage,
    hasNextPage: hasNextSearchPage,
    isFetchingNextPage: isFetchingNextSearchPage,
  } = useServerSearch<Transaction>(isSearching ? (user?.id ?? null) : null, query);

  const { data: accounts } = useAccounts(user?.id ?? null);
  const { refreshing, onRefresh } = usePullToRefresh();

  const activeData = isSearching ? searchData : listData;
  const activeLoading = isSearching ? searchLoading : listLoading;
  const activeFetchNextPage = isSearching ? fetchNextSearchPage : fetchNextPage;
  const activeHasNextPage = isSearching ? hasNextSearchPage : hasNextPage;
  const activeFetchingNextPage = isSearching
    ? isFetchingNextSearchPage
    : isFetchingNextPage;

  const allTransactions = useMemo(
    () => activeData?.pages.flatMap((p) => p.data) ?? [],
    [activeData],
  );
  const sections = useGroupedTransactions(allTransactions);

  const deleteTransaction = useDeleteTransaction();
  const askDelete = useCallback(
    (id: string) => {
      Alert.alert('Удалить операцию?', 'Действие нельзя отменить.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction.mutateAsync(id);
              await trigger('success');
            } catch {
              await trigger('error');
            }
          },
        },
      ]);
    },
    [deleteTransaction],
  );

  const accountById = useMemo(() => {
    const map = new Map<string, string>();
    for (const account of accounts ?? []) {
      map.set(account.id, account.name);
    }
    return map;
  }, [accounts]);

  const accountChips = useMemo(
    () => (accounts ?? []).map((a) => ({ id: a.id, label: a.name })),
    [accounts],
  );

  const ListHeader = (
    <View className="bg-background-light dark:bg-background-dark">
      <SearchInput value={query} onChange={setQuery} />
      <View className="mx-4 my-2">
        <Tabs items={TYPE_TABS} value={type} onChange={setType} />
      </View>
      {accountChips.length > 0 && (
        <View className="mb-2">
          <SelectChips
            items={accountChips}
            value={accountId}
            onChange={setAccountId}
          />
        </View>
      )}
    </View>
  );

  if (activeLoading) {
    return (
      <View className="flex-1 bg-background-light dark:bg-background-dark">
        {ListHeader}
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      </View>
    );
  }

  if (allTransactions.length === 0) {
    return (
      <View className="flex-1 bg-background-light dark:bg-background-dark">
        {ListHeader}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-base text-text-secondary-light dark:text-text-secondary-dark text-center">
            {isSearching ? 'Ничего не найдено' : 'Пока нет операций'}
          </Text>
        </View>
        {editing ? (
          <EditTransactionSheet transaction={editing} onClose={closeEdit} />
        ) : null}
      </View>
    );
  }

  return (
    <>
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={ListHeader}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const editable = item.type === 'income' || item.type === 'expense';
          return (
            <SwipeableRow onDelete={editable ? () => askDelete(item.id) : undefined}>
              <Pressable
                className="px-4 bg-background-light dark:bg-background-dark"
                onLongPress={editable ? () => openEdit(item) : undefined}
                delayLongPress={400}
                accessibilityLabel={
                  editable ? 'Удерживайте для редактирования' : undefined
                }
              >
                <TransactionItem
                  transaction={item}
                  accountName={accountById.get(item.account_id)}
                  toAccountName={
                    item.to_account_id ? accountById.get(item.to_account_id) : undefined
                  }
                />
              </Pressable>
            </SwipeableRow>
          );
        }}
        renderSectionHeader={({ section }) => (
          <View className="bg-background-light dark:bg-background-dark px-4 py-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
              {section.title}
            </Text>
          </View>
        )}
        onEndReached={() => {
          if (activeHasNextPage && !activeFetchingNextPage) void activeFetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          activeFetchingNextPage ? (
            <View className="py-4">
              <Spinner />
            </View>
          ) : null
        }
        stickySectionHeadersEnabled
      />
      {editing ? (
        <EditTransactionSheet transaction={editing} onClose={closeEdit} />
      ) : null}
    </>
  );
}
