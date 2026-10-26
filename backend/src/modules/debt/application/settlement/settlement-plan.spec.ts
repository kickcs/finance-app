import { BadRequestException } from '@nestjs/common';
import {
  planCloseAll,
  planOffset,
  planPayment,
  round2,
  type SettlementDebt,
} from './settlement-plan';

function debt(
  id: string,
  debtType: 'given' | 'taken',
  remaining: number,
  createdAt: string,
): SettlementDebt {
  return { id, debtType, remaining, createdAt: new Date(createdAt) };
}

describe('round2', () => {
  it.each([
    [0.1 + 0.2, 0.3],
    [1.234, 1.23],
    [1.236, 1.24],
    [100, 100],
    [-0.004, 0],
  ])('round2(%s) = %s', (input, expected) => {
    expect(round2(input)).toBeCloseTo(expected, 10);
  });
});

describe('planPayment', () => {
  const base = { amount: 0, forgiveRemainder: false, settleWithWork: false };

  describe('рассчитанный план', () => {
    it.each([
      {
        name: 'частичный платёж',
        input: { remaining: 300, amount: 100 },
        expected: {
          actualPayment: 100,
          excess: 0,
          remainderAfter: 200,
          forgiven: 0,
          willClose: false,
        },
      },
      {
        name: 'платёж ровно в ноль',
        input: { remaining: 300, amount: 300 },
        expected: {
          actualPayment: 300,
          excess: 0,
          remainderAfter: 0,
          forgiven: 0,
          willClose: true,
        },
      },
      {
        name: 'переплата с категорией',
        input: { remaining: 300, amount: 350, excessCategoryId: 'cat-excess' },
        expected: {
          actualPayment: 300,
          excess: 50,
          remainderAfter: 0,
          forgiven: 0,
          willClose: true,
        },
      },
      {
        name: 'прощение остатка после частичного платежа',
        input: { remaining: 300, amount: 100, forgiveRemainder: true },
        expected: {
          actualPayment: 100,
          excess: 0,
          remainderAfter: 200,
          forgiven: 200,
          willClose: true,
        },
      },
      {
        name: 'только прощение, сумма 0',
        input: { remaining: 300, amount: 0, forgiveRemainder: true },
        expected: {
          actualPayment: 0,
          excess: 0,
          remainderAfter: 300,
          forgiven: 300,
          willClose: true,
        },
      },
      {
        name: 'прощение при переплате: прощать нечего',
        input: {
          remaining: 300,
          amount: 350,
          forgiveRemainder: true,
          excessCategoryId: 'cat-excess',
        },
        expected: {
          actualPayment: 300,
          excess: 50,
          remainderAfter: 0,
          forgiven: 0,
          willClose: true,
        },
      },
      {
        name: 'отработка на весь остаток',
        input: { remaining: 300, amount: 300, settleWithWork: true, workCategoryId: 'work' },
        expected: {
          actualPayment: 300,
          excess: 0,
          remainderAfter: 0,
          forgiven: 0,
          willClose: true,
        },
      },
      {
        name: 'остаток 0.1 + 0.2 округляется и закрывается платежом 0.3',
        input: { remaining: 0.1 + 0.2, amount: 0.3 },
        expected: {
          actualPayment: 0.3,
          excess: 0,
          remainderAfter: 0,
          forgiven: 0,
          willClose: true,
        },
      },
      {
        name: 'остаток 0.1 + 0.2 после платежа 0.1 не тащит хвост плавающей запятой',
        input: { remaining: 0.1 + 0.2, amount: 0.1 },
        expected: {
          actualPayment: 0.1,
          excess: 0,
          remainderAfter: 0.2,
          forgiven: 0,
          willClose: false,
        },
      },
    ])('$name', ({ input, expected }) => {
      const plan = planPayment({ ...base, ...input });

      expect(plan).toStrictEqual(expected);
    });
  });

  describe('ошибки', () => {
    it.each([
      {
        name: 'отрицательная сумма',
        input: { remaining: 300, amount: -1 },
        message: 'Некорректная сумма платежа',
      },
      {
        name: 'ноль без прощения',
        input: { remaining: 300, amount: 0 },
        message: 'Некорректная сумма платежа',
      },
      {
        name: 'переплата без категории',
        input: { remaining: 300, amount: 350 },
        message: 'Выберите категорию для переплаты',
      },
      {
        name: 'отработка с переплатой',
        input: {
          remaining: 300,
          amount: 350,
          settleWithWork: true,
          excessCategoryId: 'cat-excess',
        },
        message: 'Отработка не может превышать остаток долга',
      },
      {
        name: 'долговая категория работы',
        input: {
          remaining: 300,
          amount: 100,
          settleWithWork: true,
          workCategoryId: 'debt_return_to_me',
        },
        message: 'Некорректная категория работы',
      },
    ])('$name', ({ input, message }) => {
      const act = () => planPayment({ ...base, ...input });

      expect(act).toThrow(BadRequestException);
      expect(act).toThrow(message);
    });
  });
});

