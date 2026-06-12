import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('telegram_links')
export class TelegramLinkOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'telegram_user_id', type: 'bigint', unique: true })
  telegramUserId: string; // bigint приходит строкой из pg-драйвера

  @Column({ name: 'telegram_username', type: 'varchar', nullable: true })
  telegramUsername: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
