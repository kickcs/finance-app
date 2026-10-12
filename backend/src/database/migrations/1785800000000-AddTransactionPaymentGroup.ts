import { type MigrationInterface, type QueryRunner } from 'typeorm';

/** Две части одной операции, оплаченной с двух счетов, делят `payment_group_id`. */
export class AddTransactionPaymentGroup1785800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "payment_group_id" uuid NULL`);
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_payment_group_id" ON "transactions" ("payment_group_id") WHERE "payment_group_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_payment_group_id"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "payment_group_id"`);
  }
}
