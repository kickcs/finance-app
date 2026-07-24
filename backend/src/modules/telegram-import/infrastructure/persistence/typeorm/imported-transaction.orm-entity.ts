import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('imported_transactions')
@Index(['userId', 'dedupHash'], { unique: true })
@Index(['userId', 'status'])
export class ImportedTransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'raw_text', type: 'text' })
  rawText: string;

  @Column({ type: 'varchar' })
  type: 'expense' | 'income' | 'balance_change' | 'reversal' | 'unparsed';

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  amount: string | null; // decimal приходит строкой

  @Column({ type: 'varchar', default: 'UZS' })
  currency: string;

  @Column({ type: 'varchar', nullable: true })
  merchant: string | null;

  @Column({ name: 'card_mask', type: 'varchar', nullable: true })
  cardMask: string | null; // null для unparsed

  @Column({ name: 'occurred_at', type: 'timestamptz', nullable: true })
  occurredAt: Date | null; // null для unparsed

  @Column({ name: 'balance_after', type: 'decimal', precision: 18, scale: 2, nullable: true })
  balanceAfter: string | null;

  @Column({ name: 'dedup_hash', type: 'varchar' })
  dedupHash: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: 'pending' | 'confirmed' | 'dismissed';

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
