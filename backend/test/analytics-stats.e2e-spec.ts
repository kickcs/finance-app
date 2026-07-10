import {
  setupAnalyticsTestContext,
  seedExpense,
  seedDebt,
  seedDebtReturn,
  seedExtraAccount,
  type AnalyticsTestContext,
} from './helpers/analytics-test-db';
import { UNRETURNED_DEBT_CATEGORY_ID } from '../src/modules/accounting/domain/constants/default-categories';

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

    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt1 });
    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: debt2 });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(30000);
    expect(stats.expenseByCurrency.UZS).toBe(30000);
    const groceries = stats.categoryBreakdown.find((c) => c.categoryId === 'groceries');
    expect(groceries?.amount).toBe(30000);
  });

  it('subtracts only the partially-returned amount from totalExpense', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 70000,
      remainingAmount: 40000,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
    });

    await seedDebtReturn({ ctx, amount: 30000, date: IN_RANGE, debtId: debt });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(70000);
    expect(stats.expenseByCurrency.UZS).toBe(70000);
  });

  it('caps offset at source expense amount — never returns negative totalExpense', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'groceries',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    // Return is bigger than the source expense (could happen via combining returns
    // from debts with different sources)
    await seedDebtReturn({ ctx, amount: 80000, date: IN_RANGE, debtId: debt });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(0);
    expect(stats.expenseByCurrency.UZS).toBeUndefined();
    const groceries = stats.categoryBreakdown.find((c) => c.categoryId === 'groceries');
    expect(groceries).toBeUndefined();
  });

  it('does not double-offset direct debt_given transactions', async () => {
    // Direct debt: source_transaction_id points to a debt_given expense, not a regular one
    const debtGivenTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'debt_given',
      date: IN_RANGE,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: debtGivenTxId,
      isClosed: true,
    });

    await seedDebtReturn({ ctx, amount: 50000, date: IN_RANGE, debtId: debt });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    // Should be 0 (debtGiven 50k - returnsToMe 50k), not -50k (would happen on double-offset)
    expect(stats.totalExpense).toBe(0);
    expect(stats.expenseByCurrency.UZS).toBeUndefined();
  });

  it('offsets per-currency without bleeding into other currencies', async () => {
    const usdSrc = await seedExpense({
      ctx,
      amount: 100,
      categoryId: 'groceries',
      date: IN_RANGE,
      currency: 'USD',
    });
    await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE,
      currency: 'UZS',
    });

    const usdDebt = await seedDebt({
      ctx,
      totalAmount: 30,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: usdSrc,
      isClosed: true,
      currency: 'USD',
    });
    await seedDebtReturn({
      ctx,
      amount: 30,
      date: IN_RANGE,
      debtId: usdDebt,
      currency: 'USD',
    });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.expenseByCurrency.USD).toBe(70);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
    expect(stats.totalExpense).toBe(100070); // 70 USD + 100000 UZS — both in scalar total
  });

  it('respects accountIds filter on offsets', async () => {
    const accountB = await seedExtraAccount({ ctx });

    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE,
      accountId: ctx.accountId,
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
      accountId: accountB,
    });
    await seedDebtReturn({
      ctx,
      amount: 50000,
      date: IN_RANGE,
      debtId: debt,
      accountId: accountB,
    });

    // Filtering by account A: the return on account B must not offset A's expense.
    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
      accountIds: [ctx.accountId],
    });

    expect(stats.totalExpense).toBe(100000);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
  });

  it('ignores debt returns dated outside the analytics period', async () => {
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE, // April
    });

    const debt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });

    // Return is in May — outside the April range we'll query
    await seedDebtReturn({
      ctx,
      amount: 50000,
      date: new Date('2026-05-15T12:00:00Z'),
      debtId: debt,
    });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    expect(stats.totalExpense).toBe(100000);
    expect(stats.expenseByCurrency.UZS).toBe(100000);
  });

  it('split returns do not shrink the unreturned-debts bucket', async () => {
    // Split scenario: groceries 100k, friend owes 35k and returns it in-period.
    // The return offsets the groceries category — and must NOT also be
    // subtracted from the unreturned-debts bucket (double-count).
    const sourceTxId = await seedExpense({
      ctx,
      amount: 100000,
      categoryId: 'groceries',
      date: IN_RANGE,
    });
    const splitDebt = await seedDebt({
      ctx,
      totalAmount: 35000,
      remainingAmount: 0,
      debtType: 'given',
      sourceTransactionId: sourceTxId,
      isClosed: true,
    });
    await seedDebtReturn({ ctx, amount: 35000, date: IN_RANGE, debtId: splitDebt });

    // Pure loan in the same period: debt_given 50k, nothing returned yet
    const loanTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'debt_given',
      date: IN_RANGE,
      isDebtRelated: true,
    });
    await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 50000,
      debtType: 'given',
      sourceTransactionId: loanTxId,
    });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    const groceries = stats.categoryBreakdown.find((c) => c.categoryId === 'groceries');
    expect(groceries?.amount).toBe(65000); // 100k − 35k split return

    const bucket = stats.categoryBreakdown.find(
      (c) => c.categoryId === UNRETURNED_DEBT_CATEGORY_ID,
    );
    expect(bucket?.amount).toBe(50000); // untouched by the split return

    expect(stats.totalExpense).toBe(115000); // 65k + 50k
  });

  it('subtracts pure-loan returns (and only them) from the unreturned-debts bucket', async () => {
    // Loan 50k given in-period, 20k of it returned in-period
    const loanTxId = await seedExpense({
      ctx,
      amount: 50000,
      categoryId: 'debt_given',
      date: IN_RANGE,
      isDebtRelated: true,
    });
    const loanDebt = await seedDebt({
      ctx,
      totalAmount: 50000,
      remainingAmount: 30000,
      debtType: 'given',
      sourceTransactionId: loanTxId,
    });
    await seedDebtReturn({ ctx, amount: 20000, date: IN_RANGE, debtId: loanDebt });

    const stats = await ctx.repository.getAnalyticsStats(ctx.userId, {
      startDate: RANGE_START,
      endDate: RANGE_END,
    });

    const bucket = stats.categoryBreakdown.find(
      (c) => c.categoryId === UNRETURNED_DEBT_CATEGORY_ID,
    );
    expect(bucket?.amount).toBe(30000); // 50k given − 20k loan return
    expect(stats.totalExpense).toBe(30000);
  });
});
