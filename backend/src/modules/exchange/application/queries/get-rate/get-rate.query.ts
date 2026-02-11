export class GetRateQuery {
  constructor(
    public readonly baseCurrency: string,
    public readonly targetCurrency: string,
  ) {}
}
