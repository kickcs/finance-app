import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAccountTypeFields1770891041300 implements MigrationInterface {
  name = 'AddAccountTypeFields1770891041300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Credit card fields
    await queryRunner.query(`ALTER TABLE "accounts" ADD "credit_limit" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "grace_period_days" integer`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "billing_day" integer`);

    // Loan fields
    await queryRunner.query(`ALTER TABLE "accounts" ADD "total_amount" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "interest_rate" decimal(5,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "monthly_payment" decimal(18,2)`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "start_date" date`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "end_date" date`);

    // Deposit fields
    await queryRunner.query(`ALTER TABLE "accounts" ADD "maturity_date" date`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "is_replenishable" boolean`);
    await queryRunner.query(`ALTER TABLE "accounts" ADD "is_withdrawable" boolean`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "is_withdrawable"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "is_replenishable"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "maturity_date"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "end_date"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "start_date"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "monthly_payment"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "interest_rate"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "total_amount"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "billing_day"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "grace_period_days"`);
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "credit_limit"`);
  }
}
