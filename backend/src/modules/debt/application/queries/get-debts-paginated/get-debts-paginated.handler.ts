import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDebtsPaginatedQuery } from './get-debts-paginated.query';
import {
  IDebtRepository,
  DEBT_REPOSITORY,
} from '../../../domain/repositories/debt.repository.interface';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@QueryHandler(GetDebtsPaginatedQuery)
export class GetDebtsPaginatedHandler implements IQueryHandler<GetDebtsPaginatedQuery> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(query: GetDebtsPaginatedQuery) {
    const result = await this.debtRepository.getPaginated(query.userId, {
      pageSize: query.pageSize,
      cursorPersonName: query.cursorPersonName,
      cursorDebtType: query.cursorDebtType,
      cursorCreatedAt: query.cursorCreatedAt,
      status: query.status,
      currency: query.currency,
      personName: query.personName,
    });

    return {
      groups: result.groups.map((group) => ({
        personName: group.personName,
        debtType: group.debtType,
        debts: DebtResponseMapper.toResponseList(group.debts),
      })),
      totalSummary: result.totalSummary,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      totalDebtsCount: result.totalDebtsCount,
    };
  }
}
