import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../../../domain/aggregates/account';
import { IAccountRepository } from '../../../domain/repositories/account.repository.interface';
import { AccountOrmEntity } from '../typeorm/account.orm-entity';
import { AccountBalanceOrmEntity } from '../typeorm/account-balance.orm-entity';
import { AccountMapper } from '../mappers/account.mapper';

@Injectable()
export class AccountRepository implements IAccountRepository {
  constructor(
    @InjectRepository(AccountOrmEntity)
    private readonly ormRepository: Repository<AccountOrmEntity>,
    @InjectRepository(AccountBalanceOrmEntity)
    private readonly balanceOrmRepository: Repository<AccountBalanceOrmEntity>,
  ) {}

  async findById(id: string): Promise<Account | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id },
    });

    if (!ormEntity) {
      return null;
    }

    return AccountMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { order: 'ASC', createdAt: 'ASC' },
    });

    return ormEntities.map((entity) => AccountMapper.toDomain(entity));
  }

  async findByIdWithBalances(id: string): Promise<Account | null> {
    const ormEntity = await this.ormRepository.findOne({
      where: { id },
      relations: ['balances'],
    });

    if (!ormEntity) {
      return null;
    }

    return AccountMapper.toDomain(ormEntity);
  }

  async findAllWithBalances(userId: string): Promise<Account[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      relations: ['balances'],
      order: { order: 'ASC', createdAt: 'ASC' },
    });

    return ormEntities.map((entity) => AccountMapper.toDomain(entity));
  }

  async save(account: Account): Promise<Account> {
    const ormEntity = AccountMapper.toOrm(account);

    // Save account first
    await this.ormRepository.save({
      id: ormEntity.id,
      userId: ormEntity.userId,
      name: ormEntity.name,
      balance: ormEntity.balance,
      currency: ormEntity.currency,
      icon: ormEntity.icon,
      color: ormEntity.color,
      type: ormEntity.type,
      order: ormEntity.order,
      creditLimit: ormEntity.creditLimit,
      gracePeriodDays: ormEntity.gracePeriodDays,
      billingDay: ormEntity.billingDay,
      totalAmount: ormEntity.totalAmount,
      interestRate: ormEntity.interestRate,
      monthlyPayment: ormEntity.monthlyPayment,
      startDate: ormEntity.startDate,
      endDate: ormEntity.endDate,
      maturityDate: ormEntity.maturityDate,
      isReplenishable: ormEntity.isReplenishable,
      isWithdrawable: ormEntity.isWithdrawable,
    });

    // Only upsert balances if they are present
    if (ormEntity.balances?.length > 0) {
      const balanceRecords = ormEntity.balances.map((balance) => ({
        id: balance.id,
        accountId: ormEntity.id,
        currency: balance.currency,
        balance: balance.balance,
      }));
      await this.balanceOrmRepository.upsert(balanceRecords, ['accountId', 'currency']);
    }

    // Return the domain object directly instead of re-fetching from DB
    return account;
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }

  async existsForUser(id: string, userId: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id, userId } });
    return count > 0;
  }

  async updateOrder(accountIds: string[]): Promise<void> {
    if (accountIds.length === 0) return;

    // Batch update using a single query with CASE WHEN
    const whenClauses = accountIds
      .map((_, index) => `WHEN id = $${index + 1} THEN ${index}`)
      .join(' ');

    await this.ormRepository.query(
      `UPDATE "accounts" SET "order" = CASE ${whenClauses} END WHERE "id" IN (${accountIds.map((_, i) => `$${i + 1}`).join(', ')})`,
      accountIds,
    );
  }
}
