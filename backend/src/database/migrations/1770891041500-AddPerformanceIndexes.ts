import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1770891041500 implements MigrationInterface {
  name = 'AddPerformanceIndexes1770891041500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Composite index for cursor-based pagination (date DESC, created_at DESC)
    // Covers: getPaginated, searchPaginated, getByAccountPaginated queries
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_date_created" ON "transactions" ("user_id", "date" DESC, "created_at" DESC)`,
    );

    // Index for transaction type filtering (common filter in getPaginated)
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")`,
    );

    // Index for category-based transaction lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_category_id" ON "transactions" ("category_id")`,
    );

    // Index for debt-related transaction lookups (source_transaction_id for returned amounts)
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_source_transaction_id" ON "transactions" ("source_transaction_id") WHERE "source_transaction_id" IS NOT NULL`,
    );

    // Index for account_balances lookup by account_id
    await queryRunner.query(
      `CREATE INDEX "IDX_account_balances_account_id" ON "account_balances" ("account_id")`,
    );

    // Index for reminders next_date filtering (due reminders lookup)
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_next_date" ON "reminders" ("user_id", "next_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reminders_next_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_account_balances_account_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_source_transaction_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_category_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_user_date_created"`);
  }
}
