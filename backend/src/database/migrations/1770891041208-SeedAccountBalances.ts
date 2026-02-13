import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedAccountBalances1770891041208 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create account_balances table if it doesn't exist (for production where synchronize=false)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "account_balances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "account_id" uuid NOT NULL,
        "currency" character varying NOT NULL,
        "balance" numeric(18,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_account_balances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_account_balances_account_currency" UNIQUE ("account_id", "currency"),
        CONSTRAINT "FK_account_balances_account" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    // 2. Seed account_balances for existing accounts that don't have any balance records
    await queryRunner.query(`
      INSERT INTO "account_balances" ("id", "account_id", "currency", "balance", "created_at")
      SELECT
        uuid_generate_v4(),
        a."id",
        a."currency",
        a."balance",
        a."created_at"
      FROM "accounts" a
      WHERE NOT EXISTS (
        SELECT 1 FROM "account_balances" ab WHERE ab."account_id" = a."id"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove only the seeded balances (those matching accounts.currency exactly)
    // We don't drop the table since other balances may have been added manually
    await queryRunner.query(`
      DELETE FROM "account_balances" ab
      USING "accounts" a
      WHERE ab."account_id" = a."id"
        AND ab."currency" = a."currency"
        AND (
          SELECT COUNT(*) FROM "account_balances" ab2 WHERE ab2."account_id" = a."id"
        ) = 1
    `);
  }
}
