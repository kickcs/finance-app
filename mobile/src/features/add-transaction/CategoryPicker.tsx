import { Pressable, Text, View } from 'react-native';

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type Category } from '@/entities/category';
import { cn } from '@/shared/lib/utils';
import { Icon } from '@/shared/ui/icon';

interface Props {
  type: 'income' | 'expense';
  value: string | null;
  onChange: (id: string) => void;
}

export function CategoryPicker({ type, value, onChange }: Props) {
  const items: Category[] = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <View className="flex-row flex-wrap gap-3">
      {items.map((cat) => {
        const selected = value === cat.id;
        return (
          <Pressable
            key={cat.id}
            onPress={() => onChange(cat.id)}
            accessibilityRole="button"
            accessibilityLabel={cat.name}
            accessibilityState={{ selected }}
            className={cn(
              'aspect-square items-center justify-center rounded-2xl',
              selected
                ? 'bg-primary'
                : 'bg-surface-light dark:bg-surface-dark',
            )}
            style={{ width: '22%' }}
          >
            <Icon name={cat.icon} size={24} color={selected ? '#ffffff' : cat.color} />
            <Text
              numberOfLines={1}
              className={cn(
                'mt-1 text-[10px] font-medium',
                selected
                  ? 'text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark',
              )}
            >
              {cat.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
