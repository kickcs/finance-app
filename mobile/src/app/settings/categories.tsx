import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';

import {
  useCategories,
  useDeleteCategory,
} from '@/entities/category/api/useCategories';
import type { Category } from '@/entities/category/model/types';
import { CategoryForm } from '@/features/manage-categories/components/CategoryForm';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { EmptyState } from '@/shared/ui/empty-state';
import { Icon } from '@/shared/ui/icon';
import { IconBadge } from '@/shared/ui/icon-badge';
import { Spinner } from '@/shared/ui/spinner';
import { SwipeableRow } from '@/shared/ui/swipeable-row';
import { Tabs } from '@/shared/ui/tabs';

type TabId = 'expense' | 'income';

const TAB_ITEMS: { id: TabId; label: string }[] = [
  { id: 'expense', label: 'Расходы' },
  { id: 'income', label: 'Доходы' },
];

type RowProps = {
  item: Category;
  onEdit: () => void;
  onDelete: () => void;
};

function CategoryRow({ item, onEdit, onDelete }: RowProps) {
  const handleLongPress = () => {
    Alert.alert('Действие', item.name, [
      { text: 'Изменить', onPress: onEdit },
      { text: 'Удалить', style: 'destructive', onPress: onDelete },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  return (
    <SwipeableRow
      onDelete={onDelete}
      deleteLabel="Удалить"
    >
      <Pressable
        onPress={onEdit}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={item.name}
        className="flex-row items-center gap-3 rounded-2xl bg-card-light px-4 py-3 dark:bg-card-dark"
      >
        <IconBadge icon={item.icon} color={item.color} size="sm" />
        <Text className="flex-1 text-base font-medium text-text-primary-light dark:text-text-primary-dark">
          {item.name}
        </Text>
        <Icon name="chevron_right" size={16} color="#a1a1aa" />
      </Pressable>
    </SwipeableRow>
  );
}

export default function CategoriesScreen() {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useCategories(user?.id ?? null);
  const deleteMutation = useDeleteCategory(user?.id ?? null);

  const [tab, setTab] = useState<TabId>('expense');
  const [formVisible, setFormVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | undefined>();

  const filtered = (data ?? []).filter((c) => c.type === tab);

  const openCreate = () => {
    setEditTarget(undefined);
    setFormVisible(true);
  };

  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setFormVisible(true);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Удалить категорию?', 'Это действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Категории' }} />

      <View className="px-4 pt-4 pb-2">
        <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Spinner />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-2 px-4 pb-28"
          ListEmptyComponent={
            <EmptyState
              icon="category"
              title="Нет категорий"
              description="Добавьте первую категорию"
            />
          }
          renderItem={({ item }) => (
            <CategoryRow
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
        />
      )}

      {/* FAB */}
      <Pressable
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel="Добавить категорию"
        className="absolute bottom-8 right-6 h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg"
      >
        <Icon name="add" size={28} color="#fff" />
      </Pressable>

      {formVisible && (
        <CategoryForm
          initial={editTarget}
          type={tab}
          onClose={() => setFormVisible(false)}
        />
      )}
    </View>
  );
}
