<script setup lang="ts">
import { computed } from 'vue';
import { formatCurrency } from '@/shared/lib/format/currency';
import { calcChargeAmount } from '../model/calcLineTotal';
import type { ReceiptCharge } from '../model/types';

const props = defineProps<{
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
  currency: string;
}>();

const enabledCharges = computed(() => props.charges.filter((c) => c.enabled));
const hasCharges = computed(() => enabledCharges.value.length > 0 && props.chargesAmount > 0);
</script>

<template>
  <div
    class="relative bg-surface-light dark:bg-surface-dark px-5 pt-5 pb-6 mb-2 mt-1 drop-shadow-sm"
  >
    <!-- Zigzag bottom border -->
    <div
      class="receipt-edge absolute inset-x-0 -bottom-2 h-3 bg-surface-light dark:bg-surface-dark z-10"
    />

    <!-- Subtle texture/lines -->
    <div class="absolute inset-x-6 top-10 space-y-3 opacity-[0.03] pointer-events-none">
      <div class="h-1 bg-current rounded-full w-3/4 mx-auto" />
      <div class="h-1 bg-current rounded-full w-5/6 mx-auto" />
    </div>

    <div class="relative z-10">
      <template v-if="hasCharges">
        <div class="flex justify-between items-baseline mb-1.5">
          <span
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wider font-medium"
          >
            Подытог
          </span>
          <span
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
          >
            {{ formatCurrency(subtotal, currency) }}
          </span>
        </div>
        <div
          v-for="charge in enabledCharges"
          :key="charge.id"
          class="flex justify-between items-baseline mb-1.5"
        >
          <span class="text-xs text-primary uppercase tracking-wider font-medium">
            {{ charge.label }}
            <template v-if="charge.type === 'percent'">({{ charge.percent }}%)</template>
          </span>
          <span class="text-sm text-primary tabular-nums">
            +{{ formatCurrency(calcChargeAmount(subtotal, charge), currency) }}
          </span>
        </div>
        <div
          class="h-[1.5px] border-b-2 border-dashed border-border-light dark:border-border-dark mb-3"
        />
      </template>

      <div class="flex flex-col items-center justify-center mt-2">
        <span
          class="text-caption-sm uppercase tracking-widest text-text-tertiary-light dark:text-text-tertiary-dark font-bold mb-1"
        >
          Итого к оплате
        </span>
        <span
          class="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums tracking-tight"
        >
          {{ formatCurrency(totalAmount, currency) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style>
@import './transitions.css';
</style>
