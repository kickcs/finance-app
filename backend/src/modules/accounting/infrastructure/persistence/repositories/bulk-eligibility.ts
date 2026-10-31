import { assertSqlAlias } from './sql-alias';

/** Признаки самой строки. Отдельные EXISTS, а не один с OR — так каждый идёт по своему индексу `debts`. */
function ownLockedSql(a: string): string {
  return `(
    COALESCE(${a}.is_informational, false)
    OR ${a}.type = 'adjustment'
    OR ${a}.debt_id IS NOT NULL
    OR ${a}.settlement_id IS NOT NULL
    OR EXISTS (SELECT 1 FROM debts bl_d WHERE bl_d.transaction_id = ${a}.id)
    OR EXISTS (SELECT 1 FROM debts bl_d WHERE bl_d.source_transaction_id = ${a}.id)
    OR EXISTS (SELECT 1 FROM debts bl_d WHERE bl_d.fee_transaction_id = ${a}.id)
    OR EXISTS (SELECT 1 FROM debts bl_d WHERE bl_d.close_transaction_id = ${a}.id)
  )`;
}

/**
 * SQL-условие «строка вне массовой правки»: единый предикат для списка (`bulkLocked`), итога и
 * самой правки. Пара оплаты правится целиком, поэтому закрытая половина закрывает и вторую.
 */
export function lockedForBulkSql(alias: string): string {
  // `bl_s` занят подзапросом второй половины пары.
  assertSqlAlias(alias, ['bl_s']);
  return `(
    ${ownLockedSql(alias)}
    OR (${alias}.payment_group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM transactions bl_s
      WHERE bl_s.payment_group_id = ${alias}.payment_group_id AND bl_s.id <> ${alias}.id
        AND ${ownLockedSql('bl_s')}
    ))
  )`;
}
