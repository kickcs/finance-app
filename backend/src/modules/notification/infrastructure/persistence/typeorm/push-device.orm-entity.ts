import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('push_devices')
@Unique('UQ_push_devices_user_token', ['userId', 'token'])
export class PushDeviceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_push_devices_user_id')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'text' })
  token: string;

  @Column({ type: 'varchar', length: 16 })
  platform: 'ios' | 'android';

  @Column({ name: 'device_id', type: 'varchar', length: 255, nullable: true })
  deviceId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
