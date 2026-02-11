import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Reminder } from '../../../domain/aggregates/reminder';
import { IReminderRepository } from '../../../domain/repositories';
import { ReminderOrmEntity } from '../typeorm/reminder.orm-entity';
import { ReminderMapper } from '../mappers/reminder.mapper';

@Injectable()
export class ReminderRepository implements IReminderRepository {
  constructor(
    @InjectRepository(ReminderOrmEntity)
    private readonly ormRepository: Repository<ReminderOrmEntity>,
  ) {}

  async findById(id: string): Promise<Reminder | null> {
    const ormEntity = await this.ormRepository.findOne({ where: { id } });
    if (!ormEntity) return null;
    return ReminderMapper.toDomain(ormEntity);
  }

  async findByUserId(userId: string): Promise<Reminder[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId },
      order: { nextDate: 'ASC' },
    });
    return ormEntities.map((entity) => ReminderMapper.toDomain(entity));
  }

  async findActiveByUserId(userId: string): Promise<Reminder[]> {
    const ormEntities = await this.ormRepository.find({
      where: { userId, isActive: true },
      order: { nextDate: 'ASC' },
    });
    return ormEntities.map((entity) => ReminderMapper.toDomain(entity));
  }

  async findDueReminders(userId: string): Promise<Reminder[]> {
    const ormEntities = await this.ormRepository.find({
      where: {
        userId,
        isActive: true,
        nextDate: LessThanOrEqual(new Date()),
      },
      order: { nextDate: 'ASC' },
    });
    return ormEntities.map((entity) => ReminderMapper.toDomain(entity));
  }

  async save(reminder: Reminder): Promise<Reminder> {
    const ormEntity = ReminderMapper.toOrm(reminder);
    const savedEntity = await this.ormRepository.save(ormEntity);
    return ReminderMapper.toDomain(savedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.ormRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.ormRepository.count({ where: { id } });
    return count > 0;
  }
}
