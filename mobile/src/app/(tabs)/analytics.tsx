import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAnalyticsStats, useDailyStats } from '@/entities/transaction/api/useAnalyticsStats';
import type { CategoryBreakdown, DailyStatsEntry } from '@/entities/transaction/api/transactionsApi';
import { useUser } from '@/shared/api/composables/useAuth';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useUserCurrency } from '@/shared/lib/composables/useUserCurrency';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/shared/ui/card';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

import { usePeriodNavigation } from '@/widgets/analytics/composables/usePeriodNavigation';
import { PeriodHeader } from '@/widgets/analytics/PeriodHeader';
import { DonutChart } from '@/widgets/analytics/DonutChart';
import type { DonutSlice } from '@/widgets/analytics/DonutChart';
import { DailyExpenseChart } from '@/widgets/analytics/DailyExpenseChart';
import { DailyStatsCards } from '@/widgets/analytics/DailyStatsCards';
import { useAnalyticsFilters } from '@/features/analytics-filters/composables/useAnalyticsFilters';
import { FilterChips } from '@/features/analytics-filters/components/FilterChips';

export default function AnalyticsScreen() {
  const user = useUser();
  const currency = useUserCurrency();

  const { scale, setScale, range, prev, next, anchor } = usePeriodNavigation('month');
  const { accountIds, setAccountIds, categoryIds, setCategoryIds } = useAnalyticsFilters();

  const { data: stats, isLoading } = useAnalyticsStats(user?.id ?? null, {
    startDate: range.startISO,
    endDate: range.endISO,
    accountIds: accountIds ?? undefined,
  });

  const { data: daily = [] } = useDailyStats(user?.id ?? null, {
    startDate: range.startISO,
    endDate: range.endISO,
    accountIds: accountIds ?? undefined,
  });

  const label = formatLabel(scale, anchor);

  // income/expense/net summary — pick base currency bucket, fall back to total
  const income = stats?.income_by_currency?.[currency] ?? stats?.total_income ?? 0;
  const expense = stats?.expense_by_currency?.[currency] ?? stats?.total_expense ?? 0;
  const net = income - expense;

  // Top expense categories filtered by categoryIds (client-side; API doesn't accept categoryIds)
  const expenseCategories: CategoryBreakdown[] = (stats?.category_breakdown ?? [])
    .filter((c) => c.type === 'expense')
    .filter((c) => categoryIds === null || categoryIds.includes(c.category_id))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // DonutChart slices from expense categories
  const slices: DonutSlice[] = expenseCategories.map((c) => ({
    id: c.category_id,
    value: Math.round(c.amount_by_currency[currency] ?? c.amount),
    color: c.category_color,
    label: c.category_name,
  }));
  const donutTotal = slices.reduce((s, x) => s + x.value, 0);

  // DailyExpenseChart buckets: pick base currency, fall back to first currency value
  const dailyBuckets = (daily as DailyStatsEntry[]).map((d) => ({
    date: d.date,
    expense: d.expense_by_currency[currency] ?? Object.values(d.expense_by_currency)[0] ?? 0,
  }));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background-light dark:bg-background-dark">
      <ScrollView contentContainerClassName="pb-24">
        <PeriodHeader scale={scale} setScale={setScale} label={label} onPrev={prev} onNext={next} />
        <FilterChips
          accountIds={accountIds}
          setAccountIds={setAccountIds}
          categoryIds={categoryIds}
          setCategoryIds={setCategoryIds}
        />

        {isLoading ? (
          <View className="items-center py-8">
            <Spinner />
          </View>
        ) : (
          <>
            {/* Income / Expense / Net summary */}
            <View className="flex-row gap-3 px-4 py-2">
              <Card className="flex-1">
                <Text className="text-xs font-medium uppercase text-success">Доход</Text>
                <Text
                  className="mt-1 text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                  style={{ fontVariant: ['tabular-nums'] }}
                  numberOfLines={1}
                >
                  {formatCurrency(income, currency)}
                </Text>
              </Card>
              <Card className="flex-1">
                <Text className="text-xs font-medium uppercase text-danger">Расход</Text>
                <Text
                  className="mt-1 text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                  style={{ fontVariant: ['tabular-nums'] }}
                  numberOfLines={1}
                >
                  {formatCurrency(expense, currency)}
                </Text>
              </Card>
            </View>

            <View className="px-4 pb-2">
              <Card>
                <Text className="text-xs font-medium uppercase text-text-tertiary-light dark:text-text-tertiary-dark">
                  Чистый итог
                </Text>
                <Text
                  className={cn('mt-1 text-2xl font-bold', net >= 0 ? 'text-success' : 'text-danger')}
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {net >= 0 ? '+' : ''}
                  {formatCurrency(net, currency)}
                </Text>
              </Card>
            </View>

            {/* Donut chart of expense categories */}
            {slices.length > 0 && (
              <View className="my-4">
                <DonutChart slices={slices} total={donutTotal} />
              </View>
            )}

            {/* Daily bar chart + stats cards */}
            {dailyBuckets.length > 0 && (
              <View className="my-4 gap-2">
                <DailyExpenseChart data={dailyBuckets} />
                <DailyStatsCards data={dailyBuckets} currency={currency} />
              </View>
            )}

            {/* Top expense categories list */}
            <View className="gap-2 px-4 py-2">
              <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                Топ расходов
              </Text>
              {expenseCategories.length === 0 ? (
                <Text className="py-6 text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  Нет данных за выбранный период
                </Text>
              ) : (
                <View className="overflow-hidden rounded-xl border border-border-light bg-card-light dark:border-border-dark dark:bg-card-dark">
                  {expenseCategories.map((cat, index) => {
                    const isLast = index === expenseCategories.length - 1;
                    const amountInBase = cat.amount_by_currency[currency] ?? cat.amount;
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
                          <Icon name={cat.category_icon} size={18} color={cat.category_color} />
                        </View>
                        <View className="min-w-0 flex-1">
                          <Text
                            numberOfLines={1}
                            className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
                          >
                            {cat.category_name}
                          </Text>
                          <View className="mt-1 h-1 overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark">
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
                            {formatCurrency(amountInBase, currency)}
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
    </SafeAreaView>
  );
}

function formatLabel(scale: string, anchor: Date): string {
  if (scale === 'year') return String(anchor.getFullYear());
  if (scale === 'month')
    return anchor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  if (scale === 'week') return `Неделя ${getWeek(anchor)}`;
  return anchor.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getWeek(d: Date): number {
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7,
    )
  );
}
