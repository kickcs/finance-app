export class GetDebtsQuery {
  constructor(
    public readonly userId: string,
    /** `active` — только открытые. Без фильтра приходят все, включая закрытые. */
    public readonly status?: 'active' | 'closed',
  ) {}
}
