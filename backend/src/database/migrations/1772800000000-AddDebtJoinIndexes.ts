import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtJoinIndexes1772800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_debts_close_transaction_id" ON "debts" ("close_transaction_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_debts_transaction_id" ON "debts" ("transaction_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debts_transaction_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_debts_close_transaction_id"`);
  }
}
