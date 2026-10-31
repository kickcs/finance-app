import { lockedForBulkSql } from './bulk-eligibility';

describe('lockedForBulkSql', () => {
  it('подставляет алиас таблицы во все колонки строки', () => {
    const sql = lockedForBulkSql('tx');

    expect(sql).toContain('tx.is_informational');
    expect(sql).toContain("tx.type = 'adjustment'");
    expect(sql).toContain('tx.debt_id IS NOT NULL');
    expect(sql).toContain('tx.settlement_id IS NOT NULL');
    expect(sql).not.toMatch(/\bt\.(is_informational|debt_id|id)\b/);
  });

  it('проверяет все ссылки долга на строку', () => {
    const sql = lockedForBulkSql('t');

    expect(sql).toContain('transaction_id = t.id');
    expect(sql).toContain('source_transaction_id = t.id');
    expect(sql).toContain('fee_transaction_id = t.id');
    expect(sql).toContain('close_transaction_id = t.id');
  });

  it('отвергает алиас, который нельзя безопасно вставить в SQL', () => {
    expect(() => lockedForBulkSql('t; DROP TABLE transactions')).toThrow();
    expect(() => lockedForBulkSql('')).toThrow();
    // Этот алиас занят подзапросом второй половины пары.
    expect(() => lockedForBulkSql('bl_s')).toThrow();
  });
});
