import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import { useAccountsWithBalances } from '@/entities/account/api';
import { useAdjustBalance } from '@/entities/transaction/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Spinner } from '@/shared/ui/spinner';

function parseAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let cleaned = trimmed.replace(/\s/g, '');
  if (cleaned.includes('.') && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(',', '.');
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export default function AdjustBalanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: accounts, isLoading } = useAccountsWithBalances(user?.id ?? null);
  const adjust = useAdjustBalance();
  const [input, setInput] = useState('');
  const [description, setDescription] = useState('');

  const account = useMemo(() => accounts?.find((a) => a.id === id), [accounts, id]);
  const currency = account?.balances?.[0]?.currency ?? profile?.currency ?? 'USD';
  const currentBalance = account?.balances?.find((b) => b.currency === currency)?.balance ?? 0;
  const targetBalance = parseAmount(input);
  const diff = targetBalance !== null ? targetBalance - currentBalance : 0;
  const canSubmit = targetBalance !== null && Math.abs(diff) > 0.001 && !adjust.isPending;

  if (isLoading || !account) {
    return (
      <>
        <Stack.Screen options={{ title: 'Корректировка' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const onSubmit = async () => {
    if (!canSubmit || !account || targetBalance === null) return;
    try {
      await trigger('medium');
      await adjust.mutateAsync({
        accountId: account.id,
        targetBalance,
        currency,
        description: description.trim() ? description.trim() : undefined,
      });
      await trigger('success');
      router.back();
    } catch (err) {
      await trigger('error');
      throw err;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: `Коррекция · ${account.name}` }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="rounded-2xl bg-card-light dark:bg-card-dark p-4 gap-1">
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            Текущий баланс
          </Text>
          <Text
            className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatCurrency(currentBalance, currency)}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Новый баланс
          </Text>
          <Input
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            placeholder={String(currentBalance)}
          />
        </View>

        {targetBalance !== null ? (
          <View className="rounded-xl bg-surface-light dark:bg-surface-dark p-3">
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Разница
            </Text>
            <Text
              className={
                diff >= 0
                  ? 'text-base font-semibold text-success'
                  : 'text-base font-semibold text-danger'
              }
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {diff >= 0 ? '+' : ''}
              {formatCurrency(diff, currency)}
            </Text>
          </View>
        ) : null}

        <View className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-wide text-text-secondary-light dark:text-text-secondary-dark">
            Заметка
          </Text>
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="Опционально"
            autoCapitalize="sentences"
          />
        </View>

        <Button
          title="Применить"
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
          loading={adjust.isPending}
          className="mt-2"
        />
      </ScrollView>
    </>
  );
}
