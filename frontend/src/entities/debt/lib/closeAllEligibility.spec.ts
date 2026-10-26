import { describe, it, expect } from 'vitest';
import { makeDebt } from '@/test/fixtures/debt';
import { canCloseAllTogether, hasMixedCurrencies } from './closeAllEligibility';

const given = (currency: string) => makeDebt({ debt_type: 'given', currency });
const taken = (currency: string) => makeDebt({ debt_type: 'taken', currency });

describe('hasMixedCurrencies', () => {
  it('одна валюта — не смешанные', () => {
    expect(hasMixedCurrencies([given('UZS'), given('UZS')])).toBe(false);
  });

  it('две валюты — смешанные', () => {
    expect(hasMixedCurrencies([given('UZS'), given('USD')])).toBe(true);
  });

  it('пустая валюта считается валютой по умолчанию', () => {
    expect(hasMixedCurrencies([given(''), given('UZS')])).toBe(false);
  });
});

describe('canCloseAllTogether', () => {
  it('долги одной стороны закрываются вместе в любых валютах', () => {
    expect(canCloseAllTogether([given('UZS'), given('USD')])).toBe(true);
  });

  it('встречные долги в одной валюте сводятся зачётом', () => {
    expect(canCloseAllTogether([given('UZS'), taken('UZS')])).toBe(true);
  });

  it('встречные долги в разных валютах сервер отклонит — кнопку не даём', () => {
    expect(canCloseAllTogether([given('UZS'), taken('USD')])).toBe(false);
  });

  it('человека не сверяет: сервер сводит ровно то, что ему передали', () => {
    expect(
      canCloseAllTogether([
        makeDebt({ debt_type: 'given', person_name: 'Алексей' }),
        makeDebt({ debt_type: 'taken', person_name: 'Мария' }),
      ]),
    ).toBe(true);
  });
});
