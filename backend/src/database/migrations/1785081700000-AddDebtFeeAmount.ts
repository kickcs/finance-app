import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtFeeAmount1785081700000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debts" ADD COLUMN "fee_amount" decimal(18,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "fee_amount"`);
  }
}
