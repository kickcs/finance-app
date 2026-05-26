import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useCreateCategory,
  useUpdateCategory,
} from '@/entities/category/api/useCategories';
import type { Category } from '@/entities/category/model/types';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { ENTITY_COLORS } from '@/shared/config/colors';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

type Props = {
  initial?: Category;
  type: 'expense' | 'income';
  onClose: () => void;
};

export function CategoryForm({ initial, type, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const createMutation = useCreateCategory(user?.id ?? null);
  const updateMutation = useUpdateCategory(user?.id ?? null);

  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<string>(initial?.color ?? (ENTITY_COLORS[0] as string));

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setColor(initial.color);
    }
  }, [initial]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const canSubmit = name.trim().length > 0 && !isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const payload = { name: name.trim(), color, type, icon: 'category' };
    if (initial) {
      await updateMutation.mutateAsync({ id: initial.id, input: payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    onClose();
  };

  return (
    <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top']} className="flex-1 bg-background-light dark:bg-background-dark">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            {initial ? 'Изменить категорию' : 'Новая категория'}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Закрыть">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        {/* Fields */}
        <View className="gap-4 px-4">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Название"
            accessibilityLabel="Название категории"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />

          <View>
            <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
              Цвет
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ENTITY_COLORS.map((c) => {
                const active = c === color;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`Цвет ${c}`}
                    accessibilityState={{ selected: active }}
                    className={cn('h-10 w-10 rounded-full', active && 'border-2 border-primary')}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {/* Submit */}
        <View className="mt-auto px-4 pb-4">
          <Button
            title={initial ? 'Сохранить' : 'Создать'}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isPending}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
