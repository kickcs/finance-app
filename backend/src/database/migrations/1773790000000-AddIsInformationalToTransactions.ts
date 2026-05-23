import { type MigrationInterface, type QueryRunner } from 'typeorm';

/**
 * Adds `is_informational` flag to transactions and backfills info-records for
 * already-forgiven debts that have no closing transaction. Backfilled rows make
 * the forgiveness visible in the global transactions feed while never touching
 * account balances or analytics totals (handlers and repositories filter them out).
 */
export class AddIsInformationalToTransactions1773790000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN "is_informational" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_transactions_is_informational" ON "transactions" ("is_informational") WHERE "is_informational" = true`,
    );

    // Backfill: for every forgiven & closed debt without a close_transaction_id,
    // create an info-transaction dated to `closed_at` (fallback `created_at`) and
    // wire `debts.close_transaction_id` to point at it. Skip debts where no
    // account_id can be resolved — neither debt.account_id nor profile.default_account_id
    // resolves to an *existing* account row. profiles.default_account_id has no
    // FK so it may point to a deleted account; we verify both candidates exist
    // before insert, otherwise FK_transactions_account_id would abort the migration.
    await queryRunner.query(`
      WITH resolved AS (
        SELECT
          d.id AS debt_id,
          d.user_id,
          d.currency,
          d.debt_type,
          d.forgiven_amount,
          d.person_name,
          d.name,
          d.closed_at,
          d.created_at,
          CASE
            WHEN d.account_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = d.account_id)
              THEN d.account_id
            WHEN p.default_account_id IS NOT NULL
              AND EXISTS (SELECT 1 FROM "accounts" a WHERE a.id = p.default_account_id)
              THEN p.default_account_id
            ELSE NULL
          END AS resolved_account_id
        FROM "debts" d
        LEFT JOIN "profiles" p ON p.id = d.user_id
        WHERE d.forgiven_amount > 0
          AND d.is_closed = true
          AND d.close_transaction_id IS NULL
      ),
      inserted_tx AS (
        INSERT INTO "transactions" (
          "id", "user_id", "account_id", "category_id",
          "amount", "currency", "type", "description",
          "date", "created_at", "is_debt_related", "debt_id", "is_informational"
        )
        SELECT
          uuid_generate_v4() AS id,
          r.user_id,
          r.resolved_account_id AS account_id,
          'debt_forgiven' AS category_id,
          r.forgiven_amount AS amount,
          r.currency,
          CASE WHEN r.debt_type = 'given' THEN 'expense' ELSE 'income' END AS type,
          'Прощение долга: ' || COALESCE(NULLIF(r.person_name, ''), r.name) AS description,
          COALESCE(r.closed_at, r.created_at) AS date,
          COALESCE(r.closed_at, r.created_at) AS created_at,
          false AS is_debt_related,
          r.debt_id AS debt_id,
          true AS is_informational
        FROM resolved r
        WHERE r.resolved_account_id IS NOT NULL
        RETURNING id, debt_id
      )
      UPDATE "debts" d
      SET close_transaction_id = it.id
      FROM inserted_tx it
      WHERE d.id = it.debt_id;
    `);

    await queryRunner.query(`
      DO $$
      DECLARE skipped INT;
      BEGIN
        SELECT COUNT(*) INTO skipped
        FROM "debts" d
        LEFT JOIN "profiles" p ON p.id = d.user_id
        WHERE d.forgiven_amount > 0
          AND d.is_closed = true
          AND d.close_transaction_id IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "accounts" a
            WHERE (d.account_id IS NOT NULL AND a.id = d.account_id)
               OR (p.default_account_id IS NOT NULL AND a.id = p.default_account_id)
          );
        IF skipped > 0 THEN
          RAISE NOTICE 'Skipped % forgiven debts with no resolvable account_id', skipped;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "debts" d
      SET close_transaction_id = NULL
      FROM "transactions" t
      WHERE d.close_transaction_id = t.id
        AND t.is_informational = true
    `);
    await queryRunner.query(`DELETE FROM "transactions" WHERE "is_informational" = true`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_transactions_is_informational"`);
    await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "is_informational"`);
  }
}
