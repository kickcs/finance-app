import { BadRequestException, ConflictException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Debt } from '../../domain/aggregates/debt';
import type { IDebtRepository } from '../../domain/repositories';
import { DEBT_CATEGORY_IDS } from '../../../accounting/domain/constants/default-categories';
import { loadOwnedDebt } from './debt-lock';
import { displayName, type PaymentPlan, type SettlementDebt } from './settlement-plan';
import type { SettlementWriter } from './settlement-writer';

export interface DebtPaymentInput {
  debt: Debt;
  /** План из `planPayment` по остатку долга на момент записи. */
  plan: PaymentPlan;
  accountId: string;
  date: Date;
  excessCategoryId?: string;
  settleWithWork?: boolean;
  workNote?: string;
  workCategoryId?: string;
}

export interface DebtPaymentRecords {
  /** Запись самого платежа. Null, когда остаток только прощён. */
  paymentTransactionId: string | null;
  /** Идентификаторы созданных записей — в порядке создания. */
  transactionIds: string[];
}

export function toSettlementDebt(debt: Debt): SettlementDebt {
  return {
    id: debt.id,
    debtType: debt.debtTypeValue,
    remaining: debt.remainingAmountValue,
    createdAt: debt.createdAt,
  };
}

/** Долг расчёта должен быть своим и открытым; `known` — долги, прочитанные заранее (под замком или одним запросом). */
export async function loadOpenDebt(
  debtRepository: IDebtRepository,
  userId: string,
  debtId: string,
  source: { manager?: EntityManager; known?: ReadonlyMap<string, Debt> } = {},
): Promise<Debt> {
  const debt = await loadOwnedDebt(debtRepository, userId, debtId, {
    ...source,
    forbidden: 'Debt belongs to another user',
  });
  if (debt.isClosed) throw new ConflictException('Долг уже закрыт');
  return debt;
}

/**
 * Записи платежа по долгу и сам долг: общее для одиночного платежа и «Закрыть все».
 * Остаток и закрытие считает агрегат, долг сохраняется в транзакции писателя.
 *
 * Отработка идёт тем же путём, но платёж записывается информационной отметкой —
 * денег на счетах от неё не прибавилось.
 */
export async function writeDebtPayment(
  writer: SettlementWriter,
  input: DebtPaymentInput,
): Promise<DebtPaymentRecords> {
  const { manager, userId } = writer;
  const { debt, plan, accountId, date, excessCategoryId, workNote, workCategoryId } = input;
  const settleWithWork = input.settleWithWork ?? false;
  const { actualPayment, excess, forgiven, willClose } = plan;

  const isGiven = debt.debtTypeValue === 'given';
  const currency = debt.currency;
  const transactionIds: string[] = [];
  let paymentTransactionId: string | null = null;
  // Долг, заведённый без движения денег, возвращается такой же информационной
  // записью: иначе возврат создаст баланс, которого не создавала выдача.
  const hadBalanceEffect = !!debt.transactionId || !!debt.sourceTransactionId;
  let closeTransactionId: string | undefined;

  if (actualPayment > 0) {
    // Отработка ложится на счёт долга — как и прощение: денег она не
    // двигает (или двигает в ноль), но должна лежать на живом счёте.
    const workAccountId = settleWithWork
      ? await markerAccountId(manager, userId, debt.accountId, accountId)
      : accountId;

    /**
     * Отработка с категорией — пара записей, дающая по балансу ноль: трата
     * по выбранной категории (работу вы «купили») и обычный возврат долга.
     * Так работа видна в аналитике тратой, а долг гасится теми же
     * возвратами, что и деньгами: сумма уходит из «Невозвращённых долгов»
     * в выбранную категорию, а не исчезает из отчёта.
     *
     * Обе ноги живут и снимаются только вместе — одна оставила бы на счёте
     * дыру на свою сумму. Связаны они долгом и расчётом: `debt_id` с
     * недолговой категорией бывает только у ноги работы.
     */
    if (settleWithWork && workCategoryId) {
      transactionIds.push(
        await writer.record({
          accountId: workAccountId,
          categoryId: workCategoryId,
          amount: actualPayment,
          currency,
          type: isGiven ? 'expense' : 'income',
          date,
          description: workDescription(debt, workNote),
          isDebtRelated: false,
          debtId: debt.id,
        }),
      );
    }

    // Отработка без категории — не движение денег, а отметка: баланс счёта
    // она не трогает и в аналитику не попадает, как взаимозачёт и прощение.
    const asMarker = settleWithWork && !workCategoryId;

    const id = await writer.record({
      accountId: workAccountId,
      categoryId: asMarker
        ? DEBT_CATEGORY_IDS.WORKED_OFF
        : isGiven
          ? DEBT_CATEGORY_IDS.RETURN_TO_ME
          : DEBT_CATEGORY_IDS.RETURN_FROM_ME,
      amount: actualPayment,
      currency,
      type: isGiven ? 'income' : 'expense',
      date,
      description: asMarker ? workDescription(debt, workNote) : paymentDescription(debt, willClose),
      isDebtRelated: asMarker ? false : hadBalanceEffect,
      debtId: debt.id,
      isInformational: asMarker,
    });
    closeTransactionId = id;
    paymentTransactionId = id;
    transactionIds.push(id);
  }

  if (excess > 0 && excessCategoryId) {
    transactionIds.push(
      await writer.record({
        accountId,
        categoryId: excessCategoryId,
        amount: excess,
        currency,
        type: isGiven ? 'income' : 'expense',
        date,
        description: `Переплата по долгу: ${displayName(debt)}`,
        isDebtRelated: false,
      }),
    );
  }

  // Прощение видно в ленте всегда, даже если выдача уже двигала деньги:
  // пользователю нужно событие, а не только изменившийся остаток.
  if (forgiven > 0) {
    const id = await writer.record({
      accountId: await markerAccountId(manager, userId, debt.accountId, accountId),
      categoryId: DEBT_CATEGORY_IDS.FORGIVEN,
      amount: forgiven,
      currency,
      type: isGiven ? 'expense' : 'income',
      date,
      description: `Прощение долга: ${displayName(debt)}`,
      isDebtRelated: false,
      debtId: debt.id,
      isInformational: true,
    });
    transactionIds.push(id);
    closeTransactionId ??= id;
  }

  if (actualPayment > 0) debt.makePayment(actualPayment);
  if (forgiven > 0) debt.setForgivenAmount(forgiven);
  if (willClose) debt.close();
  if (willClose && closeTransactionId) debt.setCloseTransactionId(closeTransactionId);

  await writer.saveDebt(debt);
  return { paymentTransactionId, transactionIds };
}

