import { describe, it, expect } from 'vitest';
import { normalizeTagInput, stripHash } from './hashtag';

describe('hashtag', () => {
  it('stripHash снимает все решётки в начале и только их', () => {
    expect(stripHash('#кафе')).toBe('кафе');
    expect(stripHash('##кафе')).toBe('кафе');
    expect(stripHash('кафе#2')).toBe('кафе#2');
  });

  it('тег из ввода: без решётки, пробелы — подчёркивания, знаки-границы выброшены', () => {
    expect(normalizeTagInput('  #Кофе с собой! ')).toBe('Кофе_с_собой');
    expect(normalizeTagInput('a.b,c;d:e?f)g#h')).toBe('abcdefgh');
    expect(normalizeTagInput('c++')).toBe('c++');
    expect(normalizeTagInput('##')).toBe('');
  });
});
