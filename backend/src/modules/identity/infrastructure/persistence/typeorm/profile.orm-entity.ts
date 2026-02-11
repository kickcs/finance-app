import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

/**
 * Profile ORM Entity
 * Maps to the 'profiles' table in the database
 */
@Entity('profiles')
export class ProfileOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ default: 'RUB' })
  currency: string;

  @Column({ name: 'has_completed_onboarding', default: false })
  hasCompletedOnboarding: boolean;

  @Column({ name: 'default_account_id', nullable: true, type: 'uuid' })
  defaultAccountId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'is_demo', default: false })
  isDemo: boolean;

  @Column({
    name: 'demo_expires_at',
    nullable: true,
    type: 'timestamp with time zone',
  })
  demoExpiresAt: Date | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ name: 'refresh_token', type: 'text', nullable: true })
  refreshToken: string | null;
}
