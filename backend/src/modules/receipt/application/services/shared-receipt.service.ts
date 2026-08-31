import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { SharedReceiptOrmEntity } from '../../infrastructure/persistence/typeorm/shared-receipt.orm-entity';
import { generateUrlSafeToken } from '../../../../shared/utils/token';
import { getPublicAppUrl } from '../../../../shared/utils/share';

export interface SharedReceiptPayload {
  storeName: string | null;
  date: number;
  currency: string;
  totalAmount: number;
  subtotal: number;
  charges: { label: string; display: string }[];
  participants: {
    name: string;
    color: string;
    isMe: boolean;
    total: number;
    paidByName: string | null;
    items: { name: string; share: number; sharedWith: number; lineTotal: number }[];
  }[];
  paymentMethods: { label: string; value: string }[];
  ownerName: string | null;
}

export interface CreateSharedReceiptResult {
  token: string;
  url: string;
}

const TOKEN_LENGTH = 21;

@Injectable()
export class SharedReceiptService {
  constructor(
    @InjectRepository(SharedReceiptOrmEntity)
    private readonly repository: Repository<SharedReceiptOrmEntity>,
  ) {}

  async create(userId: string, payload: SharedReceiptPayload): Promise<CreateSharedReceiptResult> {
    const token = generateUrlSafeToken(TOKEN_LENGTH);

    const entity = this.repository.create({
      token,
      userId,
      payload,
    });
    await this.repository.save(entity);

    const url = `${getPublicAppUrl()}/r/${token}`;

    return { token, url };
  }

  async getByToken(token: string): Promise<SharedReceiptPayload> {
    const entity = await this.repository.findOne({ where: { token } });
    if (!entity) {
      throw new NotFoundException('Shared receipt not found');
    }
    return entity.payload;
  }
}
