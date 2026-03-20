import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddQuickActionAmount1773770000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quick_actions" ADD "amount" numeric(12,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quick_actions" DROP COLUMN "amount"`);
  }
}
