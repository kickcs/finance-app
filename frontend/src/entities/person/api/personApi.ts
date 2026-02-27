import { http } from '@/shared/api/http';
import type { Person, PersonInsert } from '../model/types';

// Response type from NestJS backend (camelCase)
interface PersonResponse {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

function transformPerson(person: PersonResponse): Person {
  return {
    id: person.id,
    user_id: person.userId,
    name: person.name,
    color: person.color,
    created_at: person.createdAt,
    updated_at: person.updatedAt,
  };
}

export const personApi = {
  async getAll(): Promise<Person[]> {
    // Backend gets userId from JWT token
    const data = await http.get<PersonResponse[]>('/people');
    return data.map(transformPerson);
  },

  async create(person: PersonInsert): Promise<Person> {
    const data = await http.post<PersonResponse>('/people', {
      name: person.name,
      color: person.color,
    });
    return transformPerson(data);
  },

  async update(id: string, updates: Partial<Pick<Person, 'name' | 'color'>>): Promise<Person> {
    const data = await http.patch<PersonResponse>(`/people/${id}`, {
      name: updates.name,
      color: updates.color,
    });
    return transformPerson(data);
  },

  async delete(id: string): Promise<void> {
    await http.delete(`/people/${id}`);
  },
};
