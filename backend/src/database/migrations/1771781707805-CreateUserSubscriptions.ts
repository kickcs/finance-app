import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class CreateUserSubscriptions1771781707805 implements MigrationInterface {
  name = 'CreateUserSubscriptions1771781707805';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "lemon_customer_id" character varying, "lemon_subscription_id" character varying, "variant_id" character varying, "plan" character varying NOT NULL DEFAULT 'free', "status" character varying NOT NULL DEFAULT 'active', "trial_start" TIMESTAMP, "trial_end" TIMESTAMP, "current_period_start" TIMESTAMP, "current_period_end" TIMESTAMP, "cancel_at_period_end" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0641da02314913e28f6131310eb" UNIQUE ("user_id"), CONSTRAINT "PK_9e928b0954e51705ab44988812c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" ADD CONSTRAINT "FK_user_subscriptions_profiles" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_subscriptions" DROP CONSTRAINT "FK_user_subscriptions_profiles"`,
    );
    await queryRunner.query(`DROP TABLE "user_subscriptions"`);
  }
}
