import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';

import {
  useDeleteRecurringSubscription,
  useRecurringSubscriptions,
} from '@/entities/recurring-subscription/api/useRecurringSubscriptions';
import type { RecurringSubscription } from '@/entities/recurring-subscription/model/types';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function billingBadgeLabel(days: number): string {
  if (days < 0) return 'Просрочено';
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Завтра';
  return `через ${days} дн.`;
}

function billingBadgeVariant(days: number): 'danger' | 'warning' | 'default' {
  if (days < 0) return 'danger';
  if (days <= 3) return 'warning';
  return 'default';
}

type RowProps = {
  item: RecurringSubscription;
  onPress: () => void;
  onDelete: () => void;
};

function SubscriptionRow({ item, onPress, onDelete }: RowProps) {
  const days = daysUntil(item.billing_date);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={() => {
        Alert.alert('Удалить подписку?', item.name, [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Удалить', style: 'destructive', onPress: onDelete },
        ]);
      }}
      accessibilityRole="button"
      accessibilityLabel={item.name}
    >
      <Card className="flex-row items-center gap-3">
        <View
          className="h-10 w-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: item.color }}
        >
          <Icon name="subscriptions" size={20} color="#fff" />
        </View>
        <View className="flex-1">
          <Text
            className="text-base font-medium text-text-primary-light dark:text-text-primary-dark"
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            {item.amount.toLocaleString()} {item.currency}
          </Text>
        </View>
        <Badge label={billingBadgeLabel(days)} variant={billingBadgeVariant(days)} />
        <Icon name="chevron_right" size={16} color="#a1a1aa" />
      </Card>
    </Pressable>
  );
}

export default function SubscriptionsScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { data, isLoading } = useRecurringSubscriptions(user?.id ?? null);
  const deleteMutation = useDeleteRecurringSubscription();
  const [showForm, setShowForm] = useState(false);

  const sorted = [...(data ?? [])].sort(
    (a, b) => new Date(a.billing_date).getTime() - new Date(b.billing_date).getTime(),
  );

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Подписки' }} />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 p-4 pb-28"
          ListEmptyComponent={
            <EmptyState
              icon="subscriptions"
              title="Нет подписок"
              description="Добавьте первую подписку"
            />
          }
          renderItem={({ item }) => (
            <SubscriptionRow
              item={item}
              onPress={() =>
                router.push({ pathname: '/subscriptions/[id]', params: { id: item.id } })
              }
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={() => router.push({ pathname: '/subscriptions/new' })}
        accessibilityRole="button"
        accessibilityLabel="Добавить подписку"
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Icon name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}
