import { describe, it, expect } from 'vitest';
import { ref, nextTick } from 'vue';
import { useDebtPaymentForm } from './useDebtPaymentForm';
import { CATEGORY_IDS } from '@/shared/config/categoryIds';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, type Category } from '@/entities/category';

function setup(remaining = 1000, debtType: 'given' | 'taken' = 'given') {
  const remainingAmount = ref(remaining);
  // Встроенные списки — как у демо-пользователя: дефолт находится по встроенному id.
  const excessCategories = debtType === 'given' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const form = useDebtPaymentForm({ remainingAmount, debtType, excessCategories });
  return { ...form, remainingAmount };
}

describe('useDebtPaymentForm', () => {
  it('делит сумму на переплату и остаток по одну сторону остатка долга', () => {
    const f = setup(1000);

    f.paymentAmount.value = 400;
    expect(f.isOverpayment.value).toBe(false);
    expect(f.excess.value).toBe(0);
    expect(f.remainder.value).toBe(600);

    f.paymentAmount.value = 1500;
    expect(f.isOverpayment.value).toBe(true);
    expect(f.excess.value).toBe(500);
    expect(f.remainder.value).toBe(0);
  });

  it('ровный платёж переплатой не считается', () => {
    const f = setup(1000);
    f.paymentAmount.value = 1000;
    expect(f.isOverpayment.value).toBe(false);
    expect(f.remainder.value).toBe(0);
  });

  // Прощать нечего, когда платят больше долга: галочка, оставленная от прежней
  // суммы, отправила бы на сервер прощение отрицательного остатка.
  it('переход к переплате снимает прощение остатка', async () => {
    const f = setup(1000);
    f.paymentAmount.value = 400;
    f.forgiveRemainder.value = true;

    f.paymentAmount.value = 1500;
    await nextTick();

    expect(f.forgiveRemainder.value).toBe(false);
  });

  it('следит за остатком долга, а не за его снимком', () => {
    const f = setup(1000);
    f.paymentAmount.value = 900;
    f.remainingAmount.value = 500;
    expect(f.isOverpayment.value).toBe(true);
    expect(f.excess.value).toBe(400);
  });

  it('сброс возвращает форму к остатку и снимает прощение', () => {
    const f = setup(1000);
    f.paymentAmount.value = 100;
    f.forgiveRemainder.value = true;

    f.reset();

    expect(f.paymentAmount.value).toBe(1000);
    expect(f.forgiveRemainder.value).toBe(false);
  });

  it('сброс принимает свою сумму — шторка открывается с остатком конкретного долга', () => {
    const f = setup(1000);
    f.reset(250);
    expect(f.paymentAmount.value).toBe(250);
  });

  it('категория переплаты идёт по направлению долга: свои деньги возвращаются доходом', () => {
    const given = setup(1000, 'given');
    given.reset();
    expect(given.excessCategoryId.value).toBe(CATEGORY_IDS.GIFTS_INCOME);

    const taken = setup(1000, 'taken');
    taken.reset();
    expect(taken.excessCategoryId.value).toBe(CATEGORY_IDS.GIFTS);
  });

  // Встроенного `gifts_income` у реального пользователя нет: переплата уходила
  // в категорию, которой нет в его списке.
  it('дефолт переплаты — категория пользователя, даже если она пришла позже', async () => {
    const categories = ref<Category[]>([]);
    const f = useDebtPaymentForm({
      remainingAmount: ref(1000),
      debtType: 'given',
      excessCategories: categories,
    });

    categories.value = [
      { id: 'u-salary', name: 'Зарплата', icon: 'payments', color: '#000', type: 'income' },
      { id: 'u-gifts', name: 'Подарки', icon: 'redeem', color: '#000', type: 'income' },
    ];
    await nextTick();

    expect(f.excessCategoryId.value).toBe('u-gifts');
  });
});
