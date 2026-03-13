import type { Budget } from '../../domain/aggregates/budget';

export class BudgetResponseMapper {
  static toResponse(budget: Budget) {
    return {
      id: budget.id,
      userId: budget.userId,
      year: budget.year,
      month: budget.month,
      amount: budget.amount,
      currency: budget.currency,
      isDefault: budget.isDefault,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
