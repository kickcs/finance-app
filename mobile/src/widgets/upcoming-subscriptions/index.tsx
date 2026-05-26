import { Text, View } from 'react-native';
import { router, type Href } from 'expo-router';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useUpcomingSubscriptions } from '@/entities/recurring-subscription/api/useRecurringSubscriptions';
import type { RecurringSubscription } from '@/entities/recurring-subscription/model/types';
import { EmptyState, SectionHeader } from '@/shared/ui';

const SUBSCRIPTIONS_ROUTE = '/recurring-subscriptions' as Href;

function formatBillingDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function UpcomingSubscriptionsSection() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data: subs = [] } = useUpcomingSubscriptions(userId, 7);

  const upcoming = (subs as RecurringSubscription[]).slice(0, 3);

  return (
    <View>
      <SectionHeader
        title="Подписки"
        action={{
          label: 'Все',
          onPress: () => router.push(SUBSCRIPTIONS_ROUTE),
        }}
      />
      {upcoming.length === 0 ? (
        <EmptyState
          variant="inline"
          icon="subscriptions"
          title="Нет ближайших списаний"
        />
      ) : (
        <View className="gap-2 px-4">
          {upcoming.map((sub) => (
            <View
              key={sub.id}
              className="flex-row items-center justify-between rounded-2xl bg-card-light p-3 dark:bg-card-dark"
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: sub.color }}
                >
                  <Text className="text-base">{sub.icon}</Text>
                </View>
                <View>
                  <Text className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                    {sub.name}
                  </Text>
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {formatBillingDate(sub.billing_date)}
                  </Text>
                </View>
              </View>
              <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
                {sub.amount} {sub.currency}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
