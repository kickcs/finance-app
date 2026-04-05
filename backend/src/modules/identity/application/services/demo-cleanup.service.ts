import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { ProfileOrmEntity } from '../../infrastructure/persistence/typeorm';
import { AccountOrmEntity } from '../../../accounting/infrastructure/persistence/typeorm';
import { TransactionOrmEntity } from '../../../accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from '../../../debt/infrastructure/persistence/typeorm';
import { GoalOrmEntity } from '../../../planning/infrastructure/persistence/typeorm';

/**
 * Service responsible for cleaning up expired demo accounts and their data
 */
@Injectable()
export class DemoCleanupService {
  private readonly logger = new Logger(DemoCleanupService.name);

  constructor(
    @InjectRepository(ProfileOrmEntity)
    private readonly profileRepository: Repository<ProfileOrmEntity>,
  ) {}

  /**
   * Run cleanup every hour to remove expired demo accounts
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredDemoAccounts(): Promise<void> {
    this.logger.log('Starting cleanup of expired demo accounts...');

    try {
      const now = new Date();

      // Find up to 50 expired demo profiles per run (limits CPU spike)
      const expiredProfiles = await this.profileRepository.find({
        where: {
          isDemo: true,
          demoExpiresAt: LessThan(now),
        },
        select: ['id'],
        take: 50,
      });

      if (expiredProfiles.length === 0) {
        this.logger.log('No expired demo accounts found');
        return;
      }

      this.logger.log(`Found ${expiredProfiles.length} expired demo accounts to clean up`);

      const userIds = expiredProfiles.map((p) => p.id);

      // Delete all data in a single transaction, respecting foreign key order
      await this.profileRepository.manager.transaction(async (manager) => {
        // 1. Delete transactions first
        await manager.delete(TransactionOrmEntity, { userId: In(userIds) });

        // 2. Delete accounts (cascades to account_balances)
        await manager.delete(AccountOrmEntity, { userId: In(userIds) });

        // 3. Delete debts
        await manager.delete(DebtOrmEntity, { userId: In(userIds) });

        // 4. Delete goals
        await manager.delete(GoalOrmEntity, { userId: In(userIds) });

        // 5. Finally delete the profiles
        await manager.delete(ProfileOrmEntity, { id: In(userIds) });
      });

      this.logger.log(`Successfully cleaned up ${expiredProfiles.length} expired demo accounts`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired demo accounts', error);
    }
  }

  /**
   * Manually trigger cleanup (for admin purposes)
   */
  async manualCleanup(): Promise<number> {
    const before = await this.profileRepository.count({
      where: {
        isDemo: true,
        demoExpiresAt: LessThan(new Date()),
      },
    });

    await this.cleanupExpiredDemoAccounts();

    return before;
  }
}
