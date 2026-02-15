import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetGoalByIdQuery } from './get-goal-by-id.query';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';
import { GoalResponseMapper } from '../../mappers';

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

    if (goal.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    return GoalResponseMapper.toResponse(goal);
  }
}
