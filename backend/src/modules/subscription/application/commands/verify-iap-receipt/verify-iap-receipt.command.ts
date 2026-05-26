export class VerifyIapReceiptCommand {
  constructor(
    public readonly userId: string,
    public readonly platform: 'ios' | 'android',
    public readonly productId: string,
    public readonly transactionId: string,
    public readonly receipt: string,
  ) {}
}
