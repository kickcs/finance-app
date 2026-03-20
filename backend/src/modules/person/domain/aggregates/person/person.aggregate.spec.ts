import { Person } from './person.aggregate';

describe('Person Aggregate', () => {
  describe('create', () => {
    it('should create a person with correct properties', () => {
      const person = Person.create('p-1', 'user-1', 'John Doe', '#FF0000');

      expect(person.id).toBe('p-1');
      expect(person.userId).toBe('user-1');
      expect(person.name).toBe('John Doe');
      expect(person.color).toBe('#FF0000');
      expect(person.createdAt).toBeInstanceOf(Date);
      expect(person.updatedAt).toBeInstanceOf(Date);
    });

    it('should trim the name', () => {
      const person = Person.create('p-1', 'user-1', '  John Doe  ', '#FF0000');

      expect(person.name).toBe('John Doe');
    });

    it('should set createdAt and updatedAt to the same timestamp', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');

      expect(person.createdAt.getTime()).toBe(person.updatedAt.getTime());
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from props', () => {
      const createdAt = new Date('2024-01-01');
      const updatedAt = new Date('2024-06-01');

      const person = Person.reconstitute({
        id: 'p-1',
        userId: 'user-1',
        name: 'Jane',
        color: '#00FF00',
        createdAt,
        updatedAt,
      });

      expect(person.id).toBe('p-1');
      expect(person.userId).toBe('user-1');
      expect(person.name).toBe('Jane');
      expect(person.color).toBe('#00FF00');
      expect(person.createdAt).toBe(createdAt);
      expect(person.updatedAt).toBe(updatedAt);
    });
  });

  describe('update', () => {
    it('should update the name', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');
      const originalUpdatedAt = person.updatedAt;

      // Small delay to ensure timestamps differ
      person.update({ name: 'Jane' });

      expect(person.name).toBe('Jane');
      expect(person.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });

    it('should trim the updated name', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');

      person.update({ name: '  Updated Name  ' });

      expect(person.name).toBe('Updated Name');
    });

    it('should update the color', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');

      person.update({ color: '#FFFFFF' });

      expect(person.color).toBe('#FFFFFF');
    });

    it('should update both name and color', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');

      person.update({ name: 'Jane', color: '#FFF' });

      expect(person.name).toBe('Jane');
      expect(person.color).toBe('#FFF');
    });

    it('should not change name when only color is updated', () => {
      const person = Person.create('p-1', 'user-1', 'John', '#000');

      person.update({ color: '#FFF' });

      expect(person.name).toBe('John');
    });

    it('should update updatedAt timestamp', () => {
      const oldDate = new Date('2020-01-01');
      const person = Person.reconstitute({
        id: 'p-1',
        userId: 'user-1',
        name: 'John',
        color: '#000',
        createdAt: oldDate,
        updatedAt: oldDate,
      });

      person.update({ name: 'Updated' });

      expect(person.updatedAt.getTime()).toBeGreaterThan(oldDate.getTime());
      expect(person.createdAt).toBe(oldDate); // createdAt stays unchanged
    });
  });
});
