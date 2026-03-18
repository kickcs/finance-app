import { Debt } from '../../../domain/aggregates/debt';
import { DebtType } from '../../../domain/value-objects';
import { Money, Currency } from '../../../../../shared/domain/value-objects';
import { DebtOrmEntity } from '../typeorm/debt.orm-entity';

export class DebtMapper {
  static toDomain(ormEntity: DebtOrmEntity): Debt {
    const currency = Currency.create(ormEntity.currency);
    return Debt.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      totalAmount: Money.create(Number(ormEntity.totalAmount), currency),
      remainingAmount: Money.create(Number(ormEntity.remainingAmount), currency),
      monthlyPayment:
        ormEntity.monthlyPayment !== null
          ? Money.create(Number(ormEntity.monthlyPayment), currency)
          : null,
      nextPaymentDate: ormEntity.nextPaymentDate ? new Date(ormEntity.nextPaymentDate) : null,
      debtType: DebtType.create(ormEntity.debtType),
      personName: ormEntity.personName,
      accountId: ormEntity.accountId,
      transactionId: ormEntity.transactionId,
      closeTransactionId: ormEntity.closeTransactionId,
      isClosed: ormEntity.isClosed,
      sourceTransactionId: ormEntity.sourceTransactionId,
      createdAt: ormEntity.createdAt,
      description: ormEntity.description,
      closedAt: ormEntity.closedAt,
      forgivenAmount: Number(ormEntity.forgivenAmount),
      isPrivate: ormEntity.isPrivate,
    });
  }

  static toOrm(debt: Debt): DebtOrmEntity {
    const ormEntity = new DebtOrmEntity();
    ormEntity.id = debt.id;
    ormEntity.userId = debt.userId;
    ormEntity.name = debt.name;
    ormEntity.totalAmount = debt.totalAmountValue;
    ormEntity.remainingAmount = debt.remainingAmountValue;
    ormEntity.monthlyPayment = debt.monthlyPaymentValue;
    ormEntity.nextPaymentDate = debt.nextPaymentDate;
    ormEntity.debtType = debt.debtTypeValue;
    ormEntity.personName = debt.personName;
    ormEntity.accountId = debt.accountId;
    ormEntity.transactionId = debt.transactionId;
    ormEntity.closeTransactionId = debt.closeTransactionId;
    ormEntity.isClosed = debt.isClosed;
    ormEntity.currency = debt.currency;
    ormEntity.sourceTransactionId = debt.sourceTransactionId;
    ormEntity.createdAt = debt.createdAt;
    ormEntity.description = debt.description;
    ormEntity.closedAt = debt.closedAt;
    ormEntity.forgivenAmount = debt.forgivenAmount;
    ormEntity.isPrivate = debt.isPrivate;
    return ormEntity;
  }
}
