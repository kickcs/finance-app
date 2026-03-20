import { CategoryType } from './category-type.vo';

describe('CategoryType Value Object', () => {
  it('should create valid income type', () => {
    const type = CategoryType.create('income');
    expect(type.value).toBe('income');
    expect(type.isIncome()).toBe(true);
    expect(type.isExpense()).toBe(false);
  });

  it('should create valid expense type', () => {
    const type = CategoryType.create('expense');
    expect(type.value).toBe('expense');
    expect(type.isExpense()).toBe(true);
    expect(type.isIncome()).toBe(false);
  });

  it('should throw on invalid type', () => {
    expect(() => CategoryType.create('transfer')).toThrow('Invalid category type: transfer');
  });

  it('should throw on empty string', () => {
    expect(() => CategoryType.create('')).toThrow('Invalid category type');
  });

  it('should support equality', () => {
    expect(CategoryType.create('income').equals(CategoryType.create('income'))).toBe(true);
    expect(CategoryType.create('income').equals(CategoryType.create('expense'))).toBe(false);
  });

  it('should have correct toString', () => {
    expect(CategoryType.create('expense').toString()).toBe('expense');
  });

  it('should have static instances', () => {
    expect(CategoryType.INCOME.value).toBe('income');
    expect(CategoryType.EXPENSE.value).toBe('expense');
  });
});
