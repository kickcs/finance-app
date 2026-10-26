import { type MigrationInterface, type QueryRunner } from 'typeorm';

/** Записи одного расчёта по долгу (платёж, зачёт, «Закрыть все») делят `settlement_id`. */
export class AddTransactionSettlement1785900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "settlement_id" uuid NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_settlement_id" ON "transactions" ("settlement_id") WHERE "settlement_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_settlement_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "settlement_id"`);
  }
}
