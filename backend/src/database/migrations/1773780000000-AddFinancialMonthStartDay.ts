import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddFinancialMonthStartDay1773780000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "financial_month_start_day" integer NOT NULL DEFAULT 1`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_financial_month_start_day" CHECK ("financial_month_start_day" BETWEEN 1 AND 31)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" DROP CONSTRAINT "chk_financial_month_start_day"`,
    );
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "financial_month_start_day"`);
  }
}
