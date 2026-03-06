import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetTransactionByIdQuery } from './get-transaction-by-id.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';
import { toTransactionResponse } from '../../helpers/to-transaction-response';

@QueryHandler(GetTransactionByIdQuery)
export class GetTransactionByIdHandler implements IQueryHandler<GetTransactionByIdQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetTransactionByIdQuery) {
    const transaction = await this.transactionRepository.findById(query.id);

    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${query.id} not found`);
    }

    if (transaction.userId !== query.userId) {
      throw new NotFoundException(`Transaction with id ${query.id} not found`);
    }

    return toTransactionResponse(transaction);
  }
}
