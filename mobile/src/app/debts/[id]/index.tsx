import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import {
  useDebt,
  useDeleteDebt,
  getDebtDisplayName,
  getDebtProgress,
  useDebtTransactions,
} from '@/entities/debt';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { ProgressBar } from '@/shared/ui/progress-bar';
import { Spinner } from '@/shared/ui/spinner';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: debt, isLoading } = useDebt(id ?? null);
  const deleteDebt = useDeleteDebt();
  const { data: transactions = [], isLoading: txLoading } = useDebtTransactions(id ?? null);

  if (isLoading || !debt) {
    return (
      <>
        <Stack.Screen options={{ title: 'Долг' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const handleDelete = () => {
    Alert.alert('Удалить долг?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await trigger('medium');
          await deleteDebt.mutateAsync(debt.id);
          await trigger('success');
          router.back();
        },
      },
    ]);
  };

  const progress = getDebtProgress(debt);
  const isGiven = debt.debt_type === 'given';
  const directionLabel = isGiven ? 'Вам должны' : 'Вы должны';
  const paidPct = debt.total_amount > 0
    ? (debt.total_amount - debt.remaining_amount) / debt.total_amount
    : 0;

  return (
    <>
      <Stack.Screen options={{ title: getDebtDisplayName(debt) }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <Card>
          <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
            {directionLabel}
          </Text>
          <Text
            className="mt-1 text-3xl font-bold text-text-primary-light dark:text-text-primary-dark"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatCurrency(debt.remaining_amount, debt.currency)}
          </Text>
          <Text className="mt-1 text-sm text-text-secondary-light dark:text-text-secondary-dark">
            из {formatCurrency(debt.total_amount, debt.currency)} · {progress}%
          </Text>

          {/* Progress bar */}
          {debt.total_amount > 0 ? (
            <View className="mt-3">
              <ProgressBar value={paidPct} variant="success" />
            </View>
          ) : null}

          {debt.description ? (
            <Text className="mt-2 text-sm text-text-secondary-light dark:text-text-secondary-dark">
              {debt.description}
            </Text>
          ) : null}
        </Card>

        {debt.is_closed ? (
          <View className="items-center rounded-xl bg-success/10 p-3">
            <Text className="text-sm font-medium text-success">Закрыт</Text>
          </View>
        ) : (
          <View className="gap-2">
            <Button
              title="Частичная оплата"
              variant="primary"
              onPress={() =>
                router.push({
                  pathname: '/debts/[id]/partial-pay',
                  params: { id: debt.id },
                })
              }
            />
            <Button
              title="Закрыть долг"
              variant="secondary"
              onPress={() =>
                router.push({ pathname: '/debts/[id]/close', params: { id: debt.id } })
              }
            />
            <Button
              title="Редактировать"
              variant="ghost"
              onPress={() =>
                router.push({ pathname: '/debts/[id]/edit', params: { id: debt.id } })
              }
            />
          </View>
        )}

        {/* Transactions / Payments section */}
        <View className="gap-3">
          <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
            Платежи
          </Text>
          {txLoading ? (
            <View className="py-4">
              <Spinner />
            </View>
          ) : transactions.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              title="Платежей нет"
              variant="inline"
            />
          ) : (
            transactions.map((tx) => (
              <View
                key={tx.id}
                className="flex-row items-center gap-3 rounded-xl bg-surface-light px-4 py-3 dark:bg-surface-dark"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Icon name="payments" size={18} color="#4f46e5" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                    {formatCurrency(tx.amount, tx.currency)}
                  </Text>
                  <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {formatDate(tx.date)}
                  </Text>
                </View>
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {tx.type === 'income' ? '+' : '−'}
                </Text>
              </View>
            ))
          )}
        </View>

        <Button
          title="Удалить"
          variant="danger"
          onPress={handleDelete}
          loading={deleteDebt.isPending}
        />
      </ScrollView>
    </>
  );
}
