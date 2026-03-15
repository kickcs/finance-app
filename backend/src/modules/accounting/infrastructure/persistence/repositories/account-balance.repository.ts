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

  async upsert(accountId: string, currency: string, balance: number): Promise<AccountBalanceData> {
    await this.ormRepository.upsert({ accountId, currency, balance }, ['accountId', 'currency']);

    const entity = await this.ormRepository.findOne({
      where: { accountId, currency },
    });

    return this.toData(entity!);
  }

  async createMany(
    accountId: string,
    balances: { currency: string; balance: number }[],
  ): Promise<AccountBalanceData[]> {
    if (balances.length === 0) {
      return this.findByAccountId(accountId);
    }

    const records = balances.map((b) => ({
      accountId,
      currency: b.currency,
      balance: b.balance,
    }));

    await this.ormRepository.upsert(records, ['accountId', 'currency']);

    return this.findByAccountId(accountId);
  }

  async updateByDelta(
    accountId: string,
    currency: string,
    delta: number,
  ): Promise<AccountBalanceData | null> {
    // Atomic update to avoid race conditions
    const result = await this.ormRepository
      .createQueryBuilder()
      .update(AccountBalanceOrmEntity)
      .set({ balance: () => `balance + :delta` })
      .where('accountId = :accountId AND currency = :currency', { accountId, currency, delta })
      .returning('*')
      .execute();

    const rows = result.raw as Array<{
      id: string;
      account_id: string;
      currency: string;
      balance: string;
      created_at: Date;
    }>;
    const raw = rows[0];
    if (!raw) {
      return null;
    }

    return {
      id: raw.id,
      accountId: raw.account_id,
      currency: raw.currency,
      balance: Number(raw.balance),
      createdAt: raw.created_at,
    };
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
