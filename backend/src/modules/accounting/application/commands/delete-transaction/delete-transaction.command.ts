import type { EntityManager } from 'typeorm';

export class DeleteTransactionCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly skipDebtCheck = false,
    /** Внешняя транзакция БД: всё читается и пишется через неё, своя не открывается. */
    public readonly manager?: EntityManager,
  ) {}
}
