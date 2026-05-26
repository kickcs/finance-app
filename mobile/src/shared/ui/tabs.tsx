import { Pressable, View, Text } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type TabsItem<T extends string> = { id: T; label: string };

export type TabsProps<T extends string> = {
  items: TabsItem<T>[];
  value: T;
  onChange: (id: T) => void;
  variant?: 'pills' | 'underline';
};

export function Tabs<T extends string>({ items, value, onChange, variant = 'pills' }: TabsProps<T>) {
  return (
    <View className={cn('flex-row', variant === 'pills' ? 'gap-2 rounded-full bg-surface-light p-1 dark:bg-surface-dark' : 'border-b border-border-light dark:border-border-dark')}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            className={cn(
              'flex-1 items-center',
              variant === 'pills' ? cn('rounded-full px-4 py-2', active && 'bg-card-light dark:bg-card-dark') : cn('px-4 py-3', active && 'border-b-2 border-primary'),
            )}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-primary' : 'text-text-secondary-light dark:text-text-secondary-dark')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
