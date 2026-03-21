export interface QuickAction {
  id: string;
  label: string;
  categoryId: string;
  accountId: string;
  amount: number | null;
}

export interface QuickActionPayload {
  label: string;
  categoryId: string;
  accountId: string;
  amount?: number | null;
}
