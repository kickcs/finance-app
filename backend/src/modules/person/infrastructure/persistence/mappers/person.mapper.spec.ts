import { PersonMapper } from './person.mapper';
import { PersonOrmEntity } from '../typeorm/person.orm-entity';
import { Person } from '../../../domain/aggregates/person';

describe('PersonMapper', () => {
  describe('toDomain', () => {
    it('should map an ORM entity to a domain aggregate', () => {
      const orm = new PersonOrmEntity();
      orm.id = 'p-1';
      orm.userId = 'user-1';
      orm.name = 'John';
      orm.color = '#FF0000';
      orm.createdAt = new Date('2024-01-01');
      orm.updatedAt = new Date('2024-06-01');

      const domain = PersonMapper.toDomain(orm);

      expect(domain.id).toBe('p-1');
      expect(domain.userId).toBe('user-1');
      expect(domain.name).toBe('John');
      expect(domain.color).toBe('#FF0000');
      expect(domain.createdAt).toEqual(new Date('2024-01-01'));
      expect(domain.updatedAt).toEqual(new Date('2024-06-01'));
    });
  });

  describe('toOrm', () => {
    it('should map a domain aggregate to an ORM entity', () => {
      const person = Person.reconstitute({
        id: 'p-1',
        userId: 'user-1',
        name: 'Jane',
        color: '#00FF00',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-06-01'),
      });

      const orm = PersonMapper.toOrm(person);

      expect(orm).toBeInstanceOf(PersonOrmEntity);
      expect(orm.id).toBe('p-1');
      expect(orm.userId).toBe('user-1');
      expect(orm.name).toBe('Jane');
      expect(orm.color).toBe('#00FF00');
      expect(orm.createdAt).toEqual(new Date('2024-01-01'));
      expect(orm.updatedAt).toEqual(new Date('2024-06-01'));
    });
  });

  describe('roundtrip', () => {
    it('should preserve data through toDomain -> toOrm', () => {
      const orm = new PersonOrmEntity();
      orm.id = 'p-1';
      orm.userId = 'user-1';
      orm.name = 'Test';
      orm.color = '#AABBCC';
      orm.createdAt = new Date('2024-03-15');
      orm.updatedAt = new Date('2024-07-20');

      const domain = PersonMapper.toDomain(orm);
      const roundtripped = PersonMapper.toOrm(domain);

      expect(roundtripped.id).toBe(orm.id);
      expect(roundtripped.userId).toBe(orm.userId);
      expect(roundtripped.name).toBe(orm.name);
      expect(roundtripped.color).toBe(orm.color);
      expect(roundtripped.createdAt).toEqual(orm.createdAt);
      expect(roundtripped.updatedAt).toEqual(orm.updatedAt);
    });
  });
});
