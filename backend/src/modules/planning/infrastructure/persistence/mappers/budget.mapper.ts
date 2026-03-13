import { Budget } from '../../../domain/aggregates/budget';
import { BudgetOrmEntity } from '../typeorm/budget.orm-entity';

export class BudgetMapper {
  static toDomain(ormEntity: BudgetOrmEntity): Budget {
    return Budget.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      year: ormEntity.year,
      month: ormEntity.month,
      amount: Number(ormEntity.amount),
      currency: ormEntity.currency,
      isDefault: ormEntity.isDefault,
      createdAt: ormEntity.createdAt,
      updatedAt: ormEntity.updatedAt,
    });
  }

  static toOrm(budget: Budget): BudgetOrmEntity {
    const ormEntity = new BudgetOrmEntity();
    ormEntity.id = budget.id;
    ormEntity.userId = budget.userId;
    ormEntity.year = budget.year;
    ormEntity.month = budget.month;
    ormEntity.amount = budget.amount;
    ormEntity.currency = budget.currency;
    ormEntity.isDefault = budget.isDefault;
    ormEntity.createdAt = budget.createdAt;
    ormEntity.updatedAt = budget.updatedAt;
    return ormEntity;
  }
}
