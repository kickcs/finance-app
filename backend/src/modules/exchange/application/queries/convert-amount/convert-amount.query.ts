export class ConvertAmountQuery {
  constructor(
    public readonly amount: number,
    public readonly fromCurrency: string,
    public readonly toCurrency: string,
  ) {}
}
