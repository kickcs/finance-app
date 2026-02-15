import type { Account } from '../../domain/aggregates/account';

export function toAccountResponse(account: Account) {
  return {
    id: account.id,
    userId: account.userId,
    name: account.name,
    icon: account.icon,
    color: account.color,
    type: account.typeValue,
    order: account.order,
    balances: account.balances.map((b) => ({
      id: b.id,
      currency: b.currencyCode,
      balance: b.balanceAmount,
    })),
    createdAt: account.createdAt,
    creditLimit: account.creditLimit,
    gracePeriodDays: account.gracePeriodDays,
    billingDay: account.billingDay,
    totalAmount: account.totalAmount,
    interestRate: account.interestRate,
    monthlyPayment: account.monthlyPayment,
    startDate: account.startDate,
    endDate: account.endDate,
    maturityDate: account.maturityDate,
    isReplenishable: account.isReplenishable,
    isWithdrawable: account.isWithdrawable,
  };
}
