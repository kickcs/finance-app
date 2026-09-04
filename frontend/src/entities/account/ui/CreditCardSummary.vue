<script setup lang="ts">
import { computed } from 'vue';
import { UProgressBar } from '@/shared/ui/progress-bar';
import { formatCurrency } from '@/shared/lib/format/currency';
import { getCreditCardState } from '../model/creditCard';
import type { AccountWithBalances } from '../model/types';

const props = defineProps<{ account: AccountWithBalances }>();

// Лимит у счёта один на все валюты, поэтому метр и «доступно» показываем
// только по первой валюте; остальные идут тихими строками.
const primary = computed(() => props.account.balances?.[0] ?? null);
const primaryState = computed(() =>
  primary.value ? getCreditCardState(props.account, primary.value.balance) : null,
);
const restBalances = computed(() => props.account.balances?.slice(1) ?? []);
const currency = computed(() => primary.value?.currency ?? 'UZS');

const NEUTRAL = 'text-text-primary-light dark:text-text-primary-dark';

// Пустая карта не нуждается в подписи: «Долга нет» само себя объясняет.
const hero = computed(() => {
  const s = primaryState.value;
  if (!s) return { label: 'Задолженность', value: '—', class: NEUTRAL };
  if (s.debt > 0) {
    return {
      label: 'Задолженность',
      value: formatCurrency(s.debt, currency.value),
      class: 'text-danger',
    };
  }
  if (s.ownFunds > 0) {
    return {
      label: 'Свои средства',
      value: formatCurrency(s.ownFunds, currency.value),
      class: 'text-success',
    };
  }
  return { label: null, value: 'Долга нет', class: NEUTRAL };
});

const hasLimit = computed(() => typeof primaryState.value?.available === 'number');
const showMeter = computed(() => hasLimit.value && (primaryState.value?.debt ?? 0) > 0);
const meterColor = computed(() =>
  (primaryState.value?.utilization ?? 0) > 0.8 ? 'danger' : 'primary',
);

const params = computed(() => {
  const a = props.account;
  const rows: Array<{ key: string; label: string; value: string }> = [];
  if (typeof a.monthly_payment === 'number') {
    rows.push({
      key: 'payment',
      label: 'Мин. платёж',
      value: formatCurrency(a.monthly_payment, currency.value),
    });
  }
  if (typeof a.grace_period_days === 'number') {
    rows.push({ key: 'grace', label: 'Грейс-период', value: `${a.grace_period_days} дней` });
  }
  if (typeof a.billing_day === 'number') {
    rows.push({ key: 'billing', label: 'День выписки', value: `${a.billing_day}-е число` });
  }
  return rows;
});
</script>

<template>
  <div v-if="primaryState" class="space-y-4" data-testid="credit-card-summary">
    <!-- Герой: одна крупная сумма на весь экран -->
    <div class="space-y-1">
      <p v-if="hero.label" class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ hero.label }}
      </p>
      <p :class="['text-2xl font-bold tabular-nums tracking-tight', hero.class]">
        {{ hero.value }}
      </p>
    </div>

    <!-- Метр и концы дорожки: одна разметка на оба состояния, с долгом и без -->
    <div v-if="hasLimit" class="space-y-1.5">
      <UProgressBar
        v-if="showMeter"
        :value="primaryState.debt"
        :max="primaryState.limit ?? 0"
        :color="meterColor"
        aria-label="Использование кредитного лимита"
      />
      <div
        class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        data-testid="credit-card-track-ends"
      >
        <span>доступно {{ formatCurrency(primaryState.available ?? 0, currency) }}</span>
        <span>лимит {{ formatCurrency(primaryState.limit ?? 0, currency) }}</span>
      </div>
    </div>

    <p v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
      Укажите лимит, чтобы видеть доступный остаток
    </p>

    <!-- Параметры карты: подпись над значением, без точек-разделителей -->
    <div v-if="params.length" class="grid grid-cols-3 gap-3">
      <div v-for="p in params" :key="p.key" class="min-w-0">
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
          {{ p.label }}
        </p>
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ p.value }}
        </p>
      </div>
    </div>

    <!-- Остальные валюты -->
    <div v-if="restBalances.length" class="space-y-2 pt-1">
      <div
        v-for="balance in restBalances"
        :key="balance.currency"
        class="flex items-center justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ balance.currency }}
          </p>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ balance.balance < 0 ? 'долг' : 'свои средства' }}
          </p>
        </div>
        <span
          class="text-sm font-semibold tabular-nums"
          :class="
            balance.balance < 0
              ? 'text-danger'
              : 'text-text-primary-light dark:text-text-primary-dark'
          "
        >
          {{ formatCurrency(Math.abs(balance.balance), balance.currency) }}
        </span>
      </div>
    </div>
  </div>
</template>
