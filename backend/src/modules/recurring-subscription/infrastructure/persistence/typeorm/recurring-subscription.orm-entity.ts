import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('recurring_subscriptions')
export class RecurringSubscriptionOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'varchar' })
  description: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount: number;

  @Column()
  currency: string;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @Column()
  icon: string;

  @Column()
  color: string;

  @Column()
  frequency: string;

  @Column({ name: 'frequency_days', type: 'int', nullable: true })
  frequencyDays: number | null;

  @Column({ name: 'billing_date', type: 'date' })
  billingDate: Date;

  @Column({ name: 'notify_days_before', type: 'integer', array: true, default: [2] })
  notifyDaysBefore: number[];

  @Column({ name: 'category_id', type: 'varchar' })
  categoryId: string;

  @Column({ name: 'auto_charge', type: 'boolean', default: false })
  autoCharge: boolean;

  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
