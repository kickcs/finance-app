import { type QuickAction } from '../../domain/aggregates/quick-action';

export function toQuickActionResponse(a: QuickAction) {
  return {
    id: a.id,
    userId: a.userId,
    categoryId: a.categoryId,
    accountId: a.accountId,
    label: a.label,
    position: a.position,
    amount: a.amount ?? null,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
