import { describe, it, expect } from 'vitest';
import { resolveParts, validateSecondPart, buildSecondPartPayload } from './paymentParts';

describe('resolveParts', () => {
  it('anchor total: первая часть = итог − вторая', () => {
    expect(resolveParts({ anchor: 'total', total: 100000, secondAmount: 40000 })).toEqual({
      total: 100000,
      primaryAmount: 60000,
      secondAmount: 40000,
    });
  });

  it('anchor total: без второй части первая равна итогу', () => {
    expect(resolveParts({ anchor: 'total', total: 100000, secondAmount: 0 })).toEqual({
      total: 100000,
      primaryAmount: 100000,
      secondAmount: 0,
    });
  });

  it('anchor primary: первая закреплена, итог = первая + вторая', () => {
    expect(
      resolveParts({ anchor: 'primary', total: 0, primaryFixed: 60000, secondAmount: 40000 }),
    ).toEqual({ total: 100000, primaryAmount: 60000, secondAmount: 40000 });
  });

  it('anchor primary: игнорирует переданный total', () => {
    expect(
      resolveParts({ anchor: 'primary', total: 999, primaryFixed: 500, secondAmount: 100 }).total,
    ).toBe(600);
  });

  it('не накапливает ошибку float-арифметики', () => {
    expect(resolveParts({ anchor: 'total', total: 0.3, secondAmount: 0.1 }).primaryAmount).toBe(
      0.2,
    );
    expect(
      resolveParts({ anchor: 'primary', total: 0, primaryFixed: 0.1, secondAmount: 0.2 }).total,
    ).toBe(0.3);
  });
});

describe('validateSecondPart', () => {
  const valid = { total: 100000, primaryAccountId: 'acc-1' };

  it('возвращает null для корректной второй части', () => {
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: 40000 } }),
    ).toBeNull();
  });

  it('требует выбрать счёт', () => {
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: null, amount: 40000 } }),
    ).toBeTruthy();
  });

  it('требует счёт, отличный от первого', () => {
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-1', amount: 40000 } }),
    ).toBeTruthy();
  });

  it('требует сумму больше нуля', () => {
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: 0 } }),
    ).toBeTruthy();
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: -5 } }),
    ).toBeTruthy();
  });

  it('требует сумму строго меньше итога', () => {
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: 100000 } }),
    ).toBeTruthy();
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: 100001 } }),
    ).toBeTruthy();
    expect(
      validateSecondPart({ ...valid, secondPart: { accountId: 'acc-2', amount: 99999 } }),
    ).toBeNull();
  });

  it('при незаполненном первом счёте не ругается на совпадение', () => {
    expect(
      validateSecondPart({
        total: 100000,
        primaryAccountId: null,
        secondPart: { accountId: 'acc-2', amount: 40000 },
      }),
    ).toBeNull();
  });

  it('сообщения короткие и по-русски', () => {
    const message = validateSecondPart({
      ...valid,
      secondPart: { accountId: null, amount: 40000 },
    });
    expect(message).toMatch(/[а-яё]/i);
    expect(message!.length).toBeLessThan(60);
  });
});

describe('buildSecondPartPayload', () => {
  it('без второй части шлёт только итог', () => {
    expect(buildSecondPartPayload(100000, null)).toEqual({ amount: 100000 });
  });

  it('со второй частью: amount = итог − вторая, second_part в snake_case', () => {
    expect(buildSecondPartPayload(100000, { accountId: 'acc-2', amount: 40000 })).toEqual({
      amount: 60000,
      second_part: { account_id: 'acc-2', amount: 40000 },
    });
  });

  it('не оставляет ключ second_part, когда второй части нет', () => {
    expect('second_part' in buildSecondPartPayload(500, null)).toBe(false);
  });

  it('бросает, если у второй части не выбран счёт', () => {
    expect(() => buildSecondPartPayload(100000, { accountId: null, amount: 40000 })).toThrow();
  });
});
