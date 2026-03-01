import { Inject } from '@nestjs/common';
import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { GetQuickActionsQuery } from './get-quick-actions.query';
import {
  QUICK_ACTION_REPOSITORY,
  type IQuickActionRepository,
} from '../../../domain/repositories/quick-action.repository.interface';
import { toQuickActionResponse } from '../../commands/quick-action-response';

@QueryHandler(GetQuickActionsQuery)
export class GetQuickActionsHandler implements IQueryHandler<GetQuickActionsQuery> {
  constructor(
    @Inject(QUICK_ACTION_REPOSITORY)
    private readonly quickActionRepository: IQuickActionRepository,
  ) {}

  async execute(query: GetQuickActionsQuery) {
    const actions = await this.quickActionRepository.findByUserId(query.userId);
    return actions.map(toQuickActionResponse);
  }
}
