import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { TelegramLinkTokenOrmEntity } from '../typeorm';
import { ILinkTokenRepository } from '../../../domain/repositories/link-token.repository.interface';

@Injectable()
export class LinkTokenRepository implements ILinkTokenRepository {
  constructor(
    @InjectRepository(TelegramLinkTokenOrmEntity)
    private readonly repo: Repository<TelegramLinkTokenOrmEntity>,
  ) {}

  async create(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.repo.save(this.repo.create({ userId, token, expiresAt }));
  }

  async consume(token: string): Promise<string | null> {
    const row = await this.repo.findOne({
      where: { token, usedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!row) return null;
    await this.repo.update(row.id, { usedAt: new Date() });
    return row.userId;
  }
}
