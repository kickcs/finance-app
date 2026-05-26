import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Extends `user_subscriptions` with IAP source columns so the same row can
 * represent a LemonSqueezy (web), Apple IAP, or Google Play subscription.
 *
 * - `source` defaults to 'lemonsqueezy' to preserve existing rows.
 * - `original_transaction_id` is unique-per-(source) so re-validating the
 *   same Apple original_transaction_id or Google purchaseToken is idempotent.
 * - CHECK on source mirrors the application enum.
 */
export class AddIapSubscriptionColumns1773810000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD COLUMN "source" varchar(32) NOT NULL DEFAULT 'lemonsqueezy',
      ADD COLUMN "original_transaction_id" varchar(128),
      ADD COLUMN "app_account_token" varchar(128)
    `);
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      ADD CONSTRAINT "CHK_user_subscriptions_source"
      CHECK ("source" IN ('lemonsqueezy', 'apple_iap', 'google_iap'))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_user_subscriptions_source_original_txn"
      ON "user_subscriptions" ("source", "original_transaction_id")
      WHERE "original_transaction_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_user_subscriptions_source_original_txn"`);
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT IF EXISTS "CHK_user_subscriptions_source"`,
    );
    await queryRunner.query(`
      ALTER TABLE "user_subscriptions"
      DROP COLUMN IF EXISTS "app_account_token",
      DROP COLUMN IF EXISTS "original_transaction_id",
      DROP COLUMN IF EXISTS "source"
    `);
  }
}
