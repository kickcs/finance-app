import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('user_subscriptions')
export class UserSubscriptionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'lemon_customer_id', type: 'varchar', nullable: true })
  lemonCustomerId: string | null;

  @Column({ name: 'lemon_subscription_id', type: 'varchar', nullable: true })
  lemonSubscriptionId: string | null;

  @Column({ name: 'variant_id', type: 'varchar', nullable: true })
  variantId: string | null;

  @Column({ type: 'varchar', default: 'free' })
  plan: string;

  @Column({ type: 'varchar', default: 'active' })
  status: string;

  @Column({ name: 'trial_start', type: 'timestamp', nullable: true })
  trialStart: Date | null;

  @Column({ name: 'trial_end', type: 'timestamp', nullable: true })
  trialEnd: Date | null;

  @Column({ name: 'current_period_start', type: 'timestamp', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamp', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'varchar', length: 32, default: 'lemonsqueezy' })
  source: 'lemonsqueezy' | 'apple_iap' | 'google_iap';

  @Column({ name: 'original_transaction_id', type: 'varchar', length: 128, nullable: true })
  originalTransactionId: string | null;

  @Column({ name: 'app_account_token', type: 'varchar', length: 128, nullable: true })
  appAccountToken: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
