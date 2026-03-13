import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddBudgetsTable1772700000000 implements MigrationInterface {
  name = 'AddBudgetsTable1772700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "budgets" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "user_id" uuid NOT NULL,
        "year" integer,
        "month" integer,
        "amount" decimal(15,2) NOT NULL,
        "currency" varchar(3) NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_budgets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_budgets_user_id" ON "budgets" ("user_id")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_budgets_user_default" ON "budgets" ("user_id") WHERE "is_default" = true`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_budgets_user_year_month" ON "budgets" ("user_id", "year", "month") WHERE "is_default" = false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_budgets_user_year_month"`);
    await queryRunner.query(`DROP INDEX "uq_budgets_user_default"`);
    await queryRunner.query(`DROP INDEX "IDX_budgets_user_id"`);
    await queryRunner.query(`DROP TABLE "budgets"`);
  }
}
