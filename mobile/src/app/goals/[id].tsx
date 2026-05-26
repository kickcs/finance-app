import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, Text, View } from 'react-native';

import { trigger } from '@/shared/lib/haptics';
import { useDeleteGoal, useGoal } from '@/entities/goal';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

import { GoalForm } from '@/features/create-goal/GoalForm';

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: goal, isLoading } = useGoal(id ?? null);
  const deleteGoal = useDeleteGoal();

  if (isLoading || !goal) {
    return (
      <>
        <Stack.Screen options={{ title: 'Цель' }} />
        <View className="flex-1 items-center justify-center bg-background-light dark:bg-background-dark">
          <Spinner />
        </View>
      </>
    );
  }

  const currency = profile?.currency ?? 'USD';
  const progress =
    goal.target_amount > 0
      ? Math.min(100, Math.max(0, Math.round((goal.current_amount / goal.target_amount) * 100)))
      : 0;

  const handleDelete = () => {
    Alert.alert('Удалить цель?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await trigger('medium');
          await deleteGoal.mutateAsync(goal.id);
          await trigger('success');
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: goal.name }} />
      <ScrollView
        className="flex-1 bg-background-light dark:bg-background-dark"
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <View className="flex-row items-center gap-3">
            <View
              className="h-12 w-12 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${goal.color}1F` }}
            >
              <Icon name={goal.icon || 'savings'} size={24} color={goal.color} />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-medium uppercase tracking-wide text-text-tertiary-light dark:text-text-tertiary-dark">
                Прогресс · {progress}%
              </Text>
              <Text
                className="text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {formatCurrency(goal.current_amount, currency)} /{' '}
                {formatCurrency(goal.target_amount, currency)}
              </Text>
            </View>
          </View>
          <View className="mt-3 h-2 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
            <View
              className="h-full rounded-full"
              style={{ width: `${progress}%`, backgroundColor: goal.color }}
            />
          </View>
        </Card>

        <GoalForm
          editId={goal.id}
          initialValues={{
            name: goal.name,
            targetAmount: String(goal.target_amount),
            currentAmount: String(goal.current_amount),
            icon: goal.icon,
            color: goal.color,
          }}
        />

        <Button
          title="Удалить"
          variant="danger"
          onPress={handleDelete}
          loading={deleteGoal.isPending}
        />
      </ScrollView>
    </>
  );
}
