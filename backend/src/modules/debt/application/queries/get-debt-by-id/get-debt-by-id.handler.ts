import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetDebtByIdQuery } from './get-debt-by-id.query';
import { IDebtRepository, DEBT_REPOSITORY } from '../../../domain/repositories';
import { DebtResponseMapper } from '../../mappers/debt-response.mapper';

@QueryHandler(GetDebtByIdQuery)
export class GetDebtByIdHandler implements IQueryHandler<GetDebtByIdQuery> {
  constructor(
    @Inject(DEBT_REPOSITORY)
    private readonly debtRepository: IDebtRepository,
  ) {}

  async execute(query: GetDebtByIdQuery) {
    const debt = await this.debtRepository.findById(query.id);

    if (!debt) {
      throw new NotFoundException(`Debt with id ${query.id} not found`);
    }

    if (debt.userId !== query.userId) {
      throw new ForbiddenException('Access denied');
    }

    return DebtResponseMapper.toResponse(debt);
  }
}
