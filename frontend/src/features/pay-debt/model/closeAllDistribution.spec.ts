import { describe, it, expect } from 'vitest';
import type { CloseAllPreview } from '@/entities/debt';
import { makeDebt } from '@/test/fixtures/debt';
import { buildDistribution } from './closeAllDistribution';

function preview(overrides: Partial<CloseAllPreview> = {}): CloseAllPreview {
  return {
    offset_amount: 0,
    direction: null,
    net: 0,
    offset_parts: [],
    payments: [],
    ...overrides,
  };
}

const older = makeDebt({ id: 'old', remaining_amount: 10_000, created_at: '2026-01-01' });
const newer = makeDebt({ id: 'new', remaining_amount: 20_000, created_at: '2026-02-01' });

describe('buildDistribution', () => {
  it('строки идут от старых долгов к новым, как их и платит сервер', () => {
    const rows = buildDistribution([newer, older], preview());

    expect(rows.map((r) => r.debt.id)).toEqual(['old', 'new']);
  });

  it('долг без доли и без прощения не покрыт', () => {
    const [row] = buildDistribution([older], preview());

    expect(row).toMatchObject({ covered: 0, forgiven: 0, status: 'open' });
  });

  it('платёж на весь остаток закрывает долг', () => {
    const [row] = buildDistribution(
      [older],
      preview({
        payments: [{ debt_id: 'old', amount: 10_000, forgive: false }],
      }),
    );

    expect(row).toMatchObject({ covered: 10_000, forgiven: 0, status: 'closed' });
  });

  it('неполный платёж — частично', () => {
    const [row] = buildDistribution(
      [newer],
      preview({
        payments: [{ debt_id: 'new', amount: 5_000, forgive: false }],
      }),
    );

    expect(row).toMatchObject({ covered: 5_000, forgiven: 0, status: 'partial' });
  });

  it('прощение без денег — «простится», остаток идёт в прощённое', () => {
    const [row] = buildDistribution(
      [newer],
      preview({ payments: [{ debt_id: 'new', amount: 0, forgive: true }] }),
    );

    expect(row).toMatchObject({ covered: 0, forgiven: 20_000, status: 'forgiven' });
  });

  it('деньги плюс прощение остатка — отдельный статус: часть денег всё же уходит со счёта', () => {
    const [row] = buildDistribution(
      [newer],
      preview({ payments: [{ debt_id: 'new', amount: 5_000, forgive: true }] }),
    );

    expect(row).toMatchObject({ covered: 5_000, forgiven: 15_000, status: 'paidAndForgiven' });
  });

  it('переплата, приписанная к платежу, долгу не засчитывается', () => {
    const [row] = buildDistribution(
      [older],
      preview({
        payments: [{ debt_id: 'old', amount: 13_000, forgive: false }],
      }),
    );

    expect(row).toMatchObject({ covered: 10_000, forgiven: 0, status: 'closed' });
  });

  describe('зачёт', () => {
    it('доля зачёта входит в покрытое; остаток после неё платит платёж', () => {
      const [row] = buildDistribution(
        [newer],
        preview({
          offset_parts: [{ debt_id: 'new', amount: 15_000 }],
          payments: [{ debt_id: 'new', amount: 5_000, forgive: false }],
        }),
      );

      expect(row).toMatchObject({ covered: 20_000, forgiven: 0, status: 'closed' });
    });

    it('долг, погашенный зачётом целиком, платежа не получает — «зачтётся»', () => {
      const [row] = buildDistribution(
        [older],
        preview({ offset_parts: [{ debt_id: 'old', amount: 10_000 }] }),
      );

      expect(row).toMatchObject({ covered: 10_000, forgiven: 0, status: 'offset' });
    });

    it('прощение считается от остатка после зачёта, а не от всего долга', () => {
      const [row] = buildDistribution(
        [newer],
        preview({
          offset_parts: [{ debt_id: 'new', amount: 15_000 }],
          payments: [{ debt_id: 'new', amount: 0, forgive: true }],
        }),
      );

      expect(row).toMatchObject({ covered: 15_000, forgiven: 5_000, status: 'forgiven' });
    });
  });
});
