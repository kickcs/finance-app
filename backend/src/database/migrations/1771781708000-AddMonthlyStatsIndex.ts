import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMonthlyStatsIndex1771781708000 implements MigrationInterface {
  name = 'AddMonthlyStatsIndex1771781708000';
  // CONCURRENTLY cannot run inside a transaction block
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Covering index for monthly stats conditional aggregation queries
    await queryRunner.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_monthly_stats
      ON transactions (user_id, date, type, is_debt_related, category_id, currency, amount)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_monthly_stats`);
  }
}
