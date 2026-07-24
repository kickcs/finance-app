import { transactionsApi } from '@/entities/transaction';
import { debtsApi, buildDebtName, type DebtDirection } from '@/entities/debt';
import { CATEGORY_IDS } from '@/entities/category';

/** Черновик пометки импортированной операции как долга на человека. */
export interface DebtAssignState {
  personName: string;
  /** Комиссия за перевод — вычитается из суммы долга (только при выдаче). */
  fee: number;
}

export function emptyDebtAssign(): DebtAssignState {
  return { personName: '', fee: 0 };
}

/**
 * Направление долга по типу импортированной операции: расход → «дал в долг»,
 * доход → «взял в долг». Перевод долгом быть не может.
 */
export function debtDirectionForType(
  type: 'expense' | 'income' | 'transfer',
): DebtDirection | null {
  if (type === 'expense') return 'given';
  if (type === 'income') return 'taken';
  return null;
}

/** Сумма долга за вычетом комиссии, округлённая до копеек и не уходящая в минус. */
export function debtNetAmount(total: number, fee: number): number {
  return Math.max(0, Math.round((total - fee) * 100) / 100);
}

/** Fee-часть валидации — отдельно, чтобы шторка могла подсказывать реактивно. */
export function validateFee(fee: number, totalAmount: number): string | null {
  if (fee < 0) return 'Комиссия не может быть отрицательной';
  if (fee >= totalAmount) return 'Комиссия должна быть меньше суммы';
  return null;
}

/**
 * Валидация черновика перед созданием долга. Возвращает русский текст ошибки
 * или null, если всё в порядке.
 */
export function validateDebtAssign(
  state: DebtAssignState,
  totalAmount: number,
  direction: DebtDirection,
): string | null {
  if (!state.personName.trim()) {
    return direction === 'given'
      ? 'Укажите, кому вы дали в долг'
      : 'Укажите, у кого вы взяли в долг';
  }
  return validateFee(state.fee, totalAmount);
}

/**
 * Создаёт долг из импортированной операции: транзакция долга → сам долг →
 * линковка транзакции с долгом. Зеркало оркестрации useDebtForm.ts:56-117
 * (включая rollback транзакции при ошибке создания долга), но без skip_transaction —
 * при импорте транзакция создаётся всегда, т.к. деньги реально ушли/пришли на счёт.
 */
export async function createDebtForImport(
  userId: string,
  params: {
    direction: DebtDirection;
    personName: string;
    totalAmount: number;
    fee: number;
    accountId: string;
    currency: string;
    dateMs: number;
    description: string;
  },
): Promise<{ transactionId: string; debtId: string }> {
  const isGiven = params.direction === 'given';
  const categoryId = isGiven ? CATEGORY_IDS.DEBT_GIVEN : CATEGORY_IDS.DEBT_TAKEN;
  const amount = debtNetAmount(params.totalAmount, params.fee);
  const description =
    params.description || `${isGiven ? 'Дал в долг' : 'Взял в долг'}: ${params.personName}`;

  let transactionId: string | null = null;

  try {
    const transaction = await transactionsApi.create({
      user_id: userId,
      account_id: params.accountId,
      category_id: categoryId,
      amount,
      currency: params.currency,
      type: isGiven ? 'expense' : 'income',
      description,
      date: new Date(params.dateMs).toISOString(),
      is_debt_related: true,
    });
    transactionId = transaction.id;

    const debtName = buildDebtName(params.direction, params.personName);
    const debt = await debtsApi.create({
      user_id: userId,
      name: debtName,
      total_amount: amount,
      remaining_amount: amount,
      debt_type: params.direction,
      person_name: params.personName,
      account_id: params.accountId,
      transaction_id: transactionId,
      is_closed: false,
      currency: params.currency,
      description: params.description || null,
      is_private: false,
      next_payment_date: null,
    });

    await transactionsApi.update(transactionId, { debt_id: debt.id });

    return { transactionId, debtId: debt.id };
  } catch (e) {
    if (transactionId) {
      try {
        await transactionsApi.delete(transactionId);
      } catch (rollbackError) {
        console.error('Failed to rollback debt creation:', rollbackError);
      }
    }
    throw e;
  }
}

/**
 * Отдельная расходная транзакция на сумму комиссии за перевод — тот же счёт,
 * валюта и дата, что у импортированной операции.
 */
export async function createCommissionTransaction(
  userId: string,
  params: { accountId: string; amount: number; currency: string; dateMs: number },
): Promise<string> {
  const transaction = await transactionsApi.create({
    user_id: userId,
    account_id: params.accountId,
    category_id: CATEGORY_IDS.COMMISSION,
    amount: params.amount,
    currency: params.currency,
    type: 'expense',
    description: 'Комиссия за перевод',
    date: new Date(params.dateMs).toISOString(),
  });
  return transaction.id;
}
