import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetGoalsQuery } from './get-goals.query';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

@QueryHandler(GetGoalsQuery)
export class GetGoalsHandler implements IQueryHandler<GetGoalsQuery> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(query: GetGoalsQuery) {
    const goals = await this.goalRepository.findByUserId(query.userId);
    return goals.map((goal) => ({
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
    }));
  }
}
