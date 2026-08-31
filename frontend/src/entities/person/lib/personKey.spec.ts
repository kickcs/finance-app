import { describe, it, expect } from 'vitest';
import { personKey } from './personKey';

describe('personKey', () => {
  it('нормализует регистр и пробелы', () => {
    expect(personKey('  АнЯ  ')).toBe('аня');
  });

  it('сводит одно имя в разных написаниях к одному ключу', () => {
    expect(personKey('Аня')).toBe(personKey('аня '));
  });
});
