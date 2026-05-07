import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class NotificationImprovements1746000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Convert recurring_subscriptions.notify_days_before to integer[]
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" TYPE integer[] USING ARRAY["notify_days_before"]::integer[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" SET DEFAULT '{2}'::integer[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" SET NOT NULL`,
    );

    // 2. Add notification_hour to profiles
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "notification_hour" smallint NOT NULL DEFAULT 12`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD CONSTRAINT "chk_notification_hour" CHECK ("notification_hour" BETWEEN 0 AND 23)`,
    );

    // 3. Create notification_log table
    await queryRunner.query(`
      CREATE TABLE "notification_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "dedup_key" character varying NOT NULL,
        "payload" jsonb,
        "sent_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_log" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_notification_log_user_dedup" UNIQUE ("user_id", "dedup_key"),
        CONSTRAINT "FK_notification_log_user_id" FOREIGN KEY ("user_id")
          REFERENCES "profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notification_log_user_sent_at" ON "notification_log" ("user_id", "sent_at" DESC)`,
    );

    // 4. Create notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "notification_preferences" (
        "user_id" uuid NOT NULL,
        "subscription_upcoming" boolean NOT NULL DEFAULT true,
        "subscription_charged" boolean NOT NULL DEFAULT true,
        "subscription_failed" boolean NOT NULL DEFAULT true,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_preferences" PRIMARY KEY ("user_id"),
        CONSTRAINT "FK_notification_preferences_user_id" FOREIGN KEY ("user_id")
          REFERENCES "profiles"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4. Drop notification_preferences
    await queryRunner.query(`DROP TABLE "notification_preferences"`);

    // 3. Drop notification_log
    await queryRunner.query(`DROP INDEX "IDX_notification_log_user_sent_at"`);
    await queryRunner.query(`DROP TABLE "notification_log"`);

    // 2. Drop notification_hour from profiles
    await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "chk_notification_hour"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "notification_hour"`);

    // 1. Revert recurring_subscriptions.notify_days_before to integer
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" TYPE integer USING ("notify_days_before")[1]`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" SET DEFAULT 2`,
    );
    await queryRunner.query(
      `ALTER TABLE "recurring_subscriptions" ALTER COLUMN "notify_days_before" SET NOT NULL`,
    );
  }
}
