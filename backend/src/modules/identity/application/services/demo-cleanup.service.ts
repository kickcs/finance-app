import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ProfileOrmEntity } from '../../infrastructure/persistence/typeorm';
import { AccountOrmEntity } from '../../../accounting/infrastructure/persistence/typeorm';
import { TransactionOrmEntity } from '../../../accounting/infrastructure/persistence/typeorm';
import { DebtOrmEntity } from '../../../debt/infrastructure/persistence/typeorm';
import { ReminderOrmEntity } from '../../../planning/infrastructure/persistence/typeorm';

/**
 * Service responsible for cleaning up expired demo accounts and their data
 */
@Injectable()
export class DemoCleanupService {
  private readonly logger = new Logger(DemoCleanupService.name);

  constructor(
    @InjectRepository(ProfileOrmEntity)
    private readonly profileRepository: Repository<ProfileOrmEntity>,
    @InjectRepository(AccountOrmEntity)
    private readonly accountRepository: Repository<AccountOrmEntity>,
    @InjectRepository(TransactionOrmEntity)
    private readonly transactionRepository: Repository<TransactionOrmEntity>,
    @InjectRepository(DebtOrmEntity)
    private readonly debtRepository: Repository<DebtOrmEntity>,
    @InjectRepository(ReminderOrmEntity)
    private readonly reminderRepository: Repository<ReminderOrmEntity>,
  ) {}

  /**
   * Run cleanup every hour to remove expired demo accounts
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredDemoAccounts(): Promise<void> {
    this.logger.log('Starting cleanup of expired demo accounts...');

    try {
      const now = new Date();

      // Find all expired demo profiles
      // Use camelCase property names matching the ORM entity
      const expiredProfiles = await this.profileRepository.find({
        where: {
          isDemo: true,
          demoExpiresAt: LessThan(now),
        },
      });

      if (expiredProfiles.length === 0) {
        this.logger.log('No expired demo accounts found');
        return;
      }

      this.logger.log(
        `Found ${expiredProfiles.length} expired demo accounts to clean up`,
      );

      for (const profile of expiredProfiles) {
        await this.deleteUserData(profile.id);
      }

      this.logger.log(
        `Successfully cleaned up ${expiredProfiles.length} expired demo accounts`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup expired demo accounts', error);
    }
  }

  /**
   * Delete all data associated with a user
   */
  private async deleteUserData(userId: string): Promise<void> {
    try {
      // Delete in order to respect foreign key constraints
      // Use camelCase property names matching the ORM entities
      // 1. Delete transactions
      await this.transactionRepository.delete({ userId });

      // 2. Delete accounts (this will cascade to account_balances)
      await this.accountRepository.delete({ userId });

      // 3. Delete debts
      await this.debtRepository.delete({ userId });

      // 4. Delete reminders
      await this.reminderRepository.delete({ userId });

      // 5. Finally delete the profile
      await this.profileRepository.delete({ id: userId });

      this.logger.debug(`Deleted all data for demo user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to delete data for user ${userId}`, error);
      throw error;
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
