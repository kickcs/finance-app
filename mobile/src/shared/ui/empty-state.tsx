import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Icon } from './icon';

export type EmptyStateProps = {
  icon?: string;
  iconColor?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'inline';
};

export function EmptyState({ icon = 'inbox', iconColor, title, description, action, variant = 'default' }: EmptyStateProps) {
  return (
    <View className={variant === 'inline' ? 'items-center gap-2 py-6' : 'flex-1 items-center justify-center gap-3 px-8 py-16'}>
      <Icon name={icon} size={variant === 'inline' ? 28 : 48} color={iconColor ?? '#a1a1aa'} />
      <Text className="text-center text-base font-semibold text-text-primary-light dark:text-text-primary-dark">{title}</Text>
      {description ? (
        <Text className="text-center text-sm text-text-secondary-light dark:text-text-secondary-dark">{description}</Text>
      ) : null}
      {action ? <View className="mt-2">{action}</View> : null}
    </View>
  );
}
