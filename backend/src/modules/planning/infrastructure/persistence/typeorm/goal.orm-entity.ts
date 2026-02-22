import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('goals')
export class GoalOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  name: string;

  @Column({ name: 'target_amount', type: 'decimal', precision: 18, scale: 2 })
  targetAmount: number;

  @Column({
    name: 'current_amount',
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  currentAmount: number;

  @Column({ name: 'deadline', nullable: true, type: 'date' })
  deadline: Date | null;

  @Column()
  icon: string;

  @Column()
  color: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
