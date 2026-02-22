export class CreateCheckoutCommand {
  constructor(
    public readonly userId: string,
    public readonly userEmail: string,
    public readonly userName: string,
    public readonly plan: 'premium_monthly' | 'premium_yearly',
  ) {}
}
