import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

export type Theme = 'light' | 'dark' | 'system';

@Entity('settings')
@Unique(['userId'])
export class Settings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', default: 'system' })
  theme: Theme;

  @Column({ default: 'en' })
  language: string;

  @Column({ name: 'notifications_enabled', default: true })
  notificationsEnabled: boolean;
}
