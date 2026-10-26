import { type MigrationInterface, type QueryRunner } from 'typeorm';

// Id категорий зашиты литералами: миграция не должна меняться вслед за кодом приложения.
const RETURNS = `'debt_return_to_me', 'debt_return_from_me'`;
const DEBT_CATEGORIES = `'debt_given', 'debt_taken', 'debt_return_to_me', 'debt_return_from_me', 'debt_forgiven', 'debt_offset', 'debt_worked_off'`;
const PERSON = `COALESCE(NULLIF(trim(d."person_name"), ''), trim(d."name"))`;
const EXCESS_PREFIX = 'Переплата по долгу:';

/**
 * Связывает записи расчётов, написанные до `settlement_id`, тем же правилом, по которому
 * их раньше собирал код: платёж — по дате, зачёт — по отметке времени, переплата — по близости.
 */
export class BackfillTransactionSettlement1785900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Платежи: возврат, прощение, отметка отработки и нога работы; один расчёт на (долг, дата).
    // Выдача, исходная запись чека и комиссия тоже лежат с debt_id — их отсекают ссылки долга.
    await queryRunner.query(`
      WITH payments AS (
        SELECT t."id", t."debt_id", t."date"
        FROM "transactions" t
        WHERE t."settlement_id" IS NULL
          AND t."debt_id" IS NOT NULL
          AND (
            t."category_id" IN (${RETURNS}, 'debt_forgiven', 'debt_worked_off')
            OR t."category_id" NOT IN (${DEBT_CATEGORIES})
          )
          AND NOT EXISTS (
            SELECT 1 FROM "debts" d
            WHERE t."id" IN (d."transaction_id", d."source_transaction_id", d."fee_transaction_id")
          )
      ),
      settlements AS MATERIALIZED (
        SELECT "debt_id", "date", gen_random_uuid() AS "settlement_id"
        FROM payments
        GROUP BY "debt_id", "date"
      )
      UPDATE "transactions" t
      SET "settlement_id" = s."settlement_id"
      FROM payments p
      JOIN settlements s ON s."debt_id" = p."debt_id" AND s."date" = p."date"
      WHERE t."id" = p."id"
    `);

    // Зачёты: одна отметка времени на все долги человека в валюте.
    await queryRunner.query(`
      WITH offsets AS (
        SELECT t."id", t."user_id", t."date", d."currency", ${PERSON} AS "person"
        FROM "transactions" t
        JOIN "debts" d ON d."id" = t."debt_id"
        WHERE t."settlement_id" IS NULL AND t."category_id" = 'debt_offset'
      ),
      settlements AS MATERIALIZED (
        SELECT "user_id", "date", "currency", "person", gen_random_uuid() AS "settlement_id"
        FROM offsets
        GROUP BY "user_id", "date", "currency", "person"
      )
      UPDATE "transactions" t
      SET "settlement_id" = s."settlement_id"
      FROM offsets o
      JOIN settlements s
        ON s."user_id" = o."user_id" AND s."date" = o."date"
        AND s."currency" = o."currency" AND s."person" = o."person"
      WHERE t."id" = o."id"
    `);

    // Дата старой переплаты не совпадает с датой платежа, поэтому пару ищем по created_at (окно 5 с).
    // Идёт после платежей: берёт расчёт, который выставил первый шаг.
    await queryRunner.query(`
      UPDATE "transactions" x
      SET "settlement_id" = m."settlement_id"
      FROM (
        SELECT DISTINCT ON (e."id") e."id", r."settlement_id"
        FROM "transactions" e
        JOIN "transactions" r
          ON r."user_id" = e."user_id"
          AND r."account_id" = e."account_id"
          AND r."category_id" IN (${RETURNS})
          AND r."settlement_id" IS NOT NULL
          AND r."created_at" <= e."created_at"
          AND r."created_at" >= e."created_at" - interval '5 seconds'
        JOIN "debts" d ON d."id" = r."debt_id"
        WHERE e."settlement_id" IS NULL
          AND e."debt_id" IS NULL
          AND e."description" LIKE '${EXCESS_PREFIX}%'
          AND ${PERSON} = trim(substr(e."description", char_length('${EXCESS_PREFIX}') + 1))
        ORDER BY e."id", r."created_at" DESC, r."id" DESC
      ) m
      WHERE x."id" = m."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "transactions" SET "settlement_id" = NULL WHERE "settlement_id" IS NOT NULL`,
    );
  }
}
