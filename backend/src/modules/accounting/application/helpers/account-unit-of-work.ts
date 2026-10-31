import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Account } from '../../domain/aggregates/account';
import type { IAccountRepository } from '../../domain/repositories/account.repository.interface';
import type { BalanceEffect } from '../../domain/services/balance-calculation.service';

/**
 * Счета одной транзакции БД: один экземпляр на счёт, иначе второе сохранение затрёт первое.
 * Чтения идут через менеджер транзакции, чтобы видеть её же записи.
 */
export class AccountUnitOfWork {
  private readonly accounts = new Map<string, Account>();
  private readonly changed = new Set<string>();

  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly manager: EntityManager,
    private readonly userId: string,
  ) {}

  /** Свой счёт; несуществующий — 404, чужой — 403. */
  async get(accountId: string): Promise<Account> {
    const cached = this.accounts.get(accountId);
    if (cached) return cached;

    const account = await this.accountRepository.findByIdWithBalances(accountId, this.manager);
    if (!account) throw new NotFoundException('Account not found');
    if (account.userId !== this.userId) {
      throw new ForbiddenException('Account does not belong to user');
    }
    this.accounts.set(accountId, account);
    return account;
  }

  /** Счёт, который вызывающий меняет: его сохранит `saveChanged`. */
  async getForChange(accountId: string): Promise<Account> {
    const account = await this.get(accountId);
    this.changed.add(accountId);
    return account;
  }

  async apply(deltas: BalanceEffect[]): Promise<void> {
    for (const { accountId, currency, delta } of deltas) {
      (await this.getForChange(accountId)).applyDelta(delta, currency);
    }
  }

  /** Только изменённые счета, по одному, последовательно: транзакция БД идёт по одному соединению. */
  async saveChanged(): Promise<Account[]> {
    const accounts = [...this.changed].map((id) => this.accounts.get(id)!);
    for (const account of accounts) {
      await this.accountRepository.save(account, this.manager);
    }
    return accounts;
  }
}
