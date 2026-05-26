import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountSelector, useAccounts } from '@/entities/account';
import { useCloseDebt, useDebts } from '@/entities/debt';
import { useUser } from '@/shared/api/composables/useAuth';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { Spinner } from '@/shared/ui/spinner';
import { Toggle } from '@/shared/ui/toggle';

export default function CloseAllDebtsScreen() {
  const user = useUser();
  const { data: debts = [], isLoading: debtsLoading } = useDebts(user?.id ?? null);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(user?.id ?? null);
  const closeMutation = useCloseDebt();

  const openDebts = useMemo(() => debts.filter((d) => !d.is_closed), [debts]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(openDebts.map((d) => d.id)),
  );
  const [accountId, setAccountId] = useState<string | null>(null);

  const effectiveAccountId = accountId ?? accounts[0]?.id ?? null;

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleClose = () => {
    if (!effectiveAccountId) {
      Alert.alert('Нет счёта', 'Выберите счёт для закрытия долгов.');
      return;
    }
    Alert.alert(
      `Закрыть ${selectedIds.size} долгов?`,
      'Это действие нельзя отменить.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Закрыть',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              try {
                await closeMutation.mutateAsync({ id, accountId: effectiveAccountId });
              } catch {
                // continue with others on failure
              }
            }
            router.back();
          },
        },
      ],
    );
  };

  if (debtsLoading || accountsLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Закрыть долги' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Закрыть долги' }} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 16 }}>
        {/* Account picker */}
        {accounts.length > 0 ? (
          <View className="gap-2 px-4 py-3">
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

        {openDebts.length === 0 ? (
          <EmptyState icon="check_circle" title="Нет открытых долгов" />
        ) : (
          openDebts.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => toggle(d.id)}
              accessibilityRole="button"
              accessibilityLabel={`${d.person_name ?? d.name}, ${d.remaining_amount} ${d.currency}`}
              className="flex-row items-center justify-between border-b border-border-light px-4 py-3 dark:border-border-dark"
            >
              <View className="flex-1 gap-0.5">
                <Text className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                  {d.person_name ?? d.name}
                </Text>
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {formatCurrency(d.remaining_amount, d.currency)} ·{' '}
                  {d.debt_type === 'given' ? 'Должны вам' : 'Вы должны'}
                </Text>
              </View>
              <Toggle
                value={selectedIds.has(d.id)}
                onChange={() => toggle(d.id)}
                accessibilityLabel={`Выбрать ${d.person_name ?? d.name}`}
              />
            </Pressable>
          ))
        )}
      </ScrollView>

      {openDebts.length > 0 ? (
        <SafeAreaView edges={['bottom']} className="px-4 pt-2">
          <Button
            title={`Закрыть выбранные (${selectedIds.size})`}
            onPress={handleClose}
            disabled={selectedIds.size === 0 || !effectiveAccountId || closeMutation.isPending}
            loading={closeMutation.isPending}
          />
        </SafeAreaView>
      ) : null}
    </View>
  );
}
