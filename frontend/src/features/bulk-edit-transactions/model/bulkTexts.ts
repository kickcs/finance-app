import { pluralize } from '@/shared/lib/format/pluralize';
import type { BulkAction, BulkSkipReason, TransactionsSummary } from '@/entities/transaction';

export const opsCount = (n: number) => `${n} ${pluralize(n, 'операция', 'операции', 'операций')}`;
export const opsAccusative = (n: number) =>
  `${n} ${pluralize(n, 'операцию', 'операции', 'операций')}`;
const opsDative = (n: number) => `${n} ${pluralize(n, 'операции', 'операциям', 'операциям')}`;
export const opsInstrumental = (n: number) =>
  `${n} ${pluralize(n, 'операцией', 'операциями', 'операциями')}`;
export const opsGenitive = (n: number) =>
  `${n} ${pluralize(n, 'операции', 'операций', 'операций')}`;

const willNotChange = (n: number) => `не ${pluralize(n, 'изменится', 'изменятся', 'изменятся')}`;

// Вне правки и строки долгов (с их информационными отметками), и корректировки баланса.
const LOCKED_WHERE =
  'связанные с долгом правятся из карточки долга, корректировки баланса — по одной';

const paidFromTwo = (n: number) =>
  `${opsCount(n)} ${pluralize(n, 'оплачена', 'оплачены', 'оплачены')} с двух счетов`;

/** Причины пропуска приходят кодами; формулировки зависят от того, что именно делали. */
export function skipReasonText(
  reason: BulkSkipReason,
  count: number,
  action: BulkAction['kind'],
): string {
  const ops = opsCount(count);
  switch (reason) {
    case 'locked':
      return `${ops} ${willNotChange(count)}: ${LOCKED_WHERE}`;
    case 'wrong_type':
      return action === 'transfer'
        ? `${ops} не ${pluralize(count, 'расход', 'расходы', 'расходы')}`
        : `${ops} другого типа: у категории иной тип`;
    case 'same_account':
      return `${ops} уже на этом счёте`;
    // Перевод пропускает пару, даже если на целевом счёте та половина, что попала в выборку.
    case 'pair_on_target':
      return action === 'transfer'
        ? `${paidFromTwo(count)}, одна из частей уже на этом счёте`
        : `${paidFromTwo(count)}, вторая часть уже на этом счёте`;
    case 'pair_split':
      return `${paidFromTwo(count)}: счёт такой оплаты меняется в карточке операции`;
    case 'already_in_category':
      return `${ops} уже в этой категории`;
    case 'already_tagged':
      return `${ops} уже с этим тегом`;
    case 'transfer_not_movable':
      return `${count} ${pluralize(count, 'перевод', 'перевода', 'переводов')} нельзя перенести на другой счёт`;
  }
}

export interface BulkActionTexts {
  /** Заголовок шторки подтверждения. */
  title: string;
  /** Кнопка подтверждения. */
  button: string;
  /** Тост после применения. */
  applied: string;
  /** Пояснение под сводкой. */
  note: string;
}

/** Все тексты действия: `count` — сколько операций, `target` — имя категории или счёта-цели. */
export function actionTexts(action: BulkAction, count: number, target = ''): BulkActionTexts {
  const ops = opsCount(count);
  switch (action.kind) {
    case 'category':
      return {
        title: `Перенести в «${target}»`,
        button: `Перенести ${opsAccusative(count)}`,
        applied: `${ops} теперь в «${target}»`,
        note: 'Суммы и балансы счетов не изменятся.',
      };
    case 'transfer':
      return {
        title: 'Сделать переводами',
        button: `Сделать ${pluralize(count, 'переводом', 'переводами', 'переводами')} ${opsAccusative(count)}`,
        applied: `${ops} ${pluralize(count, 'стала переводом', 'стали переводами', 'стали переводами')} на «${target}»`,
        note: `Деньги по-прежнему списаны с исходных счетов, но теперь это пополнение «${target}», а не расход.`,
      };
    case 'account':
      return {
        title: `Перенести на «${target}»`,
        button: `Перенести ${opsAccusative(count)}`,
        applied: `${ops} ${pluralize(count, 'перенесена', 'перенесены', 'перенесены')} на «${target}»`,
        note: 'Суммы не изменятся, поменяются балансы счетов.',
      };
    case 'tag':
      return {
        title: `Добавить тег #${action.tag}`,
        button: `Добавить тег к ${opsDative(count)}`,
        applied: `Тег #${action.tag} добавлен к ${opsDative(count)}`,
        note: 'Тег добавится в описание операций.',
      };
    case 'delete':
      return {
        title: `Удалить ${opsAccusative(count)}?`,
        button: `Удалить ${opsAccusative(count)}`,
        applied: `Удалено: ${ops}`,
        note: 'Балансы счетов пересчитаются. Сразу после удаления его можно отменить.',
      };
  }
}

/**
 * Подпись итога на плашке и в шторке. Кнопка «Изменить все» берёт `eligible_count`,
 * поэтому строки вне правки названы отдельно — иначе подпись и число не сойдутся.
 */
export function summaryLabel(
  summary: Pick<TransactionsSummary, 'count' | 'locked_count'>,
  filtered: boolean,
): string {
  const ops = opsCount(summary.count);
  if (!filtered) return ops;
  return summary.locked_count > 0
    ? `${ops}, ${summary.locked_count} ${willNotChange(summary.locked_count)}`
    : `${ops} по фильтру`;
}

/** Строки вне правки в «Изменить все» не входят: объясняем, куда за ними идти. */
export function lockedNote(count: number): string {
  const included = pluralize(count, 'входит', 'входят', 'входят');
  return `${opsCount(count)} в выборку не ${included}: ${LOCKED_WHERE}.`;
}
