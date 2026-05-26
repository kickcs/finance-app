import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { useDebt, useDeleteDebt, getDebtDisplayName, getDebtProgress } from '@/entities/debt';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Spinner } from '@/shared/ui/spinner';

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: debt, isLoading } = useDebt(id ?? null);
  const deleteDebt = useDeleteDebt();

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
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await deleteDebt.mutateAsync(debt.id);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  const progress = getDebtProgress(debt);
  const isGiven = debt.debt_type === 'given';
  const directionLabel = isGiven ? 'Вам должны' : 'Вы должны';

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
