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
    const savedAccount = await this.ormRepository.save({
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

    // Upsert balances
    if (ormEntity.balances && ormEntity.balances.length > 0) {
      for (const balance of ormEntity.balances) {
        await this.balanceOrmRepository.upsert(
          {
            id: balance.id,
            accountId: savedAccount.id,
            currency: balance.currency,
            balance: balance.balance,
          },
          ['accountId', 'currency'],
        );
      }
    }

    // Return with balances
    const result = await this.findByIdWithBalances(savedAccount.id);
    return result!;
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }

  async updateOrder(accountIds: string[]): Promise<void> {
    await Promise.all(
      accountIds.map((id, index) =>
        this.ormRepository.update(id, { order: index }),
      ),
    );
  }
}
