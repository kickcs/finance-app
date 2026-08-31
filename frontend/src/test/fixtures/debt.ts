import type { Debt } from '@/shared/api/database.types';

/**
 * Долг для тестов. Спеки долгов заводили эту заготовку по третьему разу и
 * каждая — со своим набором полей: добавленная колонка чинилась в одном файле
 * и молча ломала соседний.
 */
export function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    name: 'Долг от Азиза',
    total_amount: 1000,
    remaining_amount: 1000,
    monthly_payment: null,
    next_payment_date: null,
    created_at: '2026-07-01T00:00:00.000Z',
    debt_type: 'given',
    person_name: 'Азиз',
    account_id: null,
    transaction_id: null,
    close_transaction_id: null,
    is_closed: false,
    currency: 'UZS',
    source_transaction_id: null,
    description: null,
    closed_at: null,
    forgiven_amount: 0,
    is_private: false,
    fee_amount: 0,
    fee_transaction_id: null,
    ...overrides,
  };
}
