export class BulkImportCommand {
  constructor(
    public readonly userId: string,
    public readonly transactions: Array<{
      note: string | null;
      amount: number;
      categoryName: string;
      accountName: string;
      currency: string;
      date: string;
    }>,
  ) {}
}