describe('planOffset', () => {
  it('сводит стороны на меньшую, старые долги первыми', () => {
    const plan = planOffset([
      debt('g-old', 'given', 100, '2026-01-01T00:00:00Z'),
      debt('g-new', 'given', 200, '2026-02-01T00:00:00Z'),
      debt('t-1', 'taken', 250, '2026-01-15T00:00:00Z'),
    ]);

    expect(plan).toStrictEqual({
      offsetAmount: 250,
      direction: 'given',
      net: 50,
      parts: [
        { debtId: 'g-old', amount: 100 },
        { debtId: 'g-new', amount: 150 },
        { debtId: 't-1', amount: 250 },
      ],
    });
  });

  it('переживает сторона taken, если она больше', () => {
    const plan = planOffset([
      debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
      debt('t-1', 'taken', 70, '2026-01-02T00:00:00Z'),
      debt('t-2', 'taken', 80, '2026-01-03T00:00:00Z'),
    ]);

    expect(plan.direction).toBe('taken');
    expect(plan.net).toBe(50);
    expect(plan.parts).toStrictEqual([
      { debtId: 'g-1', amount: 100 },
      { debtId: 't-1', amount: 70 },
      { debtId: 't-2', amount: 30 },
    ]);
  });

  it('равные стороны: net 0, направление given, все долги гасятся целиком', () => {
    const plan = planOffset([
      debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
      debt('t-1', 'taken', 100, '2026-01-02T00:00:00Z'),
    ]);

    expect(plan).toStrictEqual({
      offsetAmount: 100,
      direction: 'given',
      net: 0,
      parts: [
        { debtId: 'g-1', amount: 100 },
        { debtId: 't-1', amount: 100 },
      ],
    });
  });

  it('при равном createdAt порядок решает id, а не порядок во входе', () => {
    const sameMoment = '2026-01-01T00:00:00Z';
    const plan = planOffset([
      debt('g-b', 'given', 100, sameMoment),
      debt('g-a', 'given', 100, sameMoment),
      debt('t-1', 'taken', 100, '2026-01-02T00:00:00Z'),
    ]);

    expect(plan.parts.filter((p) => p.debtId.startsWith('g-'))).toStrictEqual([
      { debtId: 'g-a', amount: 100 },
    ]);
  });

  it('не мутирует входной массив', () => {
    const input = [
      debt('g-2', 'given', 10, '2026-02-01T00:00:00Z'),
      debt('g-1', 'given', 10, '2026-01-01T00:00:00Z'),
      debt('t-1', 'taken', 5, '2026-01-01T00:00:00Z'),
    ];

    planOffset(input);

    expect(input.map((d) => d.id)).toStrictEqual(['g-2', 'g-1', 't-1']);
  });

  it('без встречной стороны зачёт нулевой и частей нет', () => {
    const plan = planOffset([
      debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
      debt('g-2', 'given', 50, '2026-01-02T00:00:00Z'),
    ]);

    expect(plan).toStrictEqual({ offsetAmount: 0, direction: 'given', net: 150, parts: [] });
  });

  it('суммы сторон округляются: 0.1 + 0.2 против 0.3 дают чистый ноль', () => {
    const plan = planOffset([
      debt('g-1', 'given', 0.1, '2026-01-01T00:00:00Z'),
      debt('g-2', 'given', 0.2, '2026-01-02T00:00:00Z'),
      debt('t-1', 'taken', 0.3, '2026-01-03T00:00:00Z'),
    ]);

    expect(plan.offsetAmount).toBe(0.3);
    expect(plan.net).toBe(0);
    expect(plan.parts).toStrictEqual([
      { debtId: 'g-1', amount: 0.1 },
      { debtId: 'g-2', amount: 0.2 },
      { debtId: 't-1', amount: 0.3 },
    ]);
  });
});

