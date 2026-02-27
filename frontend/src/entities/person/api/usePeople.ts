import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query';
import { personQueryKeys } from './queryKeys';
import { personApi } from './personApi';
import type { Person, PersonInsert } from '../model/types';

export function usePeople(userId: MaybeRefOrGetter<string | null>) {
  const queryClient = useQueryClient();

  const queryKey = computed(() => {
    const uid = toValue(userId);
    return uid ? personQueryKeys.list(uid) : personQueryKeys.all;
  });

  // Main query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKey,
    queryFn: () => {
      const uid = toValue(userId);
      if (!uid) return [];
      return personApi.getAll();
    },
    enabled: computed(() => !!toValue(userId)),
  });

  const people = computed(() => data.value ?? []);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (person: PersonInsert) => {
      const uid = toValue(userId);
      if (!uid) throw new Error('User not authenticated');
      return personApi.create(person);
    },
    onMutate: async (newPerson) => {
      const uid = toValue(userId);
      if (!uid) return;

      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousPeople = queryClient.getQueryData<Person[]>(queryKey.value);

      const optimisticPerson: Person = {
        id: `temp-${Date.now()}`,
        user_id: uid,
        name: newPerson.name,
        color: newPerson.color ?? '#3b82f6',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Person[]>(queryKey.value, (old) =>
        [...(old ?? []), optimisticPerson].sort((a, b) => a.name.localeCompare(b.name)),
      );

      return { previousPeople };
    },
    onError: (_err, _newPerson, context) => {
      if (context?.previousPeople) {
        queryClient.setQueryData(queryKey.value, context.previousPeople);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Pick<Person, 'name' | 'color'>>;
    }) => personApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousPeople = queryClient.getQueryData<Person[]>(queryKey.value);

      queryClient.setQueryData<Person[]>(
        queryKey.value,
        (old) => old?.map((p) => (p.id === id ? { ...p, ...updates } : p)) ?? [],
      );

      return { previousPeople };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousPeople) {
        queryClient.setQueryData(queryKey.value, context.previousPeople);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => personApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKey.value });
      const previousPeople = queryClient.getQueryData<Person[]>(queryKey.value);

      queryClient.setQueryData<Person[]>(
        queryKey.value,
        (old) => old?.filter((p) => p.id !== id) ?? [],
      );

      return { previousPeople };
    },
    onError: (_err, _id, context) => {
      if (context?.previousPeople) {
        queryClient.setQueryData(queryKey.value, context.previousPeople);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKey.value });
    },
  });

  // Helper functions
  async function createPerson(person: PersonInsert) {
    return createMutation.mutateAsync(person);
  }

  async function updatePerson(id: string, updates: Partial<Pick<Person, 'name' | 'color'>>) {
    return updateMutation.mutateAsync({ id, updates });
  }

  async function deletePerson(id: string) {
    return deleteMutation.mutateAsync(id);
  }

  return {
    people,
    isLoading,
    error,
    createPerson,
    updatePerson,
    deletePerson,
    refetch,
  };
}
