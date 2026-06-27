import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddLanguageToProfiles1781400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "language" character varying(2) NOT NULL DEFAULT 'ru'`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_profile_language" CHECK ("language" IN ('ru', 'en'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "chk_profile_language"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "language"`);
  }
}
