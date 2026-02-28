import { type MigrationInterface, type QueryRunner } from 'typeorm';

export class AddCompositeFilterIndexes1772400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Covers: getPaginated with type filter (expense/income tabs)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_user_type_date"
       ON "transactions" ("user_id", "type", "date" DESC, "created_at" DESC)
       WHERE "is_debt_related" = false`,
    );

    // Covers: getPaginated with accountId filter, getByAccountPaginated
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_account_date"
       ON "transactions" ("account_id", "date" DESC, "created_at" DESC)`,
    );

    // Covers: getHashtags — pre-filter users with # in description
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_transactions_user_hashtag"
       ON "transactions" ("user_id")
       WHERE "description" LIKE '%#%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_user_hashtag"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_account_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_user_type_date"`);
  }
}
