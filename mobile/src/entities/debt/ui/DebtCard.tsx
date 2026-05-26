import { Pressable, Text, View } from 'react-native';

import { COMPACT_FORMAT, formatCurrency } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';

import { getDebtDisplayName, getDebtProgress } from '../model/types';
import type { Debt } from '../model/types';

interface Props {
  debt: Debt;
  onPress?: () => void;
}

export function DebtCard({ debt, onPress }: Props) {
  const isGiven = debt.debt_type === 'given';
  const color = isGiven ? '#f59e0b' : '#a855f7';
  const progress = getDebtProgress(debt);
  const remaining = debt.remaining_amount;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-3 active:opacity-80"
    >
      <View
        className="h-10 w-10 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}1F` }}
      >
        <Icon name={isGiven ? 'arrow_forward' : 'arrow_forward'} size={20} color={color} />
      </View>

      <View className="flex-1 min-w-0">
        <Text
          numberOfLines={1}
          className="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          {getDebtDisplayName(debt)}
        </Text>
        <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {isGiven ? 'Вам должны' : 'Вы должны'} · {progress}% погашено
        </Text>
      </View>

      <View className="items-end">
        <Text
          className={cn(
            'text-sm font-semibold',
            isGiven ? 'text-warning' : 'text-debt-received',
          )}
          style={{ fontVariant: ['tabular-nums'], color }}
        >
          {formatCurrency(remaining, debt.currency, COMPACT_FORMAT)}
        </Text>
        {debt.is_closed ? (
          <Text className="text-[10px] font-medium text-text-tertiary-light dark:text-text-tertiary-dark">
            Закрыт
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
