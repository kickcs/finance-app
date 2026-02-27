import { Person } from '../../../domain/aggregates/person';
import { PersonOrmEntity } from '../typeorm/person.orm-entity';

export class PersonMapper {
  static toDomain(ormEntity: PersonOrmEntity): Person {
    return Person.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      color: ormEntity.color,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(person: Person): PersonOrmEntity {
    const ormEntity = new PersonOrmEntity();
    ormEntity.id = person.id;
    ormEntity.userId = person.userId;
    ormEntity.name = person.name;
    ormEntity.color = person.color;
    ormEntity.createdAt = person.createdAt;
    ormEntity.updatedAt = person.updatedAt;
    return ormEntity;
  }
}
