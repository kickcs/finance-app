import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportedTransactionOrmEntity } from '../typeorm';
import {
  IImportedTransactionRepository,
  ImportedTransactionCreate,
  InboxItem,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import { ImportedTransaction } from '../../../domain/models';

function toDomain(orm: ImportedTransactionOrmEntity): ImportedTransaction {
  return {
    ...orm,
    amount: orm.amount === null ? null : Number(orm.amount),
    balanceAfter: orm.balanceAfter === null ? null : Number(orm.balanceAfter),
  };
}

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ImportedTransactionRepository implements IImportedTransactionRepository {
  constructor(
    @InjectRepository(ImportedTransactionOrmEntity)
    private readonly repo: Repository<ImportedTransactionOrmEntity>,
  ) {}

  async insertIfNew(data: ImportedTransactionCreate): Promise<ImportedTransaction | null> {
    try {
      const saved = await this.repo.save(
        this.repo.create({
          ...data,
          amount: data.amount === null ? null : data.amount.toFixed(2),
          balanceAfter: data.balanceAfter === null ? null : data.balanceAfter.toFixed(2),
        }),
      );
      return toDomain(saved);
    } catch (error: unknown) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) return null;
      throw error;
    }
  }

  async findById(id: string): Promise<ImportedTransaction | null> {
    const orm = await this.repo.findOne({ where: { id } });
    return orm ? toDomain(orm) : null;
  }

  async findPendingWithSuggestions(userId: string): Promise<InboxItem[]> {
    const rows = await this.repo
      .createQueryBuilder('it')
      .leftJoin(
        'card_account_mappings',
        'cm',
        'cm.user_id = it.user_id AND cm.card_mask = it.card_mask',
      )
      .addSelect('cm.account_id', 'suggested_account_id')
      .where('it.userId = :userId', { userId })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere("it.type != 'unparsed'")
      .orderBy('it.occurredAt', 'DESC')
      .getRawAndEntities();

    return rows.entities.map((orm, i) => ({
      ...toDomain(orm),
      suggestedAccountId: (rows.raw[i] as { suggested_account_id: string | null })
        .suggested_account_id,
    }));
  }

  async countPending(userId: string): Promise<number> {
    const total = await this.repo.count({ where: { userId, status: 'pending' } });
    const unparsed = await this.repo.count({
      where: { userId, status: 'pending', type: 'unparsed' },
    });
    return total - unparsed;
  }

  async markConfirmed(id: string, transactionId: string): Promise<void> {
    await this.repo.update(id, { status: 'confirmed', transactionId });
  }

  async markDismissed(id: string): Promise<void> {
    await this.repo.update(id, { status: 'dismissed' });
  }

  async findLatestBalance(userId: string, cardMask: string, before: Date): Promise<number | null> {
    const row = await this.repo
      .createQueryBuilder('it')
      .where('it.userId = :userId', { userId })
      .andWhere('it.cardMask = :cardMask', { cardMask })
      .andWhere('it.balanceAfter IS NOT NULL')
      .andWhere('it.occurredAt < :before', { before })
      .orderBy('it.occurredAt', 'DESC')
      .getOne();
    return row?.balanceAfter !== null && row?.balanceAfter !== undefined
      ? Number(row.balanceAfter)
      : null;
  }

  async findTransferCounterpart(params: {
    userId: string;
    oppositeType: 'expense' | 'income';
    amount: number;
    occurredAt: Date;
    counterAccountId: string;
    excludeId: string;
  }): Promise<ImportedTransaction | null> {
    const windowMs = 15 * 60 * 1000;
    const from = new Date(params.occurredAt.getTime() - windowMs);
    const to = new Date(params.occurredAt.getTime() + windowMs);
    const orm = await this.repo
      .createQueryBuilder('it')
      .innerJoin(
        'card_account_mappings',
        'cm',
        'cm.user_id = it.user_id AND cm.card_mask = it.card_mask AND cm.account_id = :counterAccountId',
        { counterAccountId: params.counterAccountId },
      )
      .where('it.userId = :userId', { userId: params.userId })
      .andWhere('it.id != :excludeId', { excludeId: params.excludeId })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere('it.type = :type', { type: params.oppositeType })
      .andWhere('it.amount = :amount', { amount: params.amount.toFixed(2) })
      .andWhere('it.occurredAt BETWEEN :from AND :to', { from, to })
      .getOne();
    return orm ? toDomain(orm) : null;
  }
}
