import { Text, View } from 'react-native';

type Bucket = { date: string; expense: number };

type Props = { data: Bucket[]; currency: string };

export function DailyStatsCards({ data, currency }: Props) {
  if (data.length === 0) return null;
  const total = data.reduce((s, d) => s + d.expense, 0);
  const avg = Math.round(total / data.length);
  const peak = data.reduce((a, b) => (b.expense > a.expense ? b : a));
  return (
    <View className="flex-row gap-2 px-4">
      <Card label="В среднем / день" value={`${avg} ${currency}`} />
      <Card label="Пик" value={`${peak.expense} ${currency}`} sub={peak.date} />
    </View>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="flex-1 gap-1 rounded-2xl bg-surface-light p-3 dark:bg-surface-dark">
      <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">{label}</Text>
      <Text className="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{value}</Text>
      {sub ? <Text className="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">{sub}</Text> : null}
    </View>
  );
}
