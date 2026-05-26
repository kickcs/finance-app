import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Creates `push_devices` table for native push tokens (Expo / APNs / FCM).
 * Separate from `push_subscriptions` which holds web-push (VAPID) subscriptions.
 * Unique on (user_id, token) so re-registration of the same token is idempotent.
 */
export class AddPushDevicesTable1773800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_devices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token" text NOT NULL,
        "platform" varchar(16) NOT NULL,
        "device_id" varchar(255),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_devices" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_devices_user_token" UNIQUE ("user_id", "token"),
        CONSTRAINT "CHK_push_devices_platform" CHECK ("platform" IN ('ios', 'android')),
        CONSTRAINT "FK_push_devices_user_id" FOREIGN KEY ("user_id")
          REFERENCES "profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_push_devices_user_id" ON "push_devices" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_push_devices_user_id"`);
    await queryRunner.query(
      `ALTER TABLE "push_devices" DROP CONSTRAINT IF EXISTS "FK_push_devices_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_devices" DROP CONSTRAINT IF EXISTS "CHK_push_devices_platform"`,
    );
    await queryRunner.query(
      `ALTER TABLE "push_devices" DROP CONSTRAINT IF EXISTS "UQ_push_devices_user_token"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "push_devices"`);
  }
}
