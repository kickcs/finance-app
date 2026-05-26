import { Pressable, Text, View } from 'react-native';

import type { Goal } from '@/shared/api/database.types';
import { formatCurrency } from '@/shared/lib/format/currency';
import { Icon } from '@/shared/ui/icon';

interface Props {
  goal: Goal;
  currency?: string;
  onPress?: () => void;
}

export function GoalCard({ goal, currency, onPress }: Props) {
  const baseCurrency = currency ?? 'USD';
  const progress =
    goal.target_amount > 0
      ? Math.min(100, Math.max(0, Math.round((goal.current_amount / goal.target_amount) * 100)))
      : 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-3 active:opacity-80"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${goal.color}1F` }}
      >
        <Icon name={goal.icon || 'savings'} size={20} color={goal.color} />
      </View>

      <View className="flex-1 min-w-0">
        <Text
          numberOfLines={1}
          className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          {goal.name}
        </Text>
        <View className="mt-1 h-1.5 rounded-full bg-surface-light dark:bg-surface-dark overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{ width: `${progress}%`, backgroundColor: goal.color }}
          />
        </View>
        <Text className="mt-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {formatCurrency(goal.current_amount, baseCurrency)} /{' '}
          {formatCurrency(goal.target_amount, baseCurrency)}
        </Text>
      </View>
    </Pressable>
  );
}
