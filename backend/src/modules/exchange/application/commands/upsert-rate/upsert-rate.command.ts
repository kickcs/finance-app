export class UpsertRateCommand {
  constructor(
    public readonly baseCurrency: string,
    public readonly targetCurrency: string,
    public readonly rate: number,
  ) {}
}
