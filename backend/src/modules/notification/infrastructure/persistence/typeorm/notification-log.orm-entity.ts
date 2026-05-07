import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, Unique } from 'typeorm';

@Entity('notification_log')
@Unique('UQ_notification_log_user_dedup', ['userId', 'dedupKey'])
@Index('IDX_notification_log_user_sent_at', ['userId', 'sentAt'])
export class NotificationLogOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ name: 'dedup_key', type: 'varchar' })
  dedupKey: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
