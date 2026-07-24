import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { ImportedTransactionOrmEntity } from '../typeorm';
import {
  IImportedTransactionRepository,
  ImportedTransactionCreate,
  InboxItem,
} from '../../../domain/repositories/imported-transaction.repository.interface';
import { ImportedTransaction } from '../../../domain/models';
import {
  buildCategorySuggestionMap,
  CATEGORY_SUGGESTION_MIN_COUNT,
  suggestionKey,
  MerchantCategoryRow,
} from '../../../domain/category-suggestion';

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
          status: data.status ?? 'pending',
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

    const merchants = [
      ...new Set(
        rows.entities.map((e) => e.merchant).filter((m): m is string => m !== null && m !== ''),
      ),
    ];
    const categorySuggestions = await this.findCategorySuggestions(userId, merchants);

    return rows.entities.map((orm, i) => ({
      ...toDomain(orm),
      suggestedAccountId: (rows.raw[i] as { suggested_account_id: string | null })
        .suggested_account_id,
      // здесь проверяется тип ИМПОРТА (не транзакции, как в SQL-фильтре ниже):
      // balance_change не маппится на тип транзакции до ввода суммы → без подсказки
      suggestedCategoryId:
        orm.merchant && (orm.type === 'expense' || orm.type === 'income')
          ? (categorySuggestions.get(suggestionKey(orm.merchant, orm.type)) ?? null)
          : null,
    }));
  }

  /**
   * Персональная история «мерчант → категория» по подтверждённым импортам.
   * Живые transactions (не снапшот) — правки категории задним числом учитываются.
   * Один запрос на все мерчанты инбокса; порог CATEGORY_SUGGESTION_MIN_COUNT в HAVING.
   */
  private async findCategorySuggestions(
    userId: string,
    merchants: string[],
  ): Promise<Map<string, string>> {
    if (merchants.length === 0) return new Map();
    const raw = await this.repo
      .createQueryBuilder('it')
      .select('it.merchant', 'merchant')
      .addSelect('t.type', 'type')
      .addSelect('t.category_id', 'categoryId')
      .addSelect('COUNT(*)', 'cnt')
      .innerJoin('transactions', 't', 't.id = it.transaction_id')
      .where('it.userId = :userId', { userId })
      .andWhere("it.status = 'confirmed'")
      .andWhere('it.merchant IN (:...merchants)', { merchants })
      .andWhere("t.type IN ('expense', 'income')")
      .groupBy('it.merchant')
      .addGroupBy('t.type')
      .addGroupBy('t.category_id')
      .having('COUNT(*) >= :minCount', { minCount: CATEGORY_SUGGESTION_MIN_COUNT })
      .getRawMany<{ merchant: string; type: string; categoryId: string; cnt: string }>();

    return buildCategorySuggestionMap(
      raw.map(
        (r): MerchantCategoryRow => ({
          merchant: r.merchant,
          type: r.type as MerchantCategoryRow['type'],
          categoryId: r.categoryId,
          cnt: Number(r.cnt),
        }),
      ),
    );
  }

  async countPending(userId: string): Promise<number> {
    return this.repo.count({ where: { userId, status: 'pending', type: Not('unparsed') } });
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

  async findLatestPendingExpenseByCard(
    userId: string,
    cardMask: string,
    before: Date,
  ): Promise<ImportedTransaction | null> {
    const orm = await this.repo
      .createQueryBuilder('it')
      .where('it.userId = :userId', { userId })
      .andWhere('it.cardMask = :cardMask', { cardMask })
      .andWhere('it.type = :type', { type: 'expense' })
      .andWhere('it.status = :status', { status: 'pending' })
      .andWhere('it.amount IS NOT NULL')
      .andWhere('it.occurredAt <= :before', { before })
      .orderBy('it.occurredAt', 'DESC')
      .getOne();
    return orm ? toDomain(orm) : null;
  }

  async decreaseAmount(id: string, delta: number): Promise<void> {
    const orm = await this.repo.findOne({ where: { id } });
    if (!orm || orm.amount === null) return;
    const next = Math.max(0, Math.round((Number(orm.amount) - delta) * 100) / 100);
    await this.repo.update(id, { amount: next.toFixed(2) });
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
      // точное сравнение корректно: колонка numeric(18,2), записи тоже идут через toFixed(2)
      .andWhere('it.amount = :amount', { amount: params.amount.toFixed(2) })
      .andWhere('it.occurredAt BETWEEN :from AND :to', { from, to })
      .getOne();
    return orm ? toDomain(orm) : null;
  }
}
