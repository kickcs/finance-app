import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddDebtMetadata1773750000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" ADD COLUMN "description" varchar NULL`);
    await queryRunner.query(`ALTER TABLE "debts" ADD COLUMN "closed_at" timestamp NULL`);
    await queryRunner.query(
      `ALTER TABLE "debts" ADD COLUMN "forgiven_amount" decimal(18,2) NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "forgiven_amount"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "closed_at"`);
    await queryRunner.query(`ALTER TABLE "debts" DROP COLUMN "description"`);
  }
}
