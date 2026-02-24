import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtIdToTransactions1771781707900 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "debt_id" uuid NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_debt_id" ON "transactions" ("debt_id") WHERE "debt_id" IS NOT NULL`,
    );

    // Backfill: set debt_id on transactions linked via debt.transaction_id and debt.close_transaction_id.
    // Note: old partial payment transactions cannot be reliably backfilled (no direct link existed).
    // Only new partial payments (created after this migration) will have debt_id set.
    await queryRunner.query(`
      UPDATE "transactions" t
      SET "debt_id" = d.id
      FROM "debts" d
      WHERE t.id = d.transaction_id OR t.id = d.close_transaction_id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_transactions_debt_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "debt_id"`);
  }
}
