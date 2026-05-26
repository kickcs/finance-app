import { Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useGoals } from '@/entities/goal/api/useGoals';
import type { Goal } from '@/shared/api/database.types';
import { EmptyState, ProgressBar, SectionHeader } from '@/shared/ui';

export function GoalsSection() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data: goals = [] } = useGoals(userId);

  const active = (goals as Goal[])
    .filter((g) => g.current_amount < g.target_amount)
    .slice(0, 3);

  return (
    <View>
      <SectionHeader
        title="Цели"
        action={{ label: 'Все', onPress: () => router.push('/goals') }}
      />
      {active.length === 0 ? (
        <EmptyState variant="inline" icon="savings" title="Нет активных целей" />
      ) : (
        <View className="gap-3 px-4">
          {active.map((g) => {
            const progress = g.target_amount > 0 ? g.current_amount / g.target_amount : 0;
            const pct = Math.round(progress * 100);
            return (
              <View
                key={g.id}
                className="gap-2 rounded-2xl bg-card-light p-3 dark:bg-card-dark"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                    {g.name}
                  </Text>
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    {pct}%
                  </Text>
                </View>
                <ProgressBar value={progress} />
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    {g.current_amount}
                  </Text>
                  <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    из {g.target_amount}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
