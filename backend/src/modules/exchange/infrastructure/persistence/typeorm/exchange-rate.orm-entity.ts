import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('exchange_rates')
export class ExchangeRateOrmEntity {
  @PrimaryColumn({ name: 'base_currency', type: 'varchar', length: 3 })
  baseCurrency: string;

  @PrimaryColumn({ name: 'target_currency', type: 'varchar', length: 3 })
  targetCurrency: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  rate: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
