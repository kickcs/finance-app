import { QuickAction } from '../../../domain/aggregates/quick-action';
import { QuickActionOrmEntity } from '../typeorm/quick-action.orm-entity';

export class QuickActionMapper {
  static toDomain(orm: QuickActionOrmEntity): QuickAction {
    return QuickAction.reconstitute({
      id: orm.id,
      userId: orm.userId,
      categoryId: orm.categoryId,
      accountId: orm.accountId,
      label: orm.label,
      position: orm.position,
      amount: orm.amount !== null ? parseFloat(orm.amount) : null,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    });
  }

  static toOrm(domain: QuickAction): QuickActionOrmEntity {
    const orm = new QuickActionOrmEntity();
    orm.id = domain.id;
    orm.userId = domain.userId;
    orm.categoryId = domain.categoryId;
    orm.accountId = domain.accountId;
    orm.label = domain.label;
    orm.position = domain.position;
    orm.amount = domain.amount !== null ? domain.amount.toString() : null;
    orm.createdAt = domain.createdAt;
    orm.updatedAt = domain.updatedAt;
    return orm;
  }
}
