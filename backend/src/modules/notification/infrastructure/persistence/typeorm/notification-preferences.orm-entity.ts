import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_preferences')
export class NotificationPreferencesOrmEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'subscription_upcoming', type: 'boolean', default: true })
  subscriptionUpcoming: boolean;

  @Column({ name: 'subscription_charged', type: 'boolean', default: true })
  subscriptionCharged: boolean;

  @Column({ name: 'subscription_failed', type: 'boolean', default: true })
  subscriptionFailed: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
