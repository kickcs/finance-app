import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { peopleApi, type PersonInput } from './peopleApi';
import { personKeys } from './queryKeys';

export function usePeople(userId: string | null) {
  return useQuery({
    queryKey: personKeys.list(userId ?? '__disabled__'),
    queryFn: () => peopleApi.list(),
    enabled: !!userId,
  });
}

export function useCreatePerson(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PersonInput) => peopleApi.create(input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: personKeys.list(userId) });
    },
  });
}

export function useUpdatePerson(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PersonInput> }) =>
      peopleApi.update(id, input),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: personKeys.list(userId) });
    },
  });
}

export function useDeletePerson(userId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => peopleApi.remove(id),
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: personKeys.list(userId) });
    },
  });
}
