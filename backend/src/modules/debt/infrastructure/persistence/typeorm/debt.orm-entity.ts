import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

@Entity('debts')
export class DebtOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column({ name: 'total_amount', type: 'decimal', precision: 18, scale: 2 })
  totalAmount: number;

  @Column({
    name: 'remaining_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  remainingAmount: number;

  @Column({
    name: 'monthly_payment',
    nullable: true,
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  monthlyPayment: number | null;

  @Column({ name: 'next_payment_date', nullable: true, type: 'date' })
  nextPaymentDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'debt_type', type: 'varchar', default: 'taken' })
  debtType: string;

  @Column({ name: 'person_name', type: 'varchar', nullable: true })
  personName: string | null;

  @Column({ name: 'account_id', nullable: true, type: 'uuid' })
  accountId: string | null;

  @Column({ name: 'transaction_id', nullable: true, type: 'uuid' })
  transactionId: string | null;

  @Column({ name: 'close_transaction_id', nullable: true, type: 'uuid' })
  closeTransactionId: string | null;

  @Column({ name: 'is_closed', default: false })
  isClosed: boolean;

  @Column({ default: 'UZS' })
  currency: string;

  @Column({ name: 'source_transaction_id', nullable: true, type: 'uuid' })
  sourceTransactionId: string | null;
}
