import { Text, View } from 'react-native';

import { useMonthlyStats } from '@/entities/transaction/api';
import { useUser } from '@/shared/api/composables/useAuth';
import { useProfile } from '@/shared/api/composables/useProfile';
import { COMPACT_FORMAT, formatMasked } from '@/shared/lib/format/currency';
import { Card } from '@/shared/ui/card';
import { Icon } from '@/shared/ui/icon';
import { Spinner } from '@/shared/ui/spinner';

interface Props {
  hidden?: boolean;
}

export function SaveSpendSection({ hidden }: Props) {
  const user = useUser();
  const { data: profile } = useProfile(user?.id ?? null);
  const { data: stats, isLoading } = useMonthlyStats(user?.id ?? null);

  const currency = profile?.currency ?? 'USD';

  if (isLoading) {
    return (
      <View className="items-center justify-center py-4">
        <Spinner />
      </View>
    );
  }

  const earned = stats?.income_by_currency?.[currency] ?? stats?.total_income ?? 0;
  const spent = stats?.expense_by_currency?.[currency] ?? stats?.total_expense ?? 0;

  return (
    <View className="flex-row gap-3">
      <StatCard
        label="Заработано"
        amount={earned}
        currency={currency}
        hidden={hidden}
        color="#10b981"
        icon="add"
      />
      <StatCard
        label="Потрачено"
        amount={spent}
        currency={currency}
        hidden={hidden}
        color="#ef4444"
        icon="close"
      />
    </View>
  );
}

interface StatCardProps {
  label: string;
  amount: number;
  currency: string;
  color: string;
  icon: string;
  hidden?: boolean;
}

function StatCard({ label, amount, currency, color, icon, hidden }: StatCardProps) {
  return (
    <Card className="flex-1">
      <View className="flex-row items-center gap-1.5">
        <View
          className="h-6 w-6 items-center justify-center rounded-md"
          style={{ backgroundColor: `${color}1F` }}
        >
          <Icon name={icon} size={14} color={color} />
        </View>
        <Text className="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          {label}
        </Text>
      </View>
      <Text
        className="mt-2 text-xl font-bold text-text-primary-light dark:text-text-primary-dark"
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
      >
        {formatMasked(amount, currency, hidden ?? false, COMPACT_FORMAT)}
      </Text>
    </Card>
  );
}
