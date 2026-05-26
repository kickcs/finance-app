import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

import { useAuthStore } from '@/shared/api/composables/useAuth';
import { usePeople, useDeletePerson } from '@/entities/person/api/usePeople';
import type { Person } from '@/entities/person/model/types';
import { Button, EmptyState, InitialAvatar, SwipeableRow } from '@/shared/ui';
import { confirmDelete } from '@/shared/lib/confirm-delete';
import { PersonForm } from '@/features/manage-people/components/PersonForm';

export default function PeopleScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: people = [], isLoading } = usePeople(user?.id ?? null);
  const deleteMutation = useDeletePerson(user?.id ?? null);
  const [formState, setFormState] = useState<
    { mode: 'create' } | { mode: 'edit'; person: Person } | null
  >(null);

  const handleDelete = async (person: Person) => {
    const ok = await confirmDelete({
      title: `Удалить ${person.name}?`,
      message: 'Это действие нельзя отменить.',
    });
    if (ok) deleteMutation.mutate(person.id);
  };

  return (
    <View className="flex-1 bg-background-light dark:bg-background-dark">
      <Stack.Screen options={{ title: 'Люди' }} />
      <FlatList
        data={people}
        keyExtractor={(p) => p.id}
        contentContainerClassName="pb-2"
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              icon="account_circle"
              title="Пока никого нет"
              description="Добавьте людей для совместных расходов и долгов."
            />
          )
        }
        renderItem={({ item }) => (
          <SwipeableRow onDelete={() => handleDelete(item)}>
            <Pressable
              onPress={() => setFormState({ mode: 'edit', person: item })}
              accessibilityRole="button"
              accessibilityLabel={`Изменить ${item.name}`}
              className="flex-row items-center gap-3 bg-surface-light px-4 py-3 dark:bg-surface-dark"
            >
              <InitialAvatar name={item.name} color={item.color} />
              <Text className="flex-1 text-base font-medium text-text-primary-light dark:text-text-primary-dark">
                {item.name}
              </Text>
            </Pressable>
          </SwipeableRow>
        )}
      />
      <SafeAreaView edges={['bottom']} className="px-4 pt-2">
        <Button
          title="Добавить человека"
          onPress={() => setFormState({ mode: 'create' })}
        />
      </SafeAreaView>
      {formState !== null && (
        <PersonForm
          initial={formState.mode === 'edit' ? formState.person : undefined}
          onClose={() => setFormState(null)}
        />
      )}
    </View>
  );
}
