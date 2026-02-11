import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetGoalByIdQuery } from './get-goal-by-id.query';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';

@QueryHandler(GetGoalByIdQuery)
export class GetGoalByIdHandler implements IQueryHandler<GetGoalByIdQuery> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(query: GetGoalByIdQuery) {
    const goal = await this.goalRepository.findById(query.id);

    if (!goal) {
      throw new NotFoundException(`Goal with id ${query.id} not found`);
    }

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
}
