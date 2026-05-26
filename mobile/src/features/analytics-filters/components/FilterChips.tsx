import { Pressable, ScrollView, Text } from 'react-native';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { useAccounts } from '@/entities/account/api/useAccounts';
import { useCategories } from '@/entities/category/api/useCategories';
import { cn } from '@/shared/lib/utils';
import type { Account } from '@/shared/api/database.types';
import type { Category } from '@/entities/category/model/types';

type Props = {
  accountIds: string[] | null;
  setAccountIds: (next: string[] | null) => void;
  categoryIds: string[] | null;
  setCategoryIds: (next: string[] | null) => void;
};

export function FilterChips({ accountIds, setAccountIds, categoryIds, setCategoryIds }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: accounts = [] } = useAccounts(user?.id ?? null);
  const { data: categories = [] } = useCategories(user?.id ?? null);

  return (
    <>
      <ChipRow
        items={(accounts as Account[]).map((a) => ({ id: a.id, label: a.name }))}
        selected={accountIds}
        onChange={setAccountIds}
        emptyLabel="Все счета"
      />
      <ChipRow
        items={(categories as Category[]).map((c) => ({ id: c.id, label: c.name }))}
        selected={categoryIds}
        onChange={setCategoryIds}
        emptyLabel="Все категории"
      />
    </>
  );
}

type ChipItem = { id: string; label: string };

function ChipRow({
  items,
  selected,
  onChange,
  emptyLabel,
}: {
  items: ChipItem[];
  selected: string[] | null;
  onChange: (next: string[] | null) => void;
  emptyLabel: string;
}) {
  const isAll = selected === null;

  const toggle = (id: string) => {
    if (isAll) {
      onChange([id]);
    } else if (selected.includes(id)) {
      const next = selected.filter((x) => x !== id);
      onChange(next.length === 0 ? null : next);
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row gap-2 px-4 py-2"
    >
      <Pressable
        onPress={() => onChange(null)}
        accessibilityRole="button"
        accessibilityState={{ selected: isAll }}
        accessibilityLabel={emptyLabel}
        className={cn(
          'rounded-full border px-4 py-2',
          isAll ? 'border-primary bg-primary' : 'border-border-light dark:border-border-dark',
        )}
      >
        <Text
          className={cn(
            'text-sm font-medium',
            isAll
              ? 'text-white'
              : 'text-text-primary-light dark:text-text-primary-dark',
          )}
        >
          {emptyLabel}
        </Text>
      </Pressable>
      {items.map((item) => {
        const active = !isAll && selected.includes(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => toggle(item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            className={cn(
              'rounded-full border px-4 py-2',
              active ? 'border-primary bg-primary' : 'border-border-light dark:border-border-dark',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                active
                  ? 'text-white'
                  : 'text-text-primary-light dark:text-text-primary-dark',
              )}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
