import { describe, it, expect } from 'vitest';
import { generateDemoData } from './model/demoDataGenerator';

describe('generateDemoData — кредитная карта', () => {
  it('добавляет третий счёт — кредитку', () => {
    const { accounts } = generateDemoData();
    expect(accounts).toHaveLength(3);
    const card = accounts[2];
    expect(card.type).toBe('credit_card');
    expect(card.name).toBe('Кредитная карта');
    expect(card.icon).toBe('credit_card');
    expect(card.color).toBe('#f97316');
  });

  it('кредитка идёт с долгом и параметрами', () => {
    const card = generateDemoData().accounts[2];
    expect(card.balances).toEqual([{ currency: 'UZS', balance: -2_350_000 }]);
    expect(card.creditLimit).toBe(10_000_000);
    expect(card.monthlyPayment).toBe(500_000);
    expect(card.gracePeriodDays).toBe(55);
    expect(card.billingDay).toBe(5);
  });

  it('демо-транзакции не вешаются на кредитку', () => {
    const { transactions } = generateDemoData();
    expect(transactions.every((t) => t.accountIndex < 2)).toBe(true);
  });
});
