import { describe, it, expect } from 'vitest';
import { makeDebt } from '@/test/fixtures/debt';
import { buildCloseAllInput, buildCloseAllPreviewInput } from './closeAllInput';

const ACCOUNT_ID = 'acc-1';

const uzs1 = makeDebt({ id: 'd1', currency: 'UZS' });
const uzs2 = makeDebt({ id: 'd2', currency: 'UZS' });
const usd = makeDebt({ id: 'd3', currency: 'USD' });

describe('buildCloseAllInput', () => {
  describe('одна валюта', () => {
    it('переносит все заданные поля', () => {
      expect(
        buildCloseAllInput([uzs1, uzs2], ACCOUNT_ID, {
          paymentAmount: 500,
          forgiveRemainder: true,
          excessCategoryId: 'cat-bonus',
          transactionDate: '2026-10-01T12:00:00.000Z',
        }),
      ).toEqual({
        debt_ids: ['d1', 'd2'],
        account_id: ACCOUNT_ID,
        payment_amount: 500,
        forgive_remainder: true,
        excess_category_id: 'cat-bonus',
        date: '2026-10-01T12:00:00.000Z',
      });
    });

    it('без опций шлёт только долги и счёт: незаданных полей в теле нет вовсе', () => {
      const input = buildCloseAllInput([uzs1], ACCOUNT_ID);

      expect(Object.keys(input).sort()).toEqual(['account_id', 'debt_ids']);
    });

    it('ноль — заданная сумма, а не отсутствие: с прощением это закрытие одним прощением', () => {
      const input = buildCloseAllInput([uzs1], ACCOUNT_ID, {
        paymentAmount: 0,
        forgiveRemainder: true,
      });

      expect(input.payment_amount).toBe(0);
      expect(input.forgive_remainder).toBe(true);
    });

    it('выключенное прощение в тело не попадает', () => {
      const input = buildCloseAllInput([uzs1], ACCOUNT_ID, {
        paymentAmount: 500,
        forgiveRemainder: false,
      });

      expect('forgive_remainder' in input).toBe(false);
    });
  });

  describe('смешанные валюты', () => {
    it('«оплатить всё»: суммы в теле нет, даже если форма её держит', () => {
      const input = buildCloseAllInput([uzs1, usd], ACCOUNT_ID, {
        paymentAmount: 12_345,
        forgiveRemainder: false,
        excessCategoryId: 'cat-bonus',
      });

      expect(input).toEqual({ debt_ids: ['d1', 'd3'], account_id: ACCOUNT_ID });
    });

    it('«простить всё»: только признак прощения, без суммы', () => {
      const input = buildCloseAllInput([uzs1, usd], ACCOUNT_ID, {
        paymentAmount: 0,
        forgiveRemainder: true,
      });

      expect(input).toEqual({
        debt_ids: ['d1', 'd3'],
        account_id: ACCOUNT_ID,
        forgive_remainder: true,
      });
    });

    it('дату записей передаёт и здесь', () => {
      const input = buildCloseAllInput([uzs1, usd], ACCOUNT_ID, {
        transactionDate: '2026-10-01T12:00:00.000Z',
      });

      expect(input.date).toBe('2026-10-01T12:00:00.000Z');
    });
  });
});

describe('buildCloseAllPreviewInput', () => {
  it('несёт долги и сумму, но не счёт', () => {
    const input = buildCloseAllPreviewInput([uzs1, uzs2], {
      paymentAmount: 500,
      forgiveRemainder: true,
    });

    expect(input).toEqual({
      debt_ids: ['d1', 'd2'],
      payment_amount: 500,
      forgive_remainder: true,
    });
  });

  it('смешанные валюты: суммы в теле нет, прощение остаётся', () => {
    const input = buildCloseAllPreviewInput([uzs1, usd], {
      paymentAmount: 12_345,
      forgiveRemainder: true,
    });

    expect(input).toEqual({ debt_ids: ['d1', 'd3'], forgive_remainder: true });
  });
});
