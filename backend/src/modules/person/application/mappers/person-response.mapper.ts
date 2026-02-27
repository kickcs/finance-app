import type { Person } from '../../domain/aggregates/person';

export class PersonResponseMapper {
  static toResponse(person: Person) {
    return {
      id: person.id,
      userId: person.userId,
      name: person.name,
      color: person.color,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }

  static toResponseList(people: Person[]) {
    return people.map((person) => PersonResponseMapper.toResponse(person));
  }
}
