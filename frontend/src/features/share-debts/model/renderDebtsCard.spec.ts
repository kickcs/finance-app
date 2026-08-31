import { describe, it, expect, afterEach } from 'vitest';
import { stubCanvas2d, type Canvas2dStub } from '@/test/stubs/canvas2d';
import type { SharedDebtEntry, SharedDebtsPayload } from '@/entities/debt';
import { buildReconciliation, renderDebtsCardToCanvas, usesMixedCurrency } from './renderDebtsCard';

function debt(over: Partial<SharedDebtEntry> = {}): SharedDebtEntry {
  return {
    title: 'Ремонт квартиры',
    direction: 'given',
    currency: 'UZS',
    totalAmount: 1500000,
    remainingAmount: 1350000,
    paidAmount: 150000,
    forgivenAmount: 0,
    dueDate: null,
    createdAt: '2026-08-01',
    ...over,
  };
}

function payload(over: Partial<SharedDebtsPayload> = {}): SharedDebtsPayload {
  return {
    personName: 'Азамат',
    currency: 'UZS',
    net: 1250000,
    totalGiven: 1250000,
    totalTaken: 0,
    ownerName: null,
    snapshotAt: Date.parse('2026-08-31'),
    debts: [debt()],
    ...over,
  };
}

let stub: Canvas2dStub | null = null;

afterEach(() => {
  stub?.restore();
  stub = null;
});

describe('buildReconciliation', () => {
  // Нетто — разность встречных сторон, и по списку её не проверить:
  // 1 350 000 + 750 000 + 850 000 никак не даёт 1 250 000.
  it('при встречных долгах показывает обе стороны', () => {
    const result = buildReconciliation(payload({ totalGiven: 2100000, totalTaken: 850000 }));
    expect(result.mutual).toBe(true);
    expect(result.given).toBe('вам должны 2 100 000');
    expect(result.taken).toBe('вы должны 850 000');
  });

  it('при одностороннем долге в вашу пользу — прежняя формулировка', () => {
    const result = buildReconciliation(payload({ net: 1000, totalGiven: 1000, totalTaken: 0 }));
    expect(result.mutual).toBe(false);
    expect(result.caption).toBe('должен вам');
  });

  it('при одностороннем долге с вас — прежняя формулировка', () => {
    const result = buildReconciliation(payload({ net: -1000, totalGiven: 0, totalTaken: 1000 }));
    expect(result.mutual).toBe(false);
    expect(result.caption).toBe('вы должны');
  });
});

describe('usesMixedCurrency', () => {
  it('однородные валюты — голые числа в строках', () => {
    expect(usesMixedCurrency(payload())).toBe(false);
  });

  it('чужая валюта хотя бы в одном долге — валюта в каждой строке', () => {
    expect(usesMixedCurrency(payload({ debts: [debt(), debt({ currency: 'USD' })] }))).toBe(true);
  });
});

describe('renderDebtsCardToCanvas', () => {
  it('высота растёт с числом долгов', () => {
    stub = stubCanvas2d();
    const one = renderDebtsCardToCanvas(payload({ debts: [debt()] })).height;
    const three = renderDebtsCardToCanvas(payload({ debts: [debt(), debt(), debt()] })).height;
    expect(three).toBeGreaterThan(one);
  });

  it('пустой список не роняет рендер', () => {
    stub = stubCanvas2d();
    const canvas = renderDebtsCardToCanvas(payload({ debts: [] }));
    expect(canvas.height).toBeGreaterThan(0);
    expect(stub.calls.some((call) => call.text === 'Открытых долгов нет')).toBe(true);
  });

  it('под суммой стоят обе стороны сверки', () => {
    stub = stubCanvas2d();
    renderDebtsCardToCanvas(payload({ totalGiven: 2100000, totalTaken: 850000 }));
    const drawn = stub.calls.map((call) => call.text);
    expect(drawn).toContain('вам должны 2 100 000');
    expect(drawn).toContain('вы должны 850 000');
  });

  it('в подстрочнике отданное и прощённое названы отдельно', () => {
    stub = stubCanvas2d();
    renderDebtsCardToCanvas(
      payload({ debts: [debt({ paidAmount: 150000, forgivenAmount: 50000 })] }),
    );
    expect(stub.calls.map((call) => call.text)).toContain(
      'отдано 150 000 из 1 500 000  ·  прощено 50 000',
    );
  });

  it('валюта в строке появляется только при смешанных валютах', () => {
    stub = stubCanvas2d();
    renderDebtsCardToCanvas(payload());
    expect(stub.calls.map((call) => call.text)).toContain('1 350 000');

    stub.restore();
    stub = stubCanvas2d();
    renderDebtsCardToCanvas(
      payload({ debts: [debt(), debt({ currency: 'USD', remainingAmount: 100 })] }),
    );
    expect(stub.calls.map((call) => call.text)).toContain('100 USD');
  });
});
