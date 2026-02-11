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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => AccountBalanceOrmEntity, (balance) => balance.account, {
    cascade: true,
  })
  balances: AccountBalanceOrmEntity[];
}
