import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetLinkStatusQuery } from './get-link-status.query';
import {
  type ITelegramLinkRepository,
  TELEGRAM_LINK_REPOSITORY,
} from '../../../domain/repositories/telegram-link.repository.interface';

@QueryHandler(GetLinkStatusQuery)
export class GetLinkStatusHandler implements IQueryHandler<GetLinkStatusQuery> {
  constructor(
    @Inject(TELEGRAM_LINK_REPOSITORY) private readonly linkRepo: ITelegramLinkRepository,
  ) {}

  async execute(
    query: GetLinkStatusQuery,
  ): Promise<{ linked: boolean; telegramUsername: string | null }> {
    const link = await this.linkRepo.findByUserId(query.userId);
    return { linked: Boolean(link), telegramUsername: link?.telegramUsername ?? null };
  }
}
