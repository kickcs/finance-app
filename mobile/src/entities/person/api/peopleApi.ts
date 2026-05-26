import { http } from '@/shared/api/http';
import type { Person } from '../model/types';

export type PersonInput = { name: string; color: string };

export const peopleApi = {
  list: () => http<Person[]>('/api/people'),
  create: (input: PersonInput) =>
    http<Person>('/api/people', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<PersonInput>) =>
    http<Person>(`/api/people/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) =>
    http<void>(`/api/people/${id}`, { method: 'DELETE' }),
};
