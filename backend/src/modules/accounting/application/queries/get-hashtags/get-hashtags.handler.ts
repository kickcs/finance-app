import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetHashtagsQuery } from './get-hashtags.query';
import {
  ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../../../domain/repositories/transaction.repository.interface';

@QueryHandler(GetHashtagsQuery)
export class GetHashtagsHandler implements IQueryHandler<GetHashtagsQuery> {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(query: GetHashtagsQuery) {
    return this.transactionRepository.getHashtags(query.userId);
  }
}
