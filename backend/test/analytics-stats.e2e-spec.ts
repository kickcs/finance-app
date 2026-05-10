import {
  setupAnalyticsTestContext,
  seedExpense,
  seedDebt,
  seedDebtReturn,
  type AnalyticsTestContext,
} from './helpers/analytics-test-db';

const RANGE_START = new Date('2026-04-01T00:00:00Z');
const RANGE_END = new Date('2026-04-30T23:59:59Z');
const IN_RANGE = new Date('2026-04-15T12:00:00Z');

describe('TransactionRepository.getAnalyticsStats — debt-offset for regular expenses', () => {
  let ctx: AnalyticsTestContext;

  beforeEach(async () => {
    ctx = await setupAnalyticsTestContext();
  });

  afterEach(async () => {
    await ctx.closeAndCleanup();
  });

  it('subtracts debt returns from totalExpense when source is a regular expense (split scenario)', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE,
    });

    const debt1 = await seedDebt({
      ctx,
      totalAmount: 35000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });
    const debt2 = await seedDebt({
      ctx,
      totalAmount: 35000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt1, direction: 'to_me' });
    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt2, direction: 'to_me' });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(30000);
    expect(stats.expenseByCurrency.UZS).toBe(30000);
    const groceries = stats.categoryBreakdown.find((c) => c.categoryId === 'groceries');
    expect(groceries?.amount).toBe(30000);
  });
});
