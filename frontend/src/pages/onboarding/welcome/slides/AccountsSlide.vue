<script setup lang="ts">
import { UIcon } from '@/shared/ui';

const accountTypes = [
  { icon: 'payments', color: 'success', label: 'Наличные', amount: '12 450 ₽' },
  {
    icon: 'credit_card',
    color: 'primary',
    label: 'Банковские карты',
    amount: '84 200 ₽',
  },
  {
    icon: 'account_balance',
    color: 'warning',
    label: 'Депозиты',
    amount: '500 000 ₽',
  },
  {
    icon: 'account_balance_wallet',
    color: 'debt-received',
    label: 'Кошельки',
    amount: '1 250 $',
  },
] as const;

const features = [
  { icon: 'currency_exchange', text: 'Мультивалютная поддержка' },
  { icon: 'swap_horiz', text: 'Доходы, расходы и переводы' },
  { icon: 'group', text: 'Разделение расходов с друзьями' },
] as const;

const iconBgClasses: Record<string, string> = {
  success: 'bg-success/10',
  primary: 'bg-primary/10',
  warning: 'bg-warning/10',
  'debt-received': 'bg-debt-received/10',
};

const iconTextClasses: Record<string, string> = {
  success: 'text-success',
  primary: 'text-primary',
  warning: 'text-warning',
  'debt-received': 'text-debt-received',
};
</script>

<template>
  <div
    class="w-full h-full flex-shrink-0 flex flex-col px-6 relative z-10"
    style="contain: layout style paint"
  >
    <!-- Title left-aligned -->
    <div class="mt-2 mb-8 relative z-10">
      <h1 class="text-3xl font-bold text-text-primary-dark tracking-tight leading-tight">
        Все финансы
        <br />
        <span class="text-primary">в одном месте</span>
      </h1>
    </div>

    <!-- 2x2 account grid -->
    <div class="w-full mb-8 relative z-10">
      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="acc in accountTypes"
          :key="acc.label"
          class="bg-card-dark border border-white/5 rounded-xl p-4 flex flex-col justify-between aspect-[1.1/1]"
        >
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center"
            :class="iconBgClasses[acc.color]"
          >
            <UIcon :name="acc.icon" size="sm" :class="iconTextClasses[acc.color]" />
          </div>
          <div>
            <p
              class="text-text-tertiary-dark text-caption font-semibold uppercase tracking-wider mb-1"
            >
              {{ acc.label }}
            </p>
            <p class="text-xl font-bold text-text-primary-dark">
              {{ acc.amount }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Feature list -->
    <div class="flex flex-col gap-5 mt-auto mb-6 relative z-10">
      <div v-for="feat in features" :key="feat.text" class="flex items-center gap-4">
        <div
          class="flex-shrink-0 w-10 h-10 rounded-full bg-card-dark border border-white/5 flex items-center justify-center"
        >
          <UIcon :name="feat.icon" size="sm" class="text-primary" />
        </div>
        <span class="text-sm font-medium text-text-secondary-dark">{{ feat.text }}</span>
      </div>
    </div>
  </div>
</template>
