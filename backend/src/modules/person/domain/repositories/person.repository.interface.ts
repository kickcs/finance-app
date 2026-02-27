import type { Person } from '../aggregates/person';

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');

export interface IPersonRepository {
  findById(id: string): Promise<Person | null>;
  findByUserId(userId: string): Promise<Person[]>;
  save(person: Person): Promise<Person>;
  delete(id: string): Promise<void>;
}
