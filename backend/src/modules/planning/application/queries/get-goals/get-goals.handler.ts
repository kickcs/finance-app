import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetGoalsQuery } from './get-goals.query';
import { IGoalRepository, GOAL_REPOSITORY } from '../../../domain/repositories';
import { GoalResponseMapper } from '../../mappers';

@QueryHandler(GetGoalsQuery)
export class GetGoalsHandler implements IQueryHandler<GetGoalsQuery> {
  constructor(
    @Inject(GOAL_REPOSITORY)
    private readonly goalRepository: IGoalRepository,
  ) {}

  async execute(query: GetGoalsQuery) {
    const goals = await this.goalRepository.findByUserId(query.userId);
    return GoalResponseMapper.toResponseList(goals);
  }
}
