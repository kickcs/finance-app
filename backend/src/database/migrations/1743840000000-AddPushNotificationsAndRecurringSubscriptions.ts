import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddPushNotificationsAndRecurringSubscriptions1743840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop reminders table
    await queryRunner.query(`DROP TABLE IF EXISTS "reminders"`);

    // 2. Add timezone column to profiles
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD "timezone" character varying NOT NULL DEFAULT 'Asia/Tashkent'`,
    );

    // 3. Create push_subscriptions table
    await queryRunner.query(`
      CREATE TABLE "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_push_subscriptions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "profiles"("id") ON DELETE CASCADE
      )
    `);

    // 4. Index on push_subscriptions.user_id
    await queryRunner.query(
      `CREATE INDEX "IDX_push_subscriptions_user_id" ON "push_subscriptions" ("user_id")`,
    );

    // 5. Create recurring_subscriptions table
    await queryRunner.query(`
      CREATE TABLE "recurring_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "description" text,
        "amount" numeric(18,2) NOT NULL,
        "currency" character varying NOT NULL,
        "account_id" uuid,
        "icon" character varying NOT NULL,
        "color" character varying NOT NULL,
        "frequency" character varying NOT NULL,
        "frequency_days" integer,
        "billing_date" date NOT NULL,
        "notify_days_before" integer NOT NULL DEFAULT 2,
        "category_id" character varying NOT NULL DEFAULT 'entertainment',
        "auto_charge" boolean NOT NULL DEFAULT false,
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_recurring_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_recurring_subscriptions_user_id" FOREIGN KEY ("user_id")
          REFERENCES "profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_recurring_subscriptions_account_id" FOREIGN KEY ("account_id")
          REFERENCES "accounts"("id") ON DELETE SET NULL
      )
    `);

    // 6. Indexes on recurring_subscriptions
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_subscriptions_user_id" ON "recurring_subscriptions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_recurring_subscriptions_billing_date" ON "recurring_subscriptions" ("billing_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order

    // 6. Drop recurring_subscriptions indexes
    await queryRunner.query(`DROP INDEX "IDX_recurring_subscriptions_billing_date"`);
    await queryRunner.query(`DROP INDEX "IDX_recurring_subscriptions_user_id"`);

    // 5. Drop recurring_subscriptions table
    await queryRunner.query(`DROP TABLE "recurring_subscriptions"`);

    // 4. Drop push_subscriptions index
    await queryRunner.query(`DROP INDEX "IDX_push_subscriptions_user_id"`);

    // 3. Drop push_subscriptions table
    await queryRunner.query(`DROP TABLE "push_subscriptions"`);

    // 2. Drop timezone column from profiles
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "timezone"`);

    // 1. Recreate reminders table (original schema)
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "amount" numeric(18,2) NOT NULL,
        "frequency" character varying NOT NULL,
        "next_date" date NOT NULL,
        "icon" character varying NOT NULL,
        "color" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reminders" PRIMARY KEY ("id")
      )
    `);
  }
}
