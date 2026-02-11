import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  IAccountBalanceRepository,
  AccountBalanceData,
} from '../../../domain/repositories/account-balance.repository.interface';
import { AccountBalanceOrmEntity } from '../typeorm/account-balance.orm-entity';

@Injectable()
export class AccountBalanceRepository implements IAccountBalanceRepository {
  constructor(
    @InjectRepository(AccountBalanceOrmEntity)
    private readonly ormRepository: Repository<AccountBalanceOrmEntity>,
  ) {}

  async findByAccountId(accountId: string): Promise<AccountBalanceData[]> {
    const entities = await this.ormRepository.find({
      where: { accountId },
      order: { currency: 'ASC' },
    });

    return entities.map((e) => this.toData(e));
  }

  async findByAccountIds(accountIds: string[]): Promise<AccountBalanceData[]> {
    if (accountIds.length === 0) {
      return [];
    }

    const entities = await this.ormRepository.find({
      where: { accountId: In(accountIds) },
      order: { accountId: 'ASC', currency: 'ASC' },
    });

    return entities.map((e) => this.toData(e));
  }

  async findByAccountIdAndCurrency(
    accountId: string,
    currency: string,
  ): Promise<AccountBalanceData | null> {
    const entity = await this.ormRepository.findOne({
      where: { accountId, currency },
    });

    return entity ? this.toData(entity) : null;
  }

  async upsert(
    accountId: string,
    currency: string,
    balance: number,
  ): Promise<AccountBalanceData> {
    await this.ormRepository.upsert({ accountId, currency, balance }, [
      'accountId',
      'currency',
    ]);

    const entity = await this.ormRepository.findOne({
      where: { accountId, currency },
    });

    return this.toData(entity!);
  }

  async createMany(
    accountId: string,
    balances: { currency: string; balance: number }[],
  ): Promise<AccountBalanceData[]> {
    const entities = balances.map((b) => {
      const entity = new AccountBalanceOrmEntity();
      entity.accountId = accountId;
      entity.currency = b.currency;
      entity.balance = b.balance;
      return entity;
    });

    for (const entity of entities) {
      await this.ormRepository.upsert(
        {
          accountId: entity.accountId,
          currency: entity.currency,
          balance: entity.balance,
        },
        ['accountId', 'currency'],
      );
    }

    return this.findByAccountId(accountId);
  }

  async updateByDelta(
    accountId: string,
    currency: string,
    delta: number,
  ): Promise<AccountBalanceData | null> {
    const existing = await this.ormRepository.findOne({
      where: { accountId, currency },
    });

    if (!existing) {
      return null;
    }

    const newBalance = Number(existing.balance) + delta;
    await this.ormRepository.update(
      { accountId, currency },
      { balance: newBalance },
    );

    const updated = await this.ormRepository.findOne({
      where: { accountId, currency },
    });

    return updated ? this.toData(updated) : null;
  }

  async delete(accountId: string, currency: string): Promise<void> {
    await this.ormRepository.delete({ accountId, currency });
  }

  async deleteByAccountId(accountId: string): Promise<void> {
    await this.ormRepository.delete({ accountId });
  }

  private toData(entity: AccountBalanceOrmEntity): AccountBalanceData {
    return {
      id: entity.id,
      accountId: entity.accountId,
      currency: entity.currency,
      balance: Number(entity.balance),
      createdAt: entity.createdAt,
    };
  }
}
