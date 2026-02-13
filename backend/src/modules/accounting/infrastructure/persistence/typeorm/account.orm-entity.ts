import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { AccountBalanceOrmEntity } from './account-balance.orm-entity';

@Entity('accounts')
export class AccountOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, default: 0 })
  balance: number;

  @Column({ default: 'USD' })
  currency: string;

  @Column()
  icon: string;

  @Column()
  color: string;

  @Column({ type: 'varchar', default: 'basic' })
  type: string;

  @Column({ default: 0 })
  order: number;

  // Credit card fields
  @Column({ name: 'credit_limit', type: 'decimal', precision: 18, scale: 2, nullable: true })
  creditLimit: number | null;

  @Column({ name: 'grace_period_days', type: 'integer', nullable: true })
  gracePeriodDays: number | null;

  @Column({ name: 'billing_day', type: 'integer', nullable: true })
  billingDay: number | null;

  // Loan fields
  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 2, nullable: true })
  totalAmount: number | null;

  @Column({ name: 'interest_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  interestRate: number | null;

  @Column({ name: 'monthly_payment', type: 'decimal', precision: 18, scale: 2, nullable: true })
  monthlyPayment: number | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date | null;

  // Deposit fields
  @Column({ name: 'maturity_date', type: 'date', nullable: true })
  maturityDate: Date | null;

  @Column({ name: 'is_replenishable', type: 'boolean', nullable: true })
  isReplenishable: boolean | null;

  @Column({ name: 'is_withdrawable', type: 'boolean', nullable: true })
  isWithdrawable: boolean | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => AccountBalanceOrmEntity, (balance) => balance.account, {
    cascade: true,
  })
  balances: AccountBalanceOrmEntity[];
}
