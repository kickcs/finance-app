import { Goal } from '../../domain/aggregates/goal';

export class GoalResponseMapper {
  static toResponse(goal: Goal) {
    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline,
      icon: goal.icon,
      color: goal.color,
      progress: goal.progress,
      isCompleted: goal.isCompleted,
      createdAt: goal.createdAt,
    };
  }

  static toResponseList(goals: Goal[]) {
    return goals.map((goal) => GoalResponseMapper.toResponse(goal));
  }
}
