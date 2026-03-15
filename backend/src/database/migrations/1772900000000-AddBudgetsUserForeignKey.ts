import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddBudgetsUserForeignKey1772900000000 implements MigrationInterface {
  name = 'AddBudgetsUserForeignKey1772900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "budgets" ADD CONSTRAINT "FK_budgets_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "budgets" DROP CONSTRAINT "FK_budgets_user_id"`);
  }
}
