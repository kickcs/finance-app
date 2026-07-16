import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetInboxQuery } from './get-inbox.query';
import {
  type IImportedTransactionRepository,
  IMPORTED_TRANSACTION_REPOSITORY,
  type InboxItem,
} from '../../../domain/repositories/imported-transaction.repository.interface';

function toResponse(item: InboxItem) {
  return {
    id: item.id,
    type: item.type,
    amount: item.amount,
    currency: item.currency,
    merchant: item.merchant,
    cardMask: item.cardMask,
    occurredAt: item.occurredAt?.toISOString() ?? null,
    balanceAfter: item.balanceAfter,
    status: item.status,
    transactionId: item.transactionId,
    suggestedAccountId: item.suggestedAccountId,
    suggestedCategoryId: item.suggestedCategoryId,
    createdAt: item.createdAt.toISOString(),
  };
}

@QueryHandler(GetInboxQuery)
export class GetInboxHandler implements IQueryHandler<GetInboxQuery> {
  constructor(
    @Inject(IMPORTED_TRANSACTION_REPOSITORY)
    private readonly importedRepo: IImportedTransactionRepository,
  ) {}

  async execute(query: GetInboxQuery) {
    const items = await this.importedRepo.findPendingWithSuggestions(query.userId);
    return { items: items.map(toResponse), count: items.length };
  }
}
