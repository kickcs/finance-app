import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccounts } from '@/entities/account/api/useAccounts';
import { useCategories } from '@/entities/category/api/useCategories';
import type { Category } from '@/entities/category/model/types';
import {
  useCreateQuickAction,
  useDeleteQuickAction,
  useQuickActions,
  useUpdateQuickAction,
} from '@/entities/quick-action/api/useQuickActions';
import type { QuickAction } from '@/entities/quick-action/model/types';
import type { QuickActionInput } from '@/entities/quick-action/api/quickActionsApi';
import type { Account } from '@/shared/api/database.types';
import { useAuthStore } from '@/shared/api/composables/useAuth';
import { Button, IconBadge } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';

const MAX_SLOTS = 4;

type Props = { visible: boolean; onClose: () => void };

export function QuickActionSheet({ visible, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const { data: actions = [] } = useQuickActions(userId);
  const [editingSlot, setEditingSlot] = useState<number | null>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-background-light dark:bg-background-dark"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Быстрые действия
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Готово"
          >
            <Text className="text-base text-primary">Готово</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4">
          {Array.from({ length: MAX_SLOTS }, (_, i) => i + 1).map((position) => {
            const existing = actions.find((a: QuickAction) => a.position === position);
            return (
              <Pressable
                key={position}
                onPress={() => setEditingSlot(position)}
                accessibilityRole="button"
                accessibilityLabel={`Слот ${position}`}
                className="mb-2 flex-row items-center gap-3 rounded-2xl bg-card-light p-3 dark:bg-card-dark"
              >
                <IconBadge icon={existing ? 'bolt' : 'add'} color="#4f46e5" />
                <View className="flex-1">
                  <Text className="text-sm text-text-secondary-light dark:text-text-secondary-dark">
                    Слот {position}
                  </Text>
                  <Text className="text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                    {existing?.label ?? 'Пустой'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {editingSlot !== null && (
        <SlotEditor
          slot={editingSlot}
          existing={actions.find((a: QuickAction) => a.position === editingSlot)}
          userId={userId}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </Modal>
  );
}

type SlotEditorProps = {
  slot: number;
  existing: QuickAction | undefined;
  userId: string | null;
  onClose: () => void;
};

function SlotEditor({ slot, existing, userId, onClose }: SlotEditorProps) {
  const { data: accounts = [] } = useAccounts(userId);
  const { data: categories = [] } = useCategories(userId);
  const create = useCreateQuickAction(userId);
  const update = useUpdateQuickAction(userId);
  const remove = useDeleteQuickAction(userId);

  const [label, setLabel] = useState<string>(existing?.label ?? '');
  const [accountId, setAccountId] = useState<string | null>(existing?.account_id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(existing?.category_id ?? null);

  const canSave = label.trim().length > 0 && accountId !== null && categoryId !== null;

  const save = async () => {
    if (!canSave) return;
    const payload: QuickActionInput = {
      label: label.trim(),
      account_id: accountId,
      category_id: categoryId,
      position: slot,
    };
    if (existing) {
      await update.mutateAsync({ id: existing.id, input: payload });
    } else {
      await create.mutateAsync(payload);
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!existing) {
      onClose();
      return;
    }
    await remove.mutateAsync(existing.id);
    onClose();
  };

  const expenseCategories = (categories as Category[]).filter(
    (c) => c.type === 'expense',
  );

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView
        edges={['top']}
        className="flex-1 bg-background-light dark:bg-background-dark"
      >
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark">
            Слот {slot}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Отмена">
            <Text className="text-base text-primary">Отмена</Text>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 12 }}>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Название"
            accessibilityLabel="Название"
            returnKeyType="done"
            className="rounded-2xl bg-surface-light px-4 py-3 text-base text-text-primary-light dark:bg-surface-dark dark:text-text-primary-dark"
          />

          <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Счёт
          </Text>
          {(accounts as Account[]).map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAccountId(a.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: accountId === a.id }}
              className={cn(
                'rounded-2xl p-3',
                accountId === a.id
                  ? 'bg-primary/10'
                  : 'bg-surface-light dark:bg-surface-dark',
              )}
            >
              <Text className="text-text-primary-light dark:text-text-primary-dark">
                {a.name}
              </Text>
            </Pressable>
          ))}

          <Text className="text-xs font-semibold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark">
            Категория
          </Text>
          {expenseCategories.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: categoryId === c.id }}
              className={cn(
                'rounded-2xl p-3',
                categoryId === c.id
                  ? 'bg-primary/10'
                  : 'bg-surface-light dark:bg-surface-dark',
              )}
            >
              <Text className="text-text-primary-light dark:text-text-primary-dark">
                {c.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View className="gap-2 px-4 pb-4">
          <Button
            title="Сохранить"
            onPress={save}
            disabled={!canSave}
            loading={create.isPending || update.isPending}
          />
          {existing !== undefined && (
            <Button
              title="Удалить слот"
              variant="danger"
              onPress={handleDelete}
              loading={remove.isPending}
            />
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
