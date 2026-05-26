import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { useAccountsWithBalances } from '@/entities/account/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { formatMasked } from '@/shared/lib/format/currency';
import { Card } from '@/shared/ui/card';
import { Spinner } from '@/shared/ui/spinner';

interface Props {
  hidden?: boolean;
}

export function BalanceCard({ hidden }: Props) {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading } = useAccountsWithBalances(user?.id ?? null);

  const baseCurrency = profile?.currency ?? 'USD';

  const totalBalance = useMemo(() => {
    if (!accounts) return 0;
    return accounts.reduce((sum, account) => {
      const inBase = account.balances.find((b) => b.currency === baseCurrency);
      return sum + (inBase?.balance ?? 0);
    }, 0);
  }, [accounts, baseCurrency]);

  return (
    <Card className="p-5">
      <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
        Баланс
      </Text>
      {isLoading ? (
        <View className="mt-2 h-9 justify-center">
          <Spinner />
        </View>
      ) : (
        <Text
          className="mt-1 text-2xl font-extrabold tracking-tight text-text-primary-light dark:text-text-primary-dark"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {formatMasked(totalBalance, baseCurrency, hidden ?? false)}
        </Text>
      )}
    </Card>
  );
}
