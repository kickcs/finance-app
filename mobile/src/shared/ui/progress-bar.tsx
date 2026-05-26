import { View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type ProgressBarProps = {
  value: number; // 0–1
  variant?: 'default' | 'success' | 'warning' | 'danger';
};

const COLOR: Record<NonNullable<ProgressBarProps['variant']>, string> = {
  default: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({ value, variant = 'default' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View className="h-2 w-full overflow-hidden rounded-full bg-surface-light dark:bg-surface-dark" accessibilityRole="progressbar" accessibilityValue={{ now: Math.round(pct * 100), min: 0, max: 100 }}>
      <View className={cn('h-full', COLOR[variant])} style={{ width: `${pct * 100}%` }} />
    </View>
  );
}
