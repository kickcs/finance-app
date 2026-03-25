import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Debt } from '../../../domain/aggregates/debt';
import {
  IDebtRepository,
  DebtPaginationOptions,
  PaginatedDebtGroups,
} from '../../../domain/repositories';
import { DebtOrmEntity } from '../typeorm/debt.orm-entity';
import { DebtMapper } from '../mappers/debt.mapper';

@Injectable()
export class DebtRepository implements IDebtRepository {
  constructor(
    @InjectRepository(DebtOrmEntity)
    private readonly ormRepository: Repository<DebtOrmEntity>,
  ) {}

  async findById(id: string): Promise<Debt | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return DebtMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Debt[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return ormEntities.map((entity) => DebtMapper.toDomain(entity));
  }

  async findByTransactionId(transactionId: string): Promise<Debt | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { transactionId },
    });
    if (!ormEntity) return null;
    return DebtMapper.toDomain(ormEntity);
  }

  async hasOpenDebtsForTransaction(transactionId: string): Promise<boolean> {
    const count = await this.ormRepository.count({
      where: [
        { sourceTransactionId: transactionId, isClosed: false },
        { transactionId: transactionId, isClosed: false },
      ],
    });
    return count > 0;
  }

  async save(debt: Debt): Promise<Debt> {
    const ormEntity = DebtMapper.toOrm(debt);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return DebtMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }

  async getPaginated(userId: string, options: DebtPaginationOptions): Promise<PaginatedDebtGroups> {
    const {
      pageSize,
      cursorPersonName,
      cursorDebtType,
      cursorCreatedAt,
      status,
      currency,
      personName,
    } = options;

    // 1. Get total summary (SUM of remainingAmount grouped by debtType and currency, excluding isPrivate)
    const summaryQuery = this.ormRepository
      .createQueryBuilder('d')
      .select('d.debtType', 'debtType')
      .addSelect('d.currency', 'currency')
      .addSelect('SUM(d.remainingAmount)', 'total')
      .where('d.userId = :userId', { userId })
      .andWhere('d.isPrivate = :isPrivate', { isPrivate: false })
      .andWhere('d.isClosed = :isClosed', { isClosed: false })
      .groupBy('d.debtType')
      .addGroupBy('d.currency');

    const summaryRows: Array<{ debtType: string; currency: string; total: string }> =
      await summaryQuery.getRawMany();

    const totalSummary: { totalGiven: Record<string, number>; totalTaken: Record<string, number> } =
      {
        totalGiven: {},
        totalTaken: {},
      };

    for (const row of summaryRows) {
      const amount = Number(row.total) || 0;
      if (row.debtType === 'given') {
        totalSummary.totalGiven[row.currency] =
          (totalSummary.totalGiven[row.currency] ?? 0) + amount;
      } else {
        totalSummary.totalTaken[row.currency] =
          (totalSummary.totalTaken[row.currency] ?? 0) + amount;
      }
    }

    // 2. Get total debts count
    const countQuery = this.ormRepository
      .createQueryBuilder('d')
      .where('d.userId = :userId', { userId });

    if (status === 'active') {
      countQuery.andWhere('d.isClosed = :isClosed', { isClosed: false });
    } else if (status === 'closed') {
      countQuery.andWhere('d.isClosed = :isClosed', { isClosed: true });
    }
    if (currency) {
      countQuery.andWhere('d.currency = :currency', { currency });
    }
    if (personName) {
      countQuery.andWhere('d.personName = :personName', { personName });
    }

    const totalDebtsCount = await countQuery.getCount();

    // 3. Get groups (personName + debtType) with MAX(createdAt) as lastDebtDate
    const groupsQuery = this.ormRepository
      .createQueryBuilder('d')
      .select('d.personName', 'personName')
      .addSelect('d.debtType', 'debtType')
      .addSelect('MAX(d.createdAt)', 'lastDebtDate')
      .where('d.userId = :userId', { userId })
      .groupBy('d.personName')
      .addGroupBy('d.debtType');

    if (status === 'active') {
      groupsQuery.andWhere('d.isClosed = :isClosed', { isClosed: false });
    } else if (status === 'closed') {
      groupsQuery.andWhere('d.isClosed = :isClosed', { isClosed: true });
    }
    if (currency) {
      groupsQuery.andWhere('d.currency = :currency', { currency });
    }
    if (personName) {
      groupsQuery.andWhere('d.personName = :personName', { personName });
    }

    // Cursor-based pagination using HAVING for aggregate
    if (cursorCreatedAt && cursorPersonName !== undefined && cursorDebtType) {
      groupsQuery.having(
        `(MAX(d.createdAt) < :cursorCreatedAt) OR ` +
          `(MAX(d.createdAt) = :cursorCreatedAt AND d.personName > :cursorPersonName) OR ` +
          `(MAX(d.createdAt) = :cursorCreatedAt AND d.personName = :cursorPersonName AND d.debtType > :cursorDebtType)`,
        {
          cursorCreatedAt: new Date(cursorCreatedAt),
          cursorPersonName,
          cursorDebtType,
        },
      );
    }

    groupsQuery
      .orderBy('"lastDebtDate"', 'DESC')
      .addOrderBy('d.personName', 'ASC')
      .addOrderBy('d.debtType', 'ASC')
      .limit(pageSize + 1);

    interface GroupRow {
      personName: string | null;
      debtType: string;
      lastDebtDate: string;
    }

    const groupRows: GroupRow[] = await groupsQuery.getRawMany();

    const hasMore = groupRows.length > pageSize;
    const paginatedGroups = groupRows.slice(0, pageSize);

    // 4. Fetch all debts for those groups
    const groups: Array<{
      personName: string;
      debtType: string;
      lastDebtDate: Date;
      debts: Debt[];
    }> = [];
    if (paginatedGroups.length > 0) {
      const debtsFetchQuery = this.ormRepository
        .createQueryBuilder('d')
        .where('d.userId = :userId', { userId });

      if (status === 'active') {
        debtsFetchQuery.andWhere('d.isClosed = :isClosed', { isClosed: false });
      } else if (status === 'closed') {
        debtsFetchQuery.andWhere('d.isClosed = :isClosed', { isClosed: true });
      }
      if (currency) {
        debtsFetchQuery.andWhere('d.currency = :currency', { currency });
      }

      // Build OR conditions for each group
      const groupConditions = paginatedGroups.map((g, i) => {
        const personParam = `gPersonName${i}`;
        const typeParam = `gDebtType${i}`;
        debtsFetchQuery.setParameter(personParam, g.personName);
        debtsFetchQuery.setParameter(typeParam, g.debtType);
        return `(d.personName = :${personParam} AND d.debtType = :${typeParam})`;
      });

      debtsFetchQuery.andWhere(`(${groupConditions.join(' OR ')})`);
      debtsFetchQuery.orderBy('d.createdAt', 'DESC');

      const allDebts = await debtsFetchQuery.getMany();

      // Group debts by personName + debtType
      const debtMap = new Map<string, DebtOrmEntity[]>();
      for (const debt of allDebts) {
        const key = `${debt.personName}::${debt.debtType}`;
        if (!debtMap.has(key)) {
          debtMap.set(key, []);
        }
        debtMap.get(key)!.push(debt);
      }

      for (const g of paginatedGroups) {
        const key = `${g.personName}::${g.debtType}`;
        const debts = (debtMap.get(key) ?? []).map((entity) => DebtMapper.toDomain(entity));
        groups.push({
          personName: g.personName ?? '',
          debtType: g.debtType,
          lastDebtDate: new Date(g.lastDebtDate),
          debts,
        });
      }
    }

    // 5. Build next cursor
    let nextCursor: { personName: string; debtType: string; createdAt: string } | null = null;
    if (hasMore && paginatedGroups.length > 0) {
      const lastGroup = paginatedGroups[paginatedGroups.length - 1];
      nextCursor = {
        personName: lastGroup.personName ?? '',
        debtType: lastGroup.debtType,
        createdAt: new Date(lastGroup.lastDebtDate).toISOString(),
      };
    }

    return {
      groups,
      totalSummary,
      nextCursor,
      hasMore,
      totalDebtsCount,
    };
  }
}
