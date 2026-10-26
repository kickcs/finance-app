import { hasMixedCurrencies, type CloseAllInput, type CloseAllPreviewInput } from '@/entities/debt';
import type { Debt } from '@/shared/api/database.types';

export interface CloseAllInputOptions {
  paymentAmount?: number;
  forgiveRemainder?: boolean;
  excessCategoryId?: string;
  /** ISO-дата создаваемых записей (по умолчанию — сейчас). Для импорта — occurred_at. */
  transactionDate?: string;
}

/** Часть входа, от которой зависит расчёт предпросмотра. */
export type CloseAllPreviewOptions = Pick<
  CloseAllInputOptions,
  'paymentAmount' | 'forgiveRemainder'
>;

/**
 * Вход предпросмотра «Закрыть все»: долги и сумма без счёта. Исполнение строит свой вход из
 * него же (`buildCloseAllInput`), поэтому сервер считает по одному и тому же.
 */
export function buildCloseAllPreviewInput(
  debts: Debt[],
  options: CloseAllPreviewOptions = {},
): CloseAllPreviewInput {
  const input: CloseAllPreviewInput = { debt_ids: debts.map((d) => d.id) };

  // Разные валюты одной суммой не набрать: шлём только «оплатить всё» (без суммы)
  // или «простить всё» (флаг без суммы).
  if (!hasMixedCurrencies(debts) && options.paymentAmount !== undefined) {
    input.payment_amount = options.paymentAmount;
  }
  if (options.forgiveRemainder) input.forgive_remainder = true;

  return input;
}

/** Тело «Закрыть все» из того, что выбрано в шторке: предпросмотр плюс счёт, переплата и дата. */
export function buildCloseAllInput(
  debts: Debt[],
  accountId: string,
  options: CloseAllInputOptions = {},
): CloseAllInput {
  const input: CloseAllInput = {
    ...buildCloseAllPreviewInput(debts, options),
    account_id: accountId,
  };

  if (!hasMixedCurrencies(debts) && options.excessCategoryId) {
    input.excess_category_id = options.excessCategoryId;
  }
  if (options.transactionDate) input.date = options.transactionDate;

  return input;
}
