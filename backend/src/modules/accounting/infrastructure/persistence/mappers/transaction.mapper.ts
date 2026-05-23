import { Transaction } from '../../../domain/aggregates/transaction';
import { TransactionType } from '../../../domain/value-objects';
import { Money } from '../../../../../shared/domain/value-objects';
import { TransactionOrmEntity } from '../typeorm/transaction.orm-entity';

export class TransactionMapper {
  static toDomain(ormEntity: TransactionOrmEntity): Transaction {
    return Transaction.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      accountId: ormEntity.accountId,
      categoryId: ormEntity.categoryId,
      amount: Money.create(Number(ormEntity.amount), ormEntity.currency),
      type: TransactionType.create(ormEntity.type),
      description: ormEntity.description,
      date: ormEntity.date,
      isDebtRelated: ormEntity.isDebtRelated,
      isInformational: ormEntity.isInformational,
      debtId: ormEntity.debtId,
      toAccountId: ormEntity.toAccountId,
      toAmount:
        ormEntity.toAmount !== null && ormEntity.toCurrency !== null
          ? Money.create(Number(ormEntity.toAmount), ormEntity.toCurrency)
          : null,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(transaction: Transaction): TransactionOrmEntity {
    const ormEntity = new TransactionOrmEntity();

    ormEntity.id = transaction.id;
    ormEntity.userId = transaction.userId;
    ormEntity.accountId = transaction.accountId;
    ormEntity.categoryId = transaction.categoryId;
    ormEntity.amount = transaction.amountValue;
    ormEntity.currency = transaction.currency;
    ormEntity.type = transaction.typeValue;
    ormEntity.description = transaction.description;
    ormEntity.date = transaction.date;
    ormEntity.isDebtRelated = transaction.isDebtRelated;
    ormEntity.isInformational = transaction.isInformational;
    ormEntity.debtId = transaction.debtId;
    ormEntity.toAccountId = transaction.toAccountId;
    ormEntity.toAmount = transaction.toAmountValue;
    ormEntity.toCurrency = transaction.toCurrency;
    ormEntity.createdAt = transaction.createdAt;

    return ormEntity;
  }
}
