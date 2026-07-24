import { describe, it, expect } from 'vitest';
import { debtDirectionForType, debtNetAmount, validateDebtAssign } from './debtAssign';

describe('debtDirectionForType', () => {
  it('expense → given', () => {
    expect(debtDirectionForType('expense')).toBe('given');
  });

  it('income → taken', () => {
    expect(debtDirectionForType('income')).toBe('taken');
  });

  it('transfer → null', () => {
    expect(debtDirectionForType('transfer')).toBeNull();
  });
});

describe('debtNetAmount', () => {
  it('обычный случай: сумма минус комиссия', () => {
    expect(debtNetAmount(100_000, 2_000)).toBe(98_000);
  });

  it('fee=0 → долг равен всей сумме', () => {
    expect(debtNetAmount(100_000, 0)).toBe(100_000);
  });

  it('округление до копеек (0.1+0.2-подобная погрешность)', () => {
    expect(debtNetAmount(100.3, 0.2)).toBe(100.1);
  });

  it('fee > total → 0 (не уходит в минус)', () => {
    expect(debtNetAmount(1_000, 5_000)).toBe(0);
  });
});

describe('validateDebtAssign', () => {
  it('валидное состояние → null', () => {
    expect(validateDebtAssign({ personName: 'Алишер', fee: 1_000 }, 100_000, 'given')).toBeNull();
  });

  it('пустое имя (given) → ошибка про «кому дали»', () => {
    expect(validateDebtAssign({ personName: '  ', fee: 0 }, 100_000, 'given')).toBe(
      'Укажите, кому вы дали в долг',
    );
  });

  it('пустое имя (taken) → ошибка про «у кого взяли»', () => {
    expect(validateDebtAssign({ personName: '', fee: 0 }, 100_000, 'taken')).toBe(
      'Укажите, у кого вы взяли в долг',
    );
  });

  it('fee < 0 → ошибка', () => {
    expect(validateDebtAssign({ personName: 'Алишер', fee: -100 }, 100_000, 'given')).toBe(
      'Комиссия не может быть отрицательной',
    );
  });

  it('fee === total → ошибка (должна быть строго меньше)', () => {
    expect(validateDebtAssign({ personName: 'Алишер', fee: 100_000 }, 100_000, 'given')).toBe(
      'Комиссия должна быть меньше суммы',
    );
  });

  it('fee > total → ошибка', () => {
    expect(validateDebtAssign({ personName: 'Алишер', fee: 150_000 }, 100_000, 'given')).toBe(
      'Комиссия должна быть меньше суммы',
    );
  });
});
