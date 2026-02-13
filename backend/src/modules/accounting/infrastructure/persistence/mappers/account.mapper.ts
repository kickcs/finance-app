import { Account, AccountBalance } from '../../../domain/aggregates/account';
import { AccountType } from '../../../domain/value-objects';
import { Currency, Money } from '../../../../../shared/domain/value-objects';
import { AccountOrmEntity } from '../typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../typeorm/account-balance.orm-entity';

export class AccountMapper {
  static toDomain(ormEntity: AccountOrmEntity): Account {
    const balances = (ormEntity.balances || []).map((b) =>
      AccountBalance.reconstitute({
        id: b.id,
        accountId: b.accountId,
        currency: Currency.create(b.currency),
        balance: Money.create(Number(b.balance), b.currency),
        createdAt: b.createdAt,
      }),
    );

    return Account.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      icon: ormEntity.icon,
      color: ormEntity.color,
      type: AccountType.create(ormEntity.type),
      order: ormEntity.order,
      balances,
      createdAt: ormEntity.createdAt,
      creditLimit: ormEntity.creditLimit != null ? Number(ormEntity.creditLimit) : null,
      gracePeriodDays: ormEntity.gracePeriodDays,
      billingDay: ormEntity.billingDay,
      totalAmount: ormEntity.totalAmount != null ? Number(ormEntity.totalAmount) : null,
      interestRate: ormEntity.interestRate != null ? Number(ormEntity.interestRate) : null,
      monthlyPayment: ormEntity.monthlyPayment != null ? Number(ormEntity.monthlyPayment) : null,
      startDate: ormEntity.startDate,
      endDate: ormEntity.endDate,
      maturityDate: ormEntity.maturityDate,
      isReplenishable: ormEntity.isReplenishable,
      isWithdrawable: ormEntity.isWithdrawable,
    });
  }

  static toOrm(account: Account): AccountOrmEntity {
    const ormEntity = new AccountOrmEntity();

    ormEntity.id = account.id;
    ormEntity.userId = account.userId;
    ormEntity.name = account.name;
    ormEntity.icon = account.icon;
    ormEntity.color = account.color;
    ormEntity.type = account.typeValue;
    ormEntity.order = account.order;
    ormEntity.createdAt = account.createdAt;

    // Calculate primary balance/currency from balances
    const primaryBalance = account.balances[0];
    ormEntity.balance = primaryBalance?.balanceAmount ?? 0;
    ormEntity.currency = primaryBalance?.currencyCode ?? 'USD';

    // Type-specific fields
    ormEntity.creditLimit = account.creditLimit;
    ormEntity.gracePeriodDays = account.gracePeriodDays;
    ormEntity.billingDay = account.billingDay;
    ormEntity.totalAmount = account.totalAmount;
    ormEntity.interestRate = account.interestRate;
    ormEntity.monthlyPayment = account.monthlyPayment;
    ormEntity.startDate = account.startDate;
    ormEntity.endDate = account.endDate;
    ormEntity.maturityDate = account.maturityDate;
    ormEntity.isReplenishable = account.isReplenishable;
    ormEntity.isWithdrawable = account.isWithdrawable;

    // Map balances
    ormEntity.balances = account.balances.map((b) => {
      const balanceOrm = new AccountBalanceOrmEntity();
      balanceOrm.id = b.id;
      balanceOrm.accountId = account.id;
      balanceOrm.currency = b.currencyCode;
      balanceOrm.balance = b.balanceAmount;
      balanceOrm.createdAt = b.createdAt;
      return balanceOrm;
    });

    return ormEntity;
  }
}
