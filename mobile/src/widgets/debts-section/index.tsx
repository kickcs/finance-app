import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useDebts } from '@/entities/debt/api/useDebts';
import type { Debt } from '@/shared/api/database.types';
import { Badge, EmptyState, InitialAvatar, SectionHeader } from '@/shared/ui';

export function DebtsSection() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { data: debts = [] } = useDebts(userId);

  const open = (debts as Debt[])
    .filter((d) => !d.is_closed)
    .sort((a, b) => b.remaining_amount - a.remaining_amount)
    .slice(0, 3);

  return (
    <View>
      <SectionHeader
        title="Долги"
        action={{ label: 'Все', onPress: () => router.push('/debts') }}
      />
      {open.length === 0 ? (
        <EmptyState variant="inline" icon="payments" title="Нет открытых долгов" />
      ) : (
        <View className="gap-2 px-4">
          {open.map((d) => (
            <Pressable
              key={d.id}
              onPress={() => router.push(`/debts/${d.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`Долг ${d.person_name ?? d.name}`}
              className="flex-row items-center gap-3 rounded-2xl bg-card-light p-3 dark:bg-card-dark"
            >
              <InitialAvatar
                name={d.person_name ?? d.name}
                size="sm"
              />
              <View className="flex-1">
                <Text className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                  {d.person_name ?? d.name}
                </Text>
                <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                  {d.remaining_amount} {d.currency}
                </Text>
              </View>
              <Badge
                label={d.debt_type === 'given' ? 'Должны' : 'Вы должны'}
                variant={d.debt_type === 'given' ? 'success' : 'warning'}
              />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
