import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useCategories, resolveCategoryId, type Category } from '@/entities/category';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';

type DebtDirection = 'given' | 'taken';

/** Переплату по возврату мне пишут доходом, мою переплату — расходом. */
export function excessCategoriesFor(
  direction: DebtDirection,
  categories: { income: Category[]; expense: Category[] },
): Category[] {
  return direction === 'given' ? categories.income : categories.expense;
}

/** Дефолт переплаты — «Подарки» пользователя той же стороны, что и переплата. */
export function defaultExcessCategoryId(direction: DebtDirection, categories: Category[]): string {
  const builtinId = direction === 'given' ? CATEGORY_IDS.GIFTS_INCOME : CATEGORY_IDS.GIFTS;
  return resolveCategoryId(categories, builtinId);
}

/** Категории пользователя для шторок платежа по долгу. */
export function useDebtCategoryOptions(direction: MaybeRefOrGetter<DebtDirection>) {
  const { userId } = useCurrentUser();
  const { expenseCategories, incomeCategories } = useCategories(userId);

  const excessCategories = computed(() =>
    excessCategoriesFor(toValue(direction), {
      income: incomeCategories.value,
      expense: expenseCategories.value,
    }),
  );
  // Работу человека вы «покупаете» — трата; свою работу продаёте — доход.
  const workCategories = computed(() =>
    toValue(direction) === 'given' ? expenseCategories.value : incomeCategories.value,
  );

  return { excessCategories, workCategories };
}
