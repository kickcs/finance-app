import type { EntityManager } from 'typeorm';

/** Отмена расчёта целиком: все записи с этим `settlement_id` и их влияние на долги и счета. */
export class ReverseSettlementCommand {
  constructor(
    public readonly settlementId: string,
    public readonly userId: string,
    /** Внешняя транзакция БД: отмена идёт внутри неё и своей не открывает. */
    public readonly manager?: EntityManager,
  ) {}
}
