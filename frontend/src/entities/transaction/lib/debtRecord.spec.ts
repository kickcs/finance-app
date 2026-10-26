import { describe, it, expect } from 'vitest';
import { isDebtRecordOutsideSettlement } from './debtRecord';

const record = (overrides: Parameters<typeof isDebtRecordOutsideSettlement>[0]) => overrides;

describe('isDebtRecordOutsideSettlement', () => {
  it('долговая запись без расчёта — да', () => {
    expect(
      isDebtRecordOutsideSettlement(
        record({ is_debt_related: true, type: 'expense', settlement_id: null }),
      ),
    ).toBe(true);
  });

  it('запись расчёта — нет: её правит и снимает сервер', () => {
    expect(
      isDebtRecordOutsideSettlement(
        record({ is_debt_related: true, type: 'income', settlement_id: 's-1' }),
      ),
    ).toBe(false);
  });

  it('корректировка — нет: флаг долга у неё означает направление', () => {
    expect(
      isDebtRecordOutsideSettlement(
        record({ is_debt_related: true, type: 'adjustment', settlement_id: null }),
      ),
    ).toBe(false);
  });

  it('обычная запись — нет', () => {
    expect(
      isDebtRecordOutsideSettlement(
        record({ is_debt_related: false, type: 'expense', settlement_id: null }),
      ),
    ).toBe(false);
  });
});
