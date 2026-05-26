import { Stack, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { AccountCard, useAccountsWithBalances } from '@/entities/account';
import { useUser } from '@/shared/api/composables/useAuth';
import { Spinner } from '@/shared/ui/spinner';

export default function AccountsScreen() {
  const user = useUser();
  const router = useRouter();
  const { data: accounts, isLoading } = useAccountsWithBalances(user?.id ?? null);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Spinner />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Счета', headerLargeTitle: true }} />
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        className="bg-background-light dark:bg-background-dark"
        data={accounts ?? []}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <AccountCard
            account={item}
            onPress={() =>
              router.push({ pathname: '/accounts/[id]', params: { id: item.id } })
            }
          />
        )}
      />
    </>
  );
}
