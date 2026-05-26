import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AccountSelector, useAccounts } from '@/entities/account';
import { useDebt, usePartialPayment } from '@/entities/debt';
import { useUser } from '@/shared/api/composables/useAuth';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';

function parseAmount(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, '').replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export default function PartialPayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: debt, isLoading: debtLoading } = useDebt(id ?? null);
  const { data: accounts, isLoading: accountsLoading } = useAccounts(user?.id ?? null);
  const partial = usePartialPayment();
  const [input, setInput] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);

  if (debtLoading || accountsLoading || !debt) {
    return (
      <>
        <Stack.Screen options={{ title: 'Частичная оплата' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const amount = parseAmount(input);
  const effectiveAccountId = accountId ?? debt.account_id ?? accounts?.[0]?.id ?? null;
  const canSubmit =
    amount !== null && amount <= debt.remaining_amount && !!effectiveAccountId && !partial.isPending;

  const onSubmit = async () => {
    if (!canSubmit || amount === null || !effectiveAccountId) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await partial.mutateAsync({ id: debt.id, amount, accountId: effectiveAccountId });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      throw err;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Частичная оплата' }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Остаток
          </Text>
          <Text
            className="mt-1 text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatCurrency(debt.remaining_amount, debt.currency)}
          </Text>
        </Card>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Сумма платежа
          </Text>
          <Input
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder="0"
          />
        </View>

        {accounts && accounts.length > 0 ? (
          <View className="gap-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
              Счёт
            </Text>
            <AccountSelector
              accounts={accounts}
              value={effectiveAccountId}
              onChange={setAccountId}
            />
          </View>
        ) : null}

        <Button
          title="Внести оплату"
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          loading={partial.isPending}
          className="mt-2"
        />
      </ScrollView>
    </>
  );
}
