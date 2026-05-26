import { Text, View } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger';
export type BadgeProps = { label: string; variant?: BadgeVariant };

const STYLES: Record<BadgeVariant, string> = {
  default: 'bg-surface-light dark:bg-surface-dark',
  success: 'bg-success-light',
  warning: 'bg-warning-light',
  danger: 'bg-danger-light',
};

const TEXT: Record<BadgeVariant, string> = {
  default: 'text-text-primary-light dark:text-text-primary-dark',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function Badge({ label, variant = 'default' }: BadgeProps) {
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', STYLES[variant])}>
      <Text className={cn('text-xs font-medium', TEXT[variant])}>{label}</Text>
    </View>
  );
}
