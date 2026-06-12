import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const result = await this.repo
      .createQueryBuilder()
      .update()
      .set({ usedAt: () => 'now()' })
      .where('token = :token AND used_at IS NULL AND expires_at > now()', { token })
      .returning('user_id')
      .execute();
    return (result.raw as Array<{ user_id: string }>)[0]?.user_id ?? null;
  }
}
