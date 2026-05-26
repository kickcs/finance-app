import { Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useBudget } from '@/entities/budget/api/useBudget';
import { Button, EmptyState, ProgressBar, SectionHeader } from '@/shared/ui';

const SET_BUDGET_ROUTE = '/set-budget' as Href;

export function BudgetSection() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data } = useBudget(userId);

  return (
    <View>
      <SectionHeader
        title="Бюджет"
        action={data ? { label: 'Настроить', onPress: () => router.push(SET_BUDGET_ROUTE) } : undefined}
      />
      {!data ? (
        <EmptyState
          variant="inline"
          icon="account_balance_wallet"
          title="Бюджет не установлен"
          action={
            <Button
              title="Установить бюджет"
              variant="secondary"
              size="sm"
              onPress={() => router.push(SET_BUDGET_ROUTE)}
            />
          }
        />
      ) : (
        <View className="mx-4 gap-3 rounded-2xl bg-card-light p-4 dark:bg-card-dark">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Потрачено
            </Text>
            <Text className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {data.spent} {data.budget.currency}
            </Text>
          </View>
          <ProgressBar
            value={data.budget.amount > 0 ? data.spent / data.budget.amount : 0}
            variant={data.percentage >= 90 ? 'danger' : data.percentage >= 70 ? 'warning' : 'default'}
          />
          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Остаток: {data.remaining} {data.budget.currency}
            </Text>
            <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              из {data.budget.amount} {data.budget.currency}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
