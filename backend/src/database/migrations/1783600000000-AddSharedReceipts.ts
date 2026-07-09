import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddSharedReceipts1783600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shared_receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "token" character varying(21) NOT NULL, "user_id" uuid NOT NULL, "payload" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_shared_receipts_token" UNIQUE ("token"), CONSTRAINT "PK_shared_receipts" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_shared_receipts_token" ON "shared_receipts" ("token")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shared_receipts_user_id" ON "shared_receipts" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_shared_receipts_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_shared_receipts_token"`);
    await queryRunner.query(`DROP TABLE "shared_receipts"`);
  }
}
