<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UProgressBar } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { formatCurrency, formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { useHaptics } from '@/shared/lib/haptics';
import {
  DEBT_DIRECTION_COLORS,
  DEBT_DIRECTION_DISPLAY,
  getDebtProgress,
  maskDebtName,
  isDebtOverdue,
} from '../model/types';
import type { Debt } from '../model/types';

/**
 * Строка долга — открытого и погашенного.
 *
 * Раньше это были две карточки с одинаковым каркасом: кнопка, значок, имя со
 * значком приватности, сумма справа, полоса внизу. Расходились они только тем,
 * что показывают, — и правка в одной регулярно не доезжала до второй.
 */
const props = defineProps<{
  debt: Debt;
  compact?: boolean;
  /** Валюта пользователя: у погашенного чужая валюта подписывается рядом с суммой. */
  userCurrency?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { trigger } = useHaptics();

function handleClick() {
  trigger('selection');
  emit('click');
}

const debtCurrency = computed(() => props.debt.currency || DEFAULT_CURRENCY);
const isClosed = computed(() => props.debt.is_closed);
const isForgiven = computed(() => props.debt.forgiven_amount > 0);
const isOverdue = computed(() => isDebtOverdue(props.debt) && !props.debt.is_closed);
const progress = computed(() => getDebtProgress(props.debt));
const displayName = computed(() => maskDebtName(props.debt));
const debtLabel = computed(() => DEBT_DIRECTION_DISPLAY[props.debt.debt_type]);
const debtColor = computed(() => DEBT_DIRECTION_COLORS[props.debt.debt_type]);
const isFromSplit = computed(() => !!props.debt.source_transaction_id);

const nextPaymentFormatted = computed(() => {
  if (!props.debt.next_payment_date) return null;
  return formatDate(props.debt.next_payment_date, { format: 'short' });
});

const showCurrencyBadge = computed(
  () => isClosed.value && !!props.userCurrency && props.debt.currency !== props.userCurrency,
);

/** Сколько дней долг прожил — подпись под лентой погашенного. */
const durationDays = computed(() => {
  if (!props.debt.closed_at) return null;
  const start = new Date(props.debt.created_at).getTime();
  const end = new Date(props.debt.closed_at).getTime();
  return Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
});

// Тон погашенного: прощённый — предупреждающий, оплаченный — успешный.
// Классы перечислены целиком: собранные строкой Tailwind до сборки не видит.
const closedIconClass = computed(() =>
  isForgiven.value ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success',
);
const closedBarColor = computed(() => (isForgiven.value ? 'warning' : 'success'));

// Подложка значка — токеном, а не инлайновым `${debtColor}15`: цвета направления
// сами приезжают как `var(--color-…)`, и склейка с альфой давала невалидный CSS,
// то есть значок сидел вообще без подложки.
const openIconClass = computed(() => {
  if (isOverdue.value) return 'bg-danger/10 text-danger';
  return props.debt.debt_type === 'given'
    ? 'bg-debt-given-light text-debt-given'
    : 'bg-debt-received-light text-debt-received';
});

const ariaLabel = computed(() => {
  if (isClosed.value) {
    return props.debt.is_private
      ? `${debtLabel.value}, скрытый долг, погашен`
      : `${displayName.value}, ${formatCurrency(props.debt.total_amount, debtCurrency.value)}, погашен`;
  }
  return props.debt.is_private
    ? `${debtLabel.value}, скрытый долг`
    : `${displayName.value}, ${formatCurrency(props.debt.remaining_amount, debtCurrency.value)}`;
});
</script>

<template>
  <button
    :class="
      cn(
        'w-full text-left rounded-xl transition-all',
        'bg-card-light dark:bg-card-dark',
        'border border-border-light dark:border-border-dark',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
        isClosed
          ? 'p-3.5 duration-150 hover:bg-surface-light dark:hover:bg-surface-dark active:scale-[0.99]'
          : 'duration-200 hover:scale-[1.01] active:scale-[0.99]',
        !isClosed && (compact ? 'p-2.5' : 'p-3'),
        isOverdue && 'bg-danger/[0.03] !border-danger/15',
      )
    "
    :aria-label="ariaLabel"
    @click="handleClick"
  >
    <div :class="cn('flex items-center gap-2.5', isClosed && 'mb-2.5')">
      <div
        :class="
          cn(
            'shrink-0 w-9 h-9 flex items-center justify-center',
            isClosed
              ? cn('rounded-full opacity-70', closedIconClass)
              : cn('rounded-lg', openIconClass),
          )
        "
      >
        <UIcon
          v-if="isClosed"
          :name="isForgiven ? 'volunteer_activism' : 'check_circle'"
          size="sm"
        />
        <UIcon
          v-else
          :name="debt.debt_type === 'given' ? 'arrow_upward' : 'arrow_downward'"
          size="sm"
        />
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark truncate flex items-center gap-1"
            >
              {{ displayName }}
              <UIcon
                v-if="debt.is_private"
                name="visibility_off"
                size="xs"
                class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
              />
            </p>
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark flex items-center gap-1"
            >
              {{ debtLabel }}
              <span
                v-if="isFromSplit && !isClosed"
                class="inline-flex items-center gap-0.5 text-primary"
              >
                <UIcon name="group" size="xs" />
              </span>
            </p>
          </div>

          <div class="text-right shrink-0">
            <p
              :class="
                cn(
                  'text-sm font-semibold',
                  isClosed
                    ? 'text-text-secondary-light dark:text-text-secondary-dark'
                    : 'text-text-primary-light dark:text-text-primary-dark',
                )
              "
            >
              {{
                formatMasked(
                  isClosed ? debt.total_amount : debt.remaining_amount,
                  debtCurrency,
                  debt.is_private,
                )
              }}
            </p>
            <span v-if="isForgiven && isClosed" class="text-xs text-warning font-medium">
              Прощён
            </span>
            <span v-else-if="isClosed" class="text-xs text-success">Погашен</span>
            <span
              v-else-if="nextPaymentFormatted"
              class="text-xs"
              :class="
                isOverdue ? 'text-danger' : 'text-text-tertiary-light dark:text-text-tertiary-dark'
              "
            >
              {{ nextPaymentFormatted }}
            </span>
            <span
              v-if="showCurrencyBadge"
              data-testid="debt-card-currency"
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark ml-1"
            >
              {{ debt.currency }}
            </span>
          </div>
        </div>

        <UProgressBar
          v-if="!isClosed && progress > 0"
          :value="progress"
          :color="isOverdue ? 'danger' : debtColor"
          size="xs"
          class="mt-1.5"
        />
      </div>
    </div>

    <!-- Лента жизни погашенного долга: создан → закрыт -->
    <template v-if="isClosed && debt.closed_at">
      <div
        class="flex items-center gap-2 pt-2.5 border-t border-border-light/50 dark:border-border-dark/50"
      >
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ formatDate(debt.created_at, { format: 'short' }) }}
        </span>
        <UProgressBar :value="100" :color="closedBarColor" size="xs" class="flex-1" />
        <span
          class="text-xs font-medium shrink-0"
          :class="isForgiven ? 'text-warning' : 'text-success'"
        >
          {{ formatDate(debt.closed_at, { format: 'short' }) }}
        </span>
      </div>

      <div class="flex justify-between mt-1">
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Создан</span>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ durationDays ? `${durationDays} дн.` : '' }}
          {{ isForgiven ? ' · Прощён' : '' }}
        </span>
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">Закрыт</span>
      </div>
    </template>
  </button>
</template>
