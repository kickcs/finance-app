import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('transactions')
export class TransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ name: 'category_id', type: 'text' })
  categoryId: string;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'timestamp with time zone' })
  date: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'is_debt_related', default: false })
  isDebtRelated: boolean;

  @Column({ name: 'is_informational', default: false })
  isInformational: boolean;

  @Column({ name: 'debt_id', nullable: true, type: 'uuid' })
  debtId: string | null;

  @Column({ name: 'to_account_id', nullable: true, type: 'uuid' })
  toAccountId: string | null;

  @Column({
    name: 'to_amount',
    nullable: true,
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  toAmount: number | null;

  @Column({ name: 'to_currency', type: 'varchar', nullable: true })
  toCurrency: string | null;
}
