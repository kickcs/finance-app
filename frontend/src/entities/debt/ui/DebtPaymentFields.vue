<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { CategoryChips, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/entities/category';
import { formatCurrency } from '@/shared/lib/format/currency';
import ForgivenessToggle from './ForgivenessToggle.vue';

/**
 * Общий блок полей платежа: плашка переплаты + категория, тумблер прощения,
 * плашка «весь долг будет прощён». Раньше это ~120 строк, продублированных
 * дословно между `PaymentDrawer` и `CloseAllDebtsDrawer` — форма живёт
 * у родителя (там же `reset()` на открытии), этот компонент только считает
 * производные от `amount`/`remaining` и рисует.
 */
const props = defineProps<{
  remaining: number;
  currency: string;
  direction: 'given' | 'taken';
}>();

const amount = defineModel<number>('amount', { required: true });
const forgiveRemainder = defineModel<boolean>('forgiveRemainder', { required: true });
const excessCategoryId = defineModel<string>('excessCategoryId', { required: true });

const isOverpayment = computed(() => amount.value > props.remaining);
const excess = computed(() => (isOverpayment.value ? amount.value - props.remaining : 0));
const remainder = computed(() => (isOverpayment.value ? 0 : props.remaining - amount.value));

const excessCategories = computed(() =>
  props.direction === 'given' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES,
);
</script>

<template>
  <div class="space-y-3">
    <!-- Overpayment Info & Category Selector -->
    <div v-if="isOverpayment" class="space-y-3">
      <div class="p-3 rounded-xl bg-primary/5 border border-primary/20">
        <div class="flex items-start gap-2">
          <UIcon name="info" size="sm" class="text-primary mt-0.5 shrink-0" />
          <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
            Сумма превышает долг на
            <span class="font-semibold text-primary">
              {{ formatCurrency(excess, currency) }}
            </span>
            . Разница будет записана как
            {{ direction === 'given' ? 'отдельный доход' : 'отдельный расход' }}.
          </p>
        </div>
      </div>
      <CategoryChips
        :categories="excessCategories"
        :selected-id="excessCategoryId"
        label="Категория переплаты"
        @select="excessCategoryId = $event"
      />
    </div>

    <!-- Forgiveness Toggle (only when amount < remaining) -->
    <div v-if="!isOverpayment && amount < remaining" class="space-y-2">
      <ForgivenessToggle
        v-model="forgiveRemainder"
        :remainder-amount="remainder"
        :currency="currency"
      />
    </div>

    <!-- Forgiveness-only info (when amount = 0 and forgiving) -->
    <div
      v-if="amount === 0 && forgiveRemainder"
      class="p-3 rounded-xl bg-warning/5 border border-warning/20"
    >
      <div class="flex items-start gap-2">
        <UIcon name="volunteer_activism" size="sm" class="text-warning mt-0.5 shrink-0" />
        <!-- Слот, а не проп: закрытие всех долгов человека перечисляет суммы по
             валютам и говорит во множественном числе — одной подстановкой суммы
             такую фразу не собрать. Оформление плашки при этом общее. -->
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
          <slot name="forgive-note">
            Весь долг
            <span class="font-semibold">
              {{ formatCurrency(remaining, currency) }}
            </span>
            будет прощён и списан как подарок.
          </slot>
        </p>
      </div>
    </div>
  </div>
</template>
