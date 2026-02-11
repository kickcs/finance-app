import { Category } from '../../../domain/aggregates/category';
import { CategoryType } from '../../../domain/value-objects';
import { CategoryOrmEntity } from '../typeorm/category.orm-entity';

export class CategoryMapper {
  static toDomain(ormEntity: CategoryOrmEntity): Category {
    return Category.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      icon: ormEntity.icon,
      color: ormEntity.color,
      type: CategoryType.create(ormEntity.type),
      sortOrder: ormEntity.sortOrder,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(category: Category): CategoryOrmEntity {
    const ormEntity = new CategoryOrmEntity();

    ormEntity.id = category.id;
    ormEntity.userId = category.userId;
    ormEntity.name = category.name;
    ormEntity.icon = category.icon;
    ormEntity.color = category.color;
    ormEntity.type = category.typeValue;
    ormEntity.sortOrder = category.sortOrder;
    ormEntity.createdAt = category.createdAt;

    return ormEntity;
  }
}
