import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMissingIndexes1772300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_to_account_id" ON "transactions" ("to_account_id") WHERE "to_account_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_debts_source_transaction_id" ON "debts" ("source_transaction_id") WHERE "source_transaction_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_description_trgm" ON "transactions" USING gin ("description" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_description_trgm"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debts_source_transaction_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_to_account_id"`);
  }
}
