import { Category } from './category.aggregate';

describe('Category Aggregate', () => {
  describe('create', () => {
    it('should create an expense category', () => {
      const cat = Category.create('cat-1', 'user-1', 'Food', 'restaurant', '#FF0000', 'expense');
      expect(cat.id).toBe('cat-1');
      expect(cat.userId).toBe('user-1');
      expect(cat.name).toBe('Food');
      expect(cat.icon).toBe('restaurant');
      expect(cat.color).toBe('#FF0000');
      expect(cat.typeValue).toBe('expense');
      expect(cat.sortOrder).toBe(0);
      expect(cat.isFrequent).toBe(true);
      expect(cat.createdAt).toBeInstanceOf(Date);
    });

    it('should create an income category', () => {
      const cat = Category.create('cat-1', 'user-1', 'Salary', 'work', '#00FF00', 'income');
      expect(cat.typeValue).toBe('income');
    });

    it('should accept custom sortOrder and isFrequent', () => {
      const cat = Category.create('cat-1', 'user-1', 'Misc', 'misc', '#000', 'expense', 5, false);
      expect(cat.sortOrder).toBe(5);
      expect(cat.isFrequent).toBe(false);
    });

    it('should throw on invalid category type', () => {
      expect(() => Category.create('cat-1', 'user-1', 'Test', 'icon', '#000', 'transfer')).toThrow(
        'Invalid category type',
      );
    });
  });

  describe('update', () => {
    it('should update name', () => {
      const cat = Category.create('cat-1', 'user-1', 'Old', 'icon', '#000', 'expense');
      cat.update({ name: 'New' });
      expect(cat.name).toBe('New');
    });

    it('should update multiple fields', () => {
      const cat = Category.create('cat-1', 'user-1', 'Old', 'old-icon', '#000', 'expense');
      cat.update({ name: 'New', icon: 'new-icon', color: '#FFF', isFrequent: false });
      expect(cat.name).toBe('New');
      expect(cat.icon).toBe('new-icon');
      expect(cat.color).toBe('#FFF');
      expect(cat.isFrequent).toBe(false);
    });

    it('should update type', () => {
      const cat = Category.create('cat-1', 'user-1', 'Test', 'icon', '#000', 'expense');
      cat.update({ type: 'income' });
      expect(cat.typeValue).toBe('income');
    });

    it('should not change fields that are not provided', () => {
      const cat = Category.create('cat-1', 'user-1', 'Food', 'restaurant', '#FF0000', 'expense');
      cat.update({ icon: 'new-icon' });
      expect(cat.name).toBe('Food');
      expect(cat.color).toBe('#FF0000');
    });

    it('should update sortOrder', () => {
      const cat = Category.create('cat-1', 'user-1', 'Test', 'icon', '#000', 'expense', 0);
      cat.update({ sortOrder: 10 });
      expect(cat.sortOrder).toBe(10);
    });
  });
});
