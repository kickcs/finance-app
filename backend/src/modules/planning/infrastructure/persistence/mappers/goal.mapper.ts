import { Goal } from '../../../domain/aggregates/goal';
import { GoalOrmEntity } from '../typeorm/goal.orm-entity';

export class GoalMapper {
  static toDomain(ormEntity: GoalOrmEntity): Goal {
    return Goal.reconstitute({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      targetAmount: Number(ormEntity.targetAmount),
      currentAmount: Number(ormEntity.currentAmount),
      deadline: ormEntity.deadline,
      icon: ormEntity.icon,
      color: ormEntity.color,
      createdAt: ormEntity.createdAt,
    });
  }

  static toOrm(goal: Goal): GoalOrmEntity {
    const ormEntity = new GoalOrmEntity();
    ormEntity.id = goal.id;
    ormEntity.userId = goal.userId;
    ormEntity.name = goal.name;
    ormEntity.targetAmount = goal.targetAmount;
    ormEntity.currentAmount = goal.currentAmount;
    ormEntity.deadline = goal.deadline;
    ormEntity.icon = goal.icon;
    ormEntity.color = goal.color;
    ormEntity.createdAt = goal.createdAt;
    return ormEntity;
  }
}