/**
 * Зачёт по долям плана: стороны гасятся независимо (суммы обеих равны), долги —
 * старыми первыми, как их выстроил план. Каждая доля — информационная отметка на долге
 * и его новый остаток: деньги не двигаются, поэтому запись видна в ленте, но не трогает
 * баланс и аналитику. Возвращает затронутые долги в порядке долей.
 */
export async function writeOffsetParts(
  writer: SettlementWriter,
  debtById: ReadonlyMap<string, Debt>,
  parts: readonly { debtId: string; amount: number }[],
  date: Date,
): Promise<Debt[]> {
  if (parts.length === 0) return [];

  const accounts = await resolveAccounts(writer.manager, writer.userId);
  const touched: Debt[] = [];
  for (const { debtId, amount } of parts) {
    const debt = debtById.get(debtId)!;
    const id = await writer.record({
      accountId: accounts.pick(debt.accountId),
      categoryId: DEBT_CATEGORY_IDS.OFFSET,
      amount,
      currency: debt.currency,
      type: debt.debtTypeValue === 'given' ? 'income' : 'expense',
      date,
      description: `Взаимозачёт: ${displayName(debt)}`,
      isDebtRelated: false,
      debtId: debt.id,
      isInformational: true,
    });

    // Остаток и закрытие считает агрегат: правило «платёж в ноль закрывает
    // долг» должно быть одним и тем же для зачёта и для обычного платежа.
    debt.makePayment(amount);
    if (debt.isClosed) debt.setCloseTransactionId(id);

    await writer.saveDebt(debt);
    touched.push(debt);
  }
  return touched;
}

/**
 * Информационная запись всё равно должна лежать на существующем счёте.
 * `debts.account_id` живёт без внешнего ключа и может указывать на удалённый
 * счёт, поэтому рядом с проверкой держим запасной счёт пользователя.
 */
async function resolveAccounts(
  db: Pick<EntityManager, 'query'>,
  userId: string,
): Promise<{
  /** Счёт долга, если он ещё существует, иначе запасной. */
  pick(accountId: string | null): string;
}> {
  const rows: { id: string }[] = await db.query(
    'SELECT id FROM accounts WHERE user_id = $1 ORDER BY "order" ASC, created_at ASC',
    [userId],
  );
  if (rows.length === 0) {
    throw new BadRequestException('Нет счёта, к которому можно привязать запись о зачёте');
  }

  const existing = new Set(rows.map((r) => r.id));
  const fallbackId = rows[0].id;
  return {
    pick: (accountId) => (accountId && existing.has(accountId) ? accountId : fallbackId),
  };
}

/**
 * Информационную отметку (прощение, отработка) хочется положить на счёт
 * долга, ради точности истории. Но
 * `debts.account_id` живёт без внешнего ключа и может указывать на удалённый
 * счёт, а упавший внутри транзакции запрос уже не повторить — поэтому счёт
 * проверяется заранее, и при промахе запись ложится на счёт платежа.
 */
async function markerAccountId(
  manager: EntityManager,
  userId: string,
  preferred: string | null,
  fallback: string,
): Promise<string> {
  if (!preferred || preferred === fallback) return fallback;
  const rows = await manager.query<{ id: string }[]>(
    'SELECT id FROM accounts WHERE id = $1 AND user_id = $2 LIMIT 1',
    [preferred, userId],
  );
  return rows.length > 0 ? preferred : fallback;
}

/** Что именно отработано, если пользователь это написал: «Отработка долга: Тимур — ремонт». */
function workDescription(debt: Debt, workNote?: string): string {
  const note = workNote?.trim();
  const base = `Отработка долга: ${displayName(debt)}`;
  return note ? `${base} — ${note}` : base;
}

function paymentDescription(debt: Debt, willClose: boolean): string {
  if (!willClose) return `Частичный платёж: ${displayName(debt)}`;
  if (debt.sourceTransactionId) return `Возврат от ${displayName(debt)}: доля в общем счёте`;
  return `Закрытие долга: ${displayName(debt)}`;
}
