import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramLinkOrmEntity } from '../typeorm';
import { ITelegramLinkRepository } from '../../../domain/repositories/telegram-link.repository.interface';
import { TelegramLink } from '../../../domain/models';

@Injectable()
export class TelegramLinkRepository implements ITelegramLinkRepository {
  constructor(
    @InjectRepository(TelegramLinkOrmEntity)
    private readonly repo: Repository<TelegramLinkOrmEntity>,
  ) {}

  async findByUserId(userId: string): Promise<TelegramLink | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async findByTelegramUserId(telegramUserId: string): Promise<TelegramLink | null> {
    return this.repo.findOne({ where: { telegramUserId } });
  }

  async save(link: Omit<TelegramLink, 'id' | 'createdAt'>): Promise<TelegramLink> {
    return this.repo.save(this.repo.create(link));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