describe('planCloseAll', () => {
  const given = [
    debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
    debt('g-2', 'given', 200, '2026-01-02T00:00:00Z'),
  ];

  describe('одна сторона', () => {
    it('сумма равна итогу: все долги закрываются полностью, зачёта нет', () => {
      const plan = planCloseAll(given, { paymentAmount: 300, forgiveRemainder: false });

      expect(plan).toStrictEqual({
        offset: null,
        totalDebt: 300,
        excess: 0,
        payments: [
          { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
          { debtId: 'g-2', amount: 200, forgive: false, withExcess: false },
        ],
      });
    });

    it('без суммы платит итог остатков', () => {
      const plan = planCloseAll(given, { forgiveRemainder: false });

      expect(plan.excess).toBe(0);
      expect(plan.payments.map((p) => p.amount)).toStrictEqual([100, 200]);
    });

    it('сумма больше итога: переплата уходит на последний долг', () => {
      const plan = planCloseAll(given, { paymentAmount: 350, forgiveRemainder: false });

      expect(plan.excess).toBe(50);
      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
        { debtId: 'g-2', amount: 250, forgive: false, withExcess: true },
      ]);
    });

    it('сумма меньше итога без прощения: долги без доли пропускаются', () => {
      const plan = planCloseAll(given, { paymentAmount: 100, forgiveRemainder: false });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
      ]);
      expect(plan.excess).toBe(0);
    });

    it('сумма меньше итога без прощения: частичная доля у второго долга', () => {
      const plan = planCloseAll(given, { paymentAmount: 150, forgiveRemainder: false });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
        { debtId: 'g-2', amount: 50, forgive: false, withExcess: false },
      ]);
    });

    it('сумма меньше итога с прощением: у недоплаченных forgive, и долг без доли тоже прощается', () => {
      const plan = planCloseAll(given, { paymentAmount: 100, forgiveRemainder: true });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
        { debtId: 'g-2', amount: 0, forgive: true, withExcess: false },
      ]);
    });

    it('частично оплаченный долг при прощении получает forgive', () => {
      const plan = planCloseAll(given, { paymentAmount: 150, forgiveRemainder: true });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 100, forgive: false, withExcess: false },
        { debtId: 'g-2', amount: 50, forgive: true, withExcess: false },
      ]);
    });

    it('сумма 0 с прощением: все долги только прощаются', () => {
      const plan = planCloseAll(given, { paymentAmount: 0, forgiveRemainder: true });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 0, forgive: true, withExcess: false },
        { debtId: 'g-2', amount: 0, forgive: true, withExcess: false },
      ]);
    });

    it('сумма 0 без прощения: платить нечего', () => {
      const plan = planCloseAll(given, { paymentAmount: 0, forgiveRemainder: false });

      expect(plan.payments).toStrictEqual([]);
    });

    it('идёт старыми первыми независимо от порядка на входе, при равенстве — по id', () => {
      const sameMoment = '2026-03-01T00:00:00Z';
      const plan = planCloseAll(
        [
          debt('b', 'given', 10, sameMoment),
          debt('new', 'given', 10, '2026-04-01T00:00:00Z'),
          debt('a', 'given', 10, sameMoment),
          debt('old', 'given', 10, '2026-02-01T00:00:00Z'),
        ],
        { paymentAmount: 25, forgiveRemainder: false },
      );

      expect(plan.payments.map((p) => [p.debtId, p.amount])).toStrictEqual([
        ['old', 10],
        ['a', 10],
        ['b', 5],
      ]);
    });

    it('суммы округляются: 0.1 + 0.2 закрываются платежом 0.3 без хвоста', () => {
      const plan = planCloseAll(
        [
          debt('g-1', 'given', 0.1, '2026-01-01T00:00:00Z'),
          debt('g-2', 'given', 0.2, '2026-01-02T00:00:00Z'),
        ],
        { paymentAmount: 0.3, forgiveRemainder: false },
      );

      expect(plan.totalDebt).toBe(0.3);
      expect(plan.excess).toBe(0);
      expect(plan.payments).toStrictEqual([
        { debtId: 'g-1', amount: 0.1, forgive: false, withExcess: false },
        { debtId: 'g-2', amount: 0.2, forgive: false, withExcess: false },
      ]);
    });

    it('отрицательная сумма — ошибка', () => {
      const act = () => planCloseAll(given, { paymentAmount: -1, forgiveRemainder: false });

      expect(act).toThrow(BadRequestException);
      expect(act).toThrow('Некорректная сумма платежа');
    });
  });

  describe('обе стороны', () => {
    const both = [
      debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
      debt('g-2', 'given', 200, '2026-01-02T00:00:00Z'),
      debt('t-1', 'taken', 250, '2026-01-03T00:00:00Z'),
    ];

    it('зачёт не null, платежи только по уцелевшей стороне на остатки после зачёта', () => {
      const plan = planCloseAll(both, { forgiveRemainder: false });

      expect(plan.offset).toStrictEqual({
        offsetAmount: 250,
        direction: 'given',
        net: 50,
        parts: [
          { debtId: 'g-1', amount: 100 },
          { debtId: 'g-2', amount: 150 },
          { debtId: 't-1', amount: 250 },
        ],
      });
      expect(plan.totalDebt).toBe(50);
      expect(plan.excess).toBe(0);
      expect(plan.payments).toStrictEqual([
        { debtId: 'g-2', amount: 50, forgive: false, withExcess: false },
      ]);
    });

    it('переплата считается от остатка после зачёта', () => {
      const plan = planCloseAll(both, { paymentAmount: 80, forgiveRemainder: false });

      expect(plan.excess).toBe(30);
      expect(plan.payments).toStrictEqual([
        { debtId: 'g-2', amount: 80, forgive: false, withExcess: true },
      ]);
    });

    it('прощение действует на остаток после зачёта', () => {
      const plan = planCloseAll(both, { paymentAmount: 20, forgiveRemainder: true });

      expect(plan.payments).toStrictEqual([
        { debtId: 'g-2', amount: 20, forgive: true, withExcess: false },
      ]);
    });

    it('перевес на стороне taken: платежи по taken', () => {
      const plan = planCloseAll(
        [
          debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
          debt('t-1', 'taken', 70, '2026-01-02T00:00:00Z'),
          debt('t-2', 'taken', 80, '2026-01-03T00:00:00Z'),
        ],
        { forgiveRemainder: false },
      );

      expect(plan.offset?.direction).toBe('taken');
      expect(plan.payments).toStrictEqual([
        { debtId: 't-2', amount: 50, forgive: false, withExcess: false },
      ]);
    });

    it('равные стороны: зачёт гасит всё, платить нечего', () => {
      const plan = planCloseAll(
        [
          debt('g-1', 'given', 100, '2026-01-01T00:00:00Z'),
          debt('t-1', 'taken', 100, '2026-01-02T00:00:00Z'),
        ],
        { forgiveRemainder: false },
      );

      expect(plan.offset?.net).toBe(0);
      expect(plan.totalDebt).toBe(0);
      expect(plan.payments).toStrictEqual([]);
      expect(plan.excess).toBe(0);
    });
  });
});
