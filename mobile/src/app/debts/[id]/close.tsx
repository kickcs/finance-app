import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import { AccountSelector, useAccounts } from '@/entities/account';
import { useCloseDebt, useDebt } from '@/entities/debt';
import { useUser } from '@/shared/api/composables/useAuth';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Spinner } from '@/shared/ui/spinner';

export default function CloseDebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: debt, isLoading: debtLoading } = useDebt(id ?? null);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(user?.id ?? null);
  const close = useCloseDebt();
  const [accountId, setAccountId] = useState<string | null>(null);

  if (debtLoading || accountsLoading || !debt) {
    return (
      <>
        <Stack.Screen options={{ title: 'Закрыть долг' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const effectiveAccountId = accountId ?? debt.account_id ?? accounts?.[0]?.id ?? null;
  const canSubmit = !!effectiveAccountId && !close.isPending;

  const onSubmit = async () => {
    if (!effectiveAccountId) return;
    await trigger('medium');
    try {
      await close.mutateAsync({ id: debt.id, accountId: effectiveAccountId });
      await trigger('success');
      router.back();
    } catch (err) {
      await trigger('error');
      throw err;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Закрыть долг' }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Сумма к закрытию
          </Text>
          <Text
            className="mt-1 text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatCurrency(debt.remaining_amount, debt.currency)}
          </Text>
        </Card>

        {accounts && accounts.length > 0 ? (
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
              С какого счёта
            </Text>
            <AccountSelector
              accounts={accounts}
              value={effectiveAccountId}
              onChange={setAccountId}
            />
          </View>
        ) : null}

        <Button
          title="Закрыть"
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          loading={close.isPending}
          className="mt-2"
        />
      </ScrollView>
    </>
  );
}
