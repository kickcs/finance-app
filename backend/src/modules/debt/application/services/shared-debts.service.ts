import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SharedDebtsOrmEntity } from '../../infrastructure/persistence/typeorm/shared-debts.orm-entity';
import { generateUrlSafeToken } from '../../../../shared/utils/token';
import { getPublicAppUrl } from '../../../../shared/utils/share';

export interface SharedDebtEntry {
  /** Название долга — то, что видит владелец в списке. */
  title: string;
  /** `given` — человек должен владельцу ссылки, `taken` — наоборот. */
  direction: 'given' | 'taken';
  currency: string;
  totalAmount: number;
  remainingAmount: number;
  paidAmount: number;
  /** Прощённая часть — третья корзина рядом с отданным и остатком. */
  forgivenAmount: number;
  dueDate: string | null;
  createdAt: string;
}

export interface SharedDebtsPayload {
  personName: string;
  /** Валюта итога: суммы разных валют сводятся к ней по курсу на момент снимка. */
  currency: string;
  /** Нетто в валюте итога: > 0 — человек должен владельцу, < 0 — наоборот. */
  net: number;
  totalGiven: number;
  totalTaken: number;
  ownerName: string | null;
  /** Момент снимка: по ссылке видны долги на эту дату, а не текущие. */
  snapshotAt: number;
  debts: SharedDebtEntry[];
}

export interface CreateSharedDebtsResult {
  token: string;
  url: string;
}

const TOKEN_LENGTH = 21;

@Injectable()
export class SharedDebtsService {
  constructor(
    @InjectRepository(SharedDebtsOrmEntity)
    private readonly repository: Repository<SharedDebtsOrmEntity>,
  ) {}

  async create(userId: string, payload: SharedDebtsPayload): Promise<CreateSharedDebtsResult> {
    const token = generateUrlSafeToken(TOKEN_LENGTH);

    const entity = this.repository.create({ token, userId, payload });
    await this.repository.save(entity);

    return { token, url: `${getPublicAppUrl()}/d/${token}` };
  }

  async getByToken(token: string): Promise<SharedDebtsPayload> {
    const entity = await this.repository.findOne({ where: { token } });
    if (!entity) {
      throw new NotFoundException('Shared debts not found');
    }
    return entity.payload;
  }
}
