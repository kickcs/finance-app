import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtIsPrivate1773760000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "debts" ADD COLUMN "is_private" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "is_private"`);
  }
}
