export interface BalanceInput {
  currency: string;
  balance: number;
}

export class CreateAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly icon: string,
    public readonly color: string,
    public readonly type: string = 'basic',
    public readonly order: number = 0,
    public readonly balances: BalanceInput[] = [],
  ) {}
}
