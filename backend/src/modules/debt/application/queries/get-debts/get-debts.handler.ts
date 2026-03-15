import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetDebtsQuery } from './get-debts.query';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@QueryHandler(GetDebtsQuery)
export class GetDebtsHandler implements IQueryHandler<GetDebtsQuery> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(query: GetDebtsQuery) {
    const debts = await this.debtRepository.findByUserId(query.userId);
    return DebtResponseMapper.toResponseList(debts);
  }
}
