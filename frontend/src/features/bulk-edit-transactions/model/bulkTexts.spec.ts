import { describe, it, expect } from 'vitest';
import {
  opsCount,
  opsAccusative,
  skipReasonText,
  actionTexts,
  summaryLabel,
  lockedNote,
  opsGenitive,
  opsInstrumental,
} from './bulkTexts';

describe('bulkTexts', () => {
  it('склоняет число операций', () => {
    expect([1, 2, 5, 11, 21, 24].map(opsCount)).toEqual([
      '1 операция',
      '2 операции',
      '5 операций',
      '11 операций',
      '21 операция',
      '24 операции',
    ]);
    expect([1, 2, 5].map(opsAccusative)).toEqual(['1 операцию', '2 операции', '5 операций']);
  });

  it('текст пропуска зависит от действия там, где причина читается по-разному', () => {
    expect(skipReasonText('wrong_type', 3, 'category')).toBe(
      '3 операции другого типа: у категории иной тип',
    );
    expect(skipReasonText('wrong_type', 1, 'transfer')).toBe('1 операция не расход');
    expect(skipReasonText('locked', 2, 'delete')).toBe(
      '2 операции не изменятся: связанные с долгом правятся из карточки долга, корректировки баланса — по одной',
    );
    expect(skipReasonText('locked', 1, 'category')).toMatch(/^1 операция не изменится: /);
    expect(skipReasonText('same_account', 4, 'account')).toBe('4 операции уже на этом счёте');
    expect(skipReasonText('already_tagged', 5, 'tag')).toBe('5 операций уже с этим тегом');
    expect(skipReasonText('transfer_not_movable', 1, 'account')).toBe(
      '1 перевод нельзя перенести на другой счёт',
    );
  });

  it('пара на целевом счёте: при смене счёта там вторая часть, при переводе — любая из двух', () => {
    expect(skipReasonText('pair_on_target', 1, 'account')).toBe(
      '1 операция оплачена с двух счетов, вторая часть уже на этом счёте',
    );
    expect(skipReasonText('pair_on_target', 2, 'transfer')).toBe(
      '2 операции оплачены с двух счетов, одна из частей уже на этом счёте',
    );
  });

  it('пара целиком в выборке смены счёта отправляет в карточку операции', () => {
    expect(skipReasonText('pair_split', 2, 'account')).toBe(
      '2 операции оплачены с двух счетов: счёт такой оплаты меняется в карточке операции',
    );
  });

  it('строки уже в целевой категории', () => {
    expect(skipReasonText('already_in_category', 1, 'category')).toBe(
      '1 операция уже в этой категории',
    );
    expect(skipReasonText('already_in_category', 5, 'category')).toBe(
      '5 операций уже в этой категории',
    );
  });

  describe('actionTexts: все тексты действия из одного места', () => {
    it('тост называет результат', () => {
      const applied = (action: Parameters<typeof actionTexts>[0], n: number, target?: string) =>
        actionTexts(action, n, target).applied;

      expect(applied({ kind: 'category', category_id: 'x' }, 9, 'Транспорт')).toBe(
        '9 операций теперь в «Транспорт»',
      );
      expect(applied({ kind: 'transfer', to_account_id: 'a' }, 1, 'Humo')).toBe(
        '1 операция стала переводом на «Humo»',
      );
      expect(applied({ kind: 'transfer', to_account_id: 'a' }, 3, 'Humo')).toBe(
        '3 операции стали переводами на «Humo»',
      );
      expect(applied({ kind: 'account', account_id: 'a' }, 1, 'Tez')).toBe(
        '1 операция перенесена на «Tez»',
      );
      expect(applied({ kind: 'account', account_id: 'a' }, 6, 'Tez')).toBe(
        '6 операций перенесены на «Tez»',
      );
      expect(applied({ kind: 'tag', tag: 'кафе' }, 2)).toBe('Тег #кафе добавлен к 2 операциям');
      expect(applied({ kind: 'delete' }, 3)).toBe('Удалено: 3 операции');
    });

    it('кнопка подтверждения называет действие и число', () => {
      expect(actionTexts({ kind: 'category', category_id: 'x' }, 9).button).toBe(
        'Перенести 9 операций',
      );
      expect(actionTexts({ kind: 'transfer', to_account_id: 'a' }, 1).button).toBe(
        'Сделать переводом 1 операцию',
      );
      expect(actionTexts({ kind: 'tag', tag: 'a' }, 4).button).toBe('Добавить тег к 4 операциям');
      expect(actionTexts({ kind: 'delete' }, 2).button).toBe('Удалить 2 операции');
    });

    it('заголовок подтверждения называет цель', () => {
      expect(actionTexts({ kind: 'category', category_id: 'c' }, 9, 'Транспорт').title).toBe(
        'Перенести в «Транспорт»',
      );
      expect(actionTexts({ kind: 'tag', tag: 'кафе' }, 9).title).toBe('Добавить тег #кафе');
      expect(actionTexts({ kind: 'delete' }, 2).title).toBe('Удалить 2 операции?');
    });

    it('пояснение под сводкой у перевода называет целевой счёт', () => {
      expect(actionTexts({ kind: 'transfer', to_account_id: 'a' }, 2, 'Humo').note).toContain(
        'пополнение «Humo»',
      );
      expect(actionTexts({ kind: 'category', category_id: 'c' }, 2).note).toBe(
        'Суммы и балансы счетов не изменятся.',
      );
    });
  });

  describe('summaryLabel: подпись итога сходится с числом на «Изменить все»', () => {
    const summary = { count: 10, locked_count: 1 };

    // Вне правки не только долги, но и корректировки баланса — подпись не называет причину
    it('строки вне правки названы отдельно, без причины', () => {
      expect(summaryLabel(summary, true)).toBe('10 операций, 1 не изменится');
      expect(summaryLabel({ count: 10, locked_count: 3 }, true)).toBe(
        '10 операций, 3 не изменятся',
      );
    });

    it('без строк вне правки — «по фильтру»', () => {
      expect(summaryLabel({ count: 9, locked_count: 0 }, true)).toBe('9 операций по фильтру');
    });

    it('без фильтра — просто число', () => {
      expect(summaryLabel(summary, false)).toBe('10 операций');
    });
  });

  it('склоняет «что сделать с» и «тег для»', () => {
    expect([1, 3, 5].map(opsInstrumental)).toEqual(['1 операцией', '3 операциями', '5 операциями']);
    expect([1, 3, 5].map(opsGenitive)).toEqual(['1 операции', '3 операций', '5 операций']);
  });

  it('заметка о строках вне правки называет обе причины и согласует число', () => {
    expect(lockedNote(1)).toBe(
      '1 операция в выборку не входит: связанные с долгом правятся из карточки долга, корректировки баланса — по одной.',
    );
    expect(lockedNote(3)).toMatch(/^3 операции в выборку не входят: /);
  });
});
