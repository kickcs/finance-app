import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { PaymentMethodOrmEntity } from '../../infrastructure/persistence/typeorm/payment-method.orm-entity';

const MAX_PAYMENT_METHODS_PER_USER = 10;

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectRepository(PaymentMethodOrmEntity)
    private readonly repository: Repository<PaymentMethodOrmEntity>,
  ) {}

  async findAllByUser(userId: string): Promise<PaymentMethodOrmEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async create(userId: string, label: string, value: string): Promise<PaymentMethodOrmEntity> {
    const count = await this.repository.count({ where: { userId } });
    if (count >= MAX_PAYMENT_METHODS_PER_USER) {
      throw new BadRequestException(
        `Cannot save more than ${MAX_PAYMENT_METHODS_PER_USER} payment methods`,
      );
    }

    const entity = this.repository.create({ userId, label, value });
    return this.repository.save(entity);
  }

  async delete(userId: string, id: string): Promise<void> {
    const entity = await this.repository.findOne({ where: { id, userId } });
    if (!entity) {
      throw new NotFoundException('Payment method not found');
    }
    await this.repository.remove(entity);
  }
}
