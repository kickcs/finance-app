import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtFeeTransactionId1785600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" ADD COLUMN "fee_transaction_id" uuid NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "fee_transaction_id"`);
  }
}
