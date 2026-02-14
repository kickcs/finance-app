import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForeignKeysAndIndexes1770891041400 implements MigrationInterface {
  name = 'AddForeignKeysAndIndexes1770891041400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clean up orphaned records before adding FK constraints
    const tables = ['accounts', 'transactions', 'categories', 'debts', 'goals', 'reminders'];
    for (const table of tables) {
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "user_id" NOT IN (SELECT "id" FROM "profiles")`,
      );
    }
    // Clean orphaned account_balances
    await queryRunner.query(
      `DELETE FROM "account_balances" WHERE "account_id" NOT IN (SELECT "id" FROM "accounts")`,
    );
    // Clean orphaned transactions referencing deleted accounts
    await queryRunner.query(
      `DELETE FROM "transactions" WHERE "account_id" NOT IN (SELECT "id" FROM "accounts")`,
    );
    // Nullify to_account_id references to deleted accounts
    await queryRunner.query(
      `UPDATE "transactions" SET "to_account_id" = NULL WHERE "to_account_id" IS NOT NULL AND "to_account_id" NOT IN (SELECT "id" FROM "accounts")`,
    );

    // Foreign keys: user_id -> profiles(id) with CASCADE DELETE
    await queryRunner.query(
      `ALTER TABLE "accounts" ADD CONSTRAINT "FK_accounts_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "FK_categories_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "debts" ADD CONSTRAINT "FK_debts_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_goals_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" ADD CONSTRAINT "FK_reminders_user_id" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE`,
    );

    // Foreign key: transactions.account_id -> accounts(id)
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE`,
    );

    // Foreign key: transactions.to_account_id -> accounts(id) SET NULL
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_to_account_id" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL`,
    );

    // Foreign key: account_balances.account_id -> accounts(id) CASCADE
    await queryRunner.query(
      `ALTER TABLE "account_balances" ADD CONSTRAINT "FK_account_balances_account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE`,
    );

    // Indexes for frequently queried columns
    await queryRunner.query(
      `CREATE INDEX "IDX_accounts_user_id" ON "accounts" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_user_id_date" ON "transactions" ("user_id", "date" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_account_id" ON "transactions" ("account_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_categories_user_id" ON "categories" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_debts_user_id" ON "debts" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_goals_user_id" ON "goals" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminders_user_id" ON "reminders" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_profiles_email" ON "profiles" ("email")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_profiles_email"`);
    await queryRunner.query(`DROP INDEX "IDX_reminders_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_goals_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_debts_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_categories_user_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_account_id"`);
    await queryRunner.query(`DROP INDEX "IDX_transactions_user_id_date"`);
    await queryRunner.query(`DROP INDEX "IDX_accounts_user_id"`);

    // Drop foreign keys
    await queryRunner.query(
      `ALTER TABLE "account_balances" DROP CONSTRAINT "FK_account_balances_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_to_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_account_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reminders" DROP CONSTRAINT "FK_reminders_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_goals_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "debts" DROP CONSTRAINT "FK_debts_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" DROP CONSTRAINT "FK_categories_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts" DROP CONSTRAINT "FK_accounts_user_id"`,
    );
  }
}
