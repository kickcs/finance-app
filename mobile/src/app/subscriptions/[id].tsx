import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router';

import {
  useDeleteRecurringSubscription,
  useRecurringSubscription,
} from '@/entities/recurring-subscription/api/useRecurringSubscriptions';
import { FREQUENCY_LABELS } from '@/entities/recurring-subscription/model/constants';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Spinner } from '@/shared/ui/spinner';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {label}
      </Text>
      <Text className="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {value}
      </Text>
    </View>
  );
}

export default function SubscriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: sub, isLoading } = useRecurringSubscription(id ?? null);
  const deleteMutation = useDeleteRecurringSubscription();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Stack.Screen options={{ title: 'Подписка' }} />
        <Spinner />
      </View>
    );
  }

  if (!sub) {
    return (
      <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
        <Stack.Screen options={{ title: 'Подписка' }} />
        <Text className="text-text-secondary-light dark:text-text-secondary-dark">
          Подписка не найдена
        </Text>
      </View>
    );
  }

  const handleDelete = () => {
    Alert.alert('Удалить подписку?', sub.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteMutation.mutateAsync(sub.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: sub.name }} />

      <View className="gap-4 p-4">
        {/* Icon + name */}
        <View className="items-center gap-3 py-4">
          <View
            className="h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: sub.color }}
          >
            <Text className="text-3xl">💳</Text>
          </View>
          <Text className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
            {sub.name}
          </Text>
          <Text className="text-xl font-semibold text-primary">
            {sub.amount.toLocaleString()} {sub.currency}
          </Text>
        </View>

        <Card>
          <DetailRow
            label="Периодичность"
            value={FREQUENCY_LABELS[sub.frequency] ?? sub.frequency}
          />
          <View className="h-px bg-border-light dark:bg-border-dark" />
          <DetailRow label="Следующее списание" value={sub.billing_date} />
          <View className="h-px bg-border-light dark:bg-border-dark" />
          <DetailRow label="Статус" value={sub.status === 'active' ? 'Активна' : 'Пауза'} />
          {sub.description ? (
            <>
              <View className="h-px bg-border-light dark:bg-border-dark" />
              <DetailRow label="Описание" value={sub.description} />
            </>
          ) : null}
        </Card>

        <Button
          title="Изменить"
          onPress={() =>
            router.push({ pathname: '/subscriptions/[id]/edit', params: { id: sub.id } })
          }
        />
        <Button
          title="Удалить"
          variant="danger"
          onPress={handleDelete}
          loading={deleteMutation.isPending}
        />
      </View>
    </ScrollView>
  );
}
