import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddMissingUserIdIndexes1772900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_budgets_user_id" ON "budgets" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_people_user_id" ON "people" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_quick_actions_user_id" ON "quick_actions" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_user_subscriptions_lemon_subscription_id" ON "user_subscriptions" ("lemon_subscription_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_subscriptions_lemon_subscription_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_quick_actions_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_people_user_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_budgets_user_id"`);
  }
}
