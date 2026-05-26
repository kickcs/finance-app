import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { AccountCard, useAccountsWithBalances } from '@/entities/account';
import { useUser } from '@/shared/api/composables/useAuth';
import { Spinner } from '@/shared/ui/spinner';

interface Props {
  hidden?: boolean;
}

export function AccountStack({ hidden }: Props) {
  const user = useUser();
  const router = useRouter();
  const { data: accounts, isLoading } = useAccountsWithBalances(user?.id ?? null);

  if (isLoading) {
    return (
      <View className="items-center justify-center py-6">
        <Spinner />
      </View>
    );
  }

  const list = accounts ?? [];
  if (list.length === 0) {
    return (
      <View className="rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-6 items-center">
        <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center">
          У вас пока нет счетов
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark overflow-hidden">
      {list.map((account, index) => {
        const isLast = index === list.length - 1;
        return (
          <View
            key={account.id}
            className={isLast ? '' : 'border-b border-border-light dark:border-border-dark'}
          >
            <AccountCard
              account={account}
              compact
              hidden={hidden}
              onPress={() => router.push({ pathname: '/accounts/[id]', params: { id: account.id } })}
              className="border-0 rounded-none"
            />
          </View>
        );
      })}
    </View>
  );
}
