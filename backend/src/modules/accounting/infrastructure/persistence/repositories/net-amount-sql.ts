import { DEBT_CATEGORY_IDS } from '../../../domain/constants/default-categories';
import { assertSqlAlias } from './sql-alias';

/**
 * Возвраты по долгам, указывающим на строку `alias`, через долг или закрывающую запись.
 * Развёрнуто в OR, а не в COALESCE, чтобы работали индексы `debts`.
 */
function ownReturnedSql(alias: string): string {
  return `COALESCE((
    SELECT SUM(nr.amount)
    FROM debts nd
    JOIN transactions nr
      ON (nr.debt_id IS NOT NULL AND nr.debt_id = nd.id)
      OR (nr.debt_id IS NULL AND nd.close_transaction_id = nr.id)
    WHERE (nd.source_transaction_id = ${alias}.id
        OR (nd.source_transaction_id IS NULL AND nd.transaction_id = ${alias}.id))
      AND nr.category_id = '${DEBT_CATEGORY_IDS.RETURN_TO_ME}'
  ), 0)`;
}

/**
 * «После возвратов от расхода что-то осталось» — `net > 0` ленты, но в SQL. Часть пары оплаты
 * берёт свои возвраты плюс излишек второй половины, как `paymentPartReturnedAmount`.
 */
export function positiveNetSql(alias: string): string {
  assertSqlAlias(alias);
  return `(
    ${alias}.amount > ${ownReturnedSql(alias)} + CASE
      WHEN ${alias}.payment_group_id IS NULL THEN 0
      ELSE COALESCE((
        SELECT GREATEST(0, ${ownReturnedSql('ns')} - ns.amount)
        FROM transactions ns
        WHERE ns.payment_group_id = ${alias}.payment_group_id AND ns.id <> ${alias}.id
        LIMIT 1
      ), 0)
    END
  )`;
}
