import { Pressable, ScrollView, Text } from 'react-native';
import { cn } from '@/shared/lib/utils';

export type SelectChipsItem<T extends string> = { id: T; label: string };

export type SelectChipsProps<T extends string> = {
  items: SelectChipsItem<T>[];
  value: T | null;
  onChange: (id: T | null) => void;
  allowDeselect?: boolean;
};

export function SelectChips<T extends string>({ items, value, onChange, allowDeselect = true }: SelectChipsProps<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="flex-row gap-2 px-4">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(active && allowDeselect ? null : item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            className={cn('rounded-full border px-4 py-2', active ? 'border-primary bg-primary' : 'border-border-light dark:border-border-dark')}
          >
            <Text className={cn('text-sm font-medium', active ? 'text-white' : 'text-text-primary-light dark:text-text-primary-dark')}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
