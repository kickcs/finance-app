<script setup lang="ts">
import { computed } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import type { MutualPosition } from '@/entities/debt';

const props = defineProps<{
  modelValue: boolean;
  personName: string;
  position: MutualPosition | null;
  masked?: boolean;
  isOffsetting?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
}>();

const money = (amount: number) =>
  formatMasked(amount, props.position?.currency ?? '', props.masked);

/**
 * Что именно закроется. Меньшая сторона уходит в ноль целиком, большая —
 * уменьшается: обещать иное для сумм, которые редко совпадают, нечестно.
 */
const outcome = computed(() => {
  if (!props.position) return null;
  const { given, taken, offsetAmount } = props.position;
  const smallerIsGiven = given <= taken;
  return {
    closingLabel: smallerIsGiven ? 'Долг перед вами' : 'Ваш долг',
    shrinkingLabel: smallerIsGiven ? 'ваш долг' : 'долг перед вами',
    offsetAmount,
    restLabel: smallerIsGiven ? 'вы будете должны' : 'вам будут должны',
    restAmount: Math.abs(given - taken),
  };
});
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    :title="`Зачесть долги с ${personName}?`"
    desktop="dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="position && outcome" data-testid="offset-debts-modal" class="space-y-3">
      <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        {{ outcome.closingLabel }} на {{ money(outcome.offsetAmount) }} закроется полностью,
        {{ outcome.shrinkingLabel }} уменьшится на столько же.
      </p>
      <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
        <template v-if="outcome.restAmount > 0">
          После зачёта {{ outcome.restLabel }}
          <span class="font-semibold text-text-primary-light dark:text-text-primary-dark">
            {{ money(outcome.restAmount) }}
          </span>
          .
        </template>
        <template v-else>Долги сходятся ровно — после зачёта вы в расчёте.</template>
      </p>
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
        Деньги никуда не переводятся — балансы счетов останутся прежними.
      </p>
    </div>

    <template #footer>
      <div class="flex gap-3">
        <UButton
          variant="secondary"
          full-width
          :disabled="isOffsetting"
          @click="emit('update:modelValue', false)"
        >
          Отмена
        </UButton>
        <UButton
          full-width
          data-testid="confirm-offset-btn"
          :loading="isOffsetting"
          @click="emit('confirm')"
        >
          Зачесть
        </UButton>
      </div>
    </template>
  </UOverlay>
</template>
