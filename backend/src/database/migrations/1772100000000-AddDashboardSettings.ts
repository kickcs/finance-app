import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDashboardSettings1772100000000 implements MigrationInterface {
  name = 'AddDashboardSettings1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "dashboard_settings" jsonb DEFAULT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "dashboard_settings"`);
  }
}
