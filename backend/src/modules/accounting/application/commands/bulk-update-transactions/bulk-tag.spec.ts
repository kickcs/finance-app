import { BadRequestException } from '@nestjs/common';
import { appendTag, hasTag, normalizeTag } from './bulk-tag';

describe('normalizeTag', () => {
  it('снимает ведущий # и пробелы по краям, регистр оставляет', () => {
    expect(normalizeTag('#Кафе')).toBe('Кафе');
    expect(normalizeTag('  #такси  ')).toBe('такси');
    expect(normalizeTag('такси')).toBe('такси');
  });

  it('отказывает на пустом теге', () => {
    expect(() => normalizeTag('')).toThrow(BadRequestException);
    expect(() => normalizeTag('   ')).toThrow(BadRequestException);
    expect(() => normalizeTag('#')).toThrow(BadRequestException);
  });

  it('отказывает на пробеле внутри', () => {
    expect(() => normalizeTag('мой тег')).toThrow(BadRequestException);
    expect(() => normalizeTag('# кафе')).toThrow(BadRequestException);
  });

  it.each(['#', '.', ',', ';', ':', '!', '?', ')'])('отказывает на граничном символе %s', (ch) => {
    expect(() => normalizeTag(`ка${ch}фе`)).toThrow(BadRequestException);
    expect(() => normalizeTag(`кафе${ch}`)).toThrow(BadRequestException);
  });

  it('второй # подряд тоже отказ: тег вышел бы другим', () => {
    expect(() => normalizeTag('##кафе')).toThrow(BadRequestException);
  });
});

describe('hasTag', () => {
  it('находит тег без учёта регистра', () => {
    expect(hasTag('обед #Кафе', 'кафе')).toBe(true);
    expect(hasTag('обед #кафе', 'КАФЕ')).toBe(true);
  });

  it('#кафе не находит #кафе2 и наоборот', () => {
    expect(hasTag('обед #кафе2', 'кафе')).toBe(false);
    expect(hasTag('обед #кафе', 'кафе2')).toBe(false);
  });

  it('тег кончается на знаках границы: #Кафе, и #кафе) находятся', () => {
    expect(hasTag('обед #Кафе, потом домой', 'кафе')).toBe(true);
    expect(hasTag('(обед #кафе)', 'кафе')).toBe(true);
    expect(hasTag('итог #кафе.', 'кафе')).toBe(true);
    expect(hasTag('итог #кафе!', 'кафе')).toBe(true);
  });

  it('тег находится в начале, середине и конце, среди нескольких', () => {
    expect(hasTag('#кафе', 'кафе')).toBe(true);
    expect(hasTag('#такси #кафе #обед', 'кафе')).toBe(true);
    expect(hasTag('#такси #обед', 'кафе')).toBe(false);
  });

  it('без # в тексте тега нет: слово не считается тегом', () => {
    expect(hasTag('кафе', 'кафе')).toBe(false);
  });

  it('пустое и отсутствующее описание', () => {
    expect(hasTag(null, 'кафе')).toBe(false);
    expect(hasTag('', 'кафе')).toBe(false);
  });
});

describe('appendTag', () => {
  it('дописывает через пробел', () => {
    expect(appendTag('обед', 'кафе')).toBe('обед #кафе');
  });

  it('у пустого описания нет ведущего пробела', () => {
    expect(appendTag(null, 'кафе')).toBe('#кафе');
    expect(appendTag('', 'кафе')).toBe('#кафе');
  });

  it('не удваивает пробел, если описание уже кончается пробелом', () => {
    expect(appendTag('обед ', 'кафе')).toBe('обед #кафе');
  });

  it('дописанный тег потом находится через hasTag', () => {
    expect(hasTag(appendTag('обед', 'Кафе'), 'кафе')).toBe(true);
  });
});
