import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAnalyticsStats } from '@/entities/transaction/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { formatCurrency } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/shared/ui/card';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

type Period = 'week' | 'month' | 'year';

function buildRange(period: Period): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  if (period === 'week') {
    start.setDate(end.getDate() - 7);
  } else if (period === 'month') {
    start.setMonth(end.getMonth() - 1);
  } else {
    start.setFullYear(end.getFullYear() - 1);
  }
  return { start, end };
}

const PERIOD_LABEL: Record<Period, string> = {
  week: '7 дней',
  month: 'Месяц',
  year: 'Год',
};

export default function AnalyticsScreen() {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const [period, setPeriod] = useState<Period>('month');

  const range = useMemo(() => buildRange(period), [period]);
  const startDate = range.start.toISOString();
  const endDate = range.end.toISOString();

  const { data: stats, isLoading } = useAnalyticsStats(user?.id ?? null, {
    startDate,
    endDate,
  });

  const baseCurrency = profile?.currency ?? 'USD';
  const income = stats?.income_by_currency?.[baseCurrency] ?? stats?.total_income ?? 0;
  const expense = stats?.expense_by_currency?.[baseCurrency] ?? stats?.total_expense ?? 0;
  const net = income - expense;

  const expenseCategories = useMemo(
    () =>
      stats?.category_breakdown
        ?.filter((c) => c.type === 'expense')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10) ?? [],
    [stats],
  );

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      className="flex-1 bg-background-light dark:bg-background-dark"
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Text className="text-3xl font-bold text-text-primary-light dark:text-text-primary-dark">
        Аналитика
      </Text>

      <View className="flex-row rounded-xl bg-surface-light dark:bg-surface-dark p-1">
        {(['week', 'month', 'year'] as Period[]).map((p) => {
          const active = period === p;
          return (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              className={cn(
                'flex-1 items-center justify-center rounded-lg py-2',
                active && 'bg-card-light dark:bg-card-dark',
              )}
            >
              <Text
                className={cn(
                  'text-sm font-semibold',
                  active
                    ? 'text-text-primary-light dark:text-text-primary-dark'
                    : 'text-text-secondary-light dark:text-text-secondary-dark',
                )}
              >
                {PERIOD_LABEL[p]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View className="items-center py-8">
          <Spinner />
        </View>
      ) : (
        <>
          <View className="flex-row gap-3">
            <Card className="flex-1">
              <Text className="text-xs font-medium uppercase text-success">Доход</Text>
              <Text
                className="mt-1 text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {formatCurrency(income, baseCurrency)}
              </Text>
            </Card>
            <Card className="flex-1">
              <Text className="text-xs font-medium uppercase text-danger">Расход</Text>
              <Text
                className="mt-1 text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                style={{ fontVariant: ['tabular-nums'] }}
                numberOfLines={1}
              >
                {formatCurrency(expense, baseCurrency)}
              </Text>
            </Card>
          </View>

          <Card>
            <Text className="text-xs font-medium uppercase text-text-tertiary-light dark:text-text-tertiary-dark">
              Чистый итог
            </Text>
            <Text
              className={cn(
                'mt-1 text-2xl font-bold',
                net >= 0 ? 'text-success' : 'text-danger',
              )}
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {net >= 0 ? '+' : ''}
              {formatCurrency(net, baseCurrency)}
            </Text>
          </Card>

          <View className="gap-2">
            <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
              Топ расходов
            </Text>
            {expenseCategories.length === 0 ? (
              <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark text-center py-6">
                Нет данных за выбранный период
              </Text>
            ) : (
              <View className="overflow-hidden rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark">
                {expenseCategories.map((cat, index) => {
                  const isLast = index === expenseCategories.length - 1;
                  const amountInBase = cat.amount_by_currency[baseCurrency] ?? cat.amount;
                  const share = expense > 0 ? Math.round((amountInBase / expense) * 100) : 0;
                  return (
                    <View
                      key={cat.category_id}
                      className={cn(
                        'flex-row items-center gap-3 px-4 py-3',
                        !isLast && 'border-b border-border-light dark:border-border-dark',
                      )}
                    >
                      <View
                        className="h-9 w-9 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${cat.category_color}1F` }}
                      >
                        <Icon
                          name={cat.category_icon}
                          size={18}
                          color={cat.category_color}
                        />
                      </View>
                      <View className="flex-1 min-w-0">
                        <Text
                          numberOfLines={1}
                          className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                        >
                          {cat.category_name}
                        </Text>
                        <View className="mt-1 h-1 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{ width: `${share}%`, backgroundColor: cat.category_color }}
                          />
                        </View>
                      </View>
                      <View className="items-end">
                        <Text
                          className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {formatCurrency(amountInBase, baseCurrency)}
                        </Text>
                        <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                          {share}%
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
