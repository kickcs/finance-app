/** Те же входные данные, что у `CloseAllDebtsCommand`, но без счёта, переплаты и даты: предпросмотр ничего не пишет. */
export class PreviewCloseAllQuery {
  constructor(
    public readonly userId: string,
    public readonly debtIds: string[],
    public readonly paymentAmount?: number,
    public readonly forgiveRemainder: boolean = false,
  ) {}
}
