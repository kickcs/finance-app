import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetCardsQuery } from './get-cards.query';
import {
  CARD_MAPPING_REPOSITORY,
  type ICardMappingRepository,
} from '../../../domain/repositories/card-mapping.repository.interface';

@QueryHandler(GetCardsQuery)
export class GetCardsHandler implements IQueryHandler<GetCardsQuery> {
  constructor(@Inject(CARD_MAPPING_REPOSITORY) private readonly cardRepo: ICardMappingRepository) {}

  async execute(query: GetCardsQuery) {
    const cards = await this.cardRepo.listCards(query.userId);
    return {
      cards: cards.map((c) => ({
        cardMask: c.cardMask,
        accountId: c.accountId,
        lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
      })),
    };
  }
}
