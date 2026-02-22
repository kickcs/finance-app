export class CreateCheckoutCommand {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string | undefined,
    public readonly plan: 'premium_monthly' | 'premium_yearly',
  ) {}
}
