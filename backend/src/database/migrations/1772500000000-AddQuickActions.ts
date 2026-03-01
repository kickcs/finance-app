import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddQuickActions1772500000000 implements MigrationInterface {
  name = 'AddQuickActions1772500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "quick_actions" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "user_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "account_id" uuid NOT NULL,
        "label" varchar NOT NULL,
        "position" smallint NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quick_actions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quick_actions_user" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quick_actions_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quick_actions_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_quick_actions_user_id" ON "quick_actions" ("user_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "quick_actions_hidden" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "quick_actions_hint_dismissed" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "quick_actions_hint_dismissed"`);
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "quick_actions_hidden"`);
    await queryRunner.query(`DROP INDEX "IDX_quick_actions_user_id"`);
    await queryRunner.query(`DROP TABLE "quick_actions"`);
  }
}
