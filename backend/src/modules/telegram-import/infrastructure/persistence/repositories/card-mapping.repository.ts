import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardAccountMappingOrmEntity, ImportedTransactionOrmEntity } from '../typeorm';
import { ICardMappingRepository } from '../../../domain/repositories/card-mapping.repository.interface';
import { CardAccountMapping, CardWithMapping } from '../../../domain/models';

@Injectable()
export class CardMappingRepository implements ICardMappingRepository {
  constructor(
    @InjectRepository(CardAccountMappingOrmEntity)
    private readonly repo: Repository<CardAccountMappingOrmEntity>,
    @InjectRepository(ImportedTransactionOrmEntity)
    private readonly importedRepo: Repository<ImportedTransactionOrmEntity>,
  ) {}

  async findByUserAndCard(userId: string, cardMask: string): Promise<CardAccountMapping | null> {
    return this.repo.findOne({ where: { userId, cardMask } });
  }

  async upsert(mapping: CardAccountMapping): Promise<void> {
    await this.repo.upsert(
      { userId: mapping.userId, cardMask: mapping.cardMask, accountId: mapping.accountId },
      ['userId', 'cardMask'],
    );
  }

  async delete(userId: string, cardMask: string): Promise<void> {
    await this.repo.delete({ userId, cardMask });
  }

  async listCards(userId: string): Promise<CardWithMapping[]> {
    const rows: Array<{
      card_mask: string;
      account_id: string | null;
      last_seen_at: string | null;
    }> = await this.importedRepo.query(
      `SELECT seen.card_mask, cm.account_id, seen.last_seen_at
         FROM (
           SELECT card_mask, MAX(occurred_at) AS last_seen_at
           FROM imported_transactions
           WHERE user_id = $1 AND card_mask IS NOT NULL
           GROUP BY card_mask
           UNION
           SELECT card_mask, NULL FROM card_account_mappings WHERE user_id = $1
         ) seen
         LEFT JOIN card_account_mappings cm ON cm.user_id = $1 AND cm.card_mask = seen.card_mask
         GROUP BY seen.card_mask, cm.account_id, seen.last_seen_at
         ORDER BY seen.last_seen_at DESC NULLS LAST`,
      [userId],
    );
    // UNION может дать дубль карты (одна строка с датой, одна без) — схлопываем, предпочитая строку с датой
    const byCard = new Map<string, CardWithMapping>();
    for (const r of rows) {
      const existing = byCard.get(r.card_mask);
      const candidate: CardWithMapping = {
        cardMask: r.card_mask,
        accountId: r.account_id,
        lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at) : null,
      };
      if (!existing || (candidate.lastSeenAt && !existing.lastSeenAt))
        byCard.set(r.card_mask, candidate);
    }
    return [...byCard.values()];
  }
}
