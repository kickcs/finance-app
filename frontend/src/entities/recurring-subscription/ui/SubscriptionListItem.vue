<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, BrandIcon, hasBrandIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import type { RecurringSubscription } from '../model/types';
import { daysUntilBilling, formatFrequencyShort } from '../model/utils';

const props = defineProps<{
  subscription: RecurringSubscription;
  accountName?: string;
}>();

const emit = defineEmits<{
  click: [];
}>();

const { trigger } = useHaptics();

function handleClick() {
  trigger('selection');
  emit('click');
}

const timeline = computed(() => {
  if (props.subscription.status === 'paused') return { label: 'на паузе', tone: 'muted' };
  const d = daysUntilBilling(props.subscription.billing_date);
  if (d < 0) return { label: 'просрочено', tone: 'danger' };
  if (d === 0) return { label: 'сегодня', tone: 'urgent' };
  if (d === 1) return { label: 'завтра', tone: 'urgent' };
  if (d <= 3) return { label: `через ${d} дн`, tone: 'warn' };
  if (d <= 7) return { label: `через ${d} дн`, tone: 'soon' };
  return { label: `через ${d} дн`, tone: 'calm' };
});

const freqLabel = computed(() =>
  formatFrequencyShort(props.subscription.frequency, props.subscription.frequency_days),
);

const timelinePillClass = computed(() => {
  switch (timeline.value.tone) {
    case 'urgent':
    case 'danger':
      return 'bg-danger/15 text-danger';
    case 'warn':
      return 'bg-warning/15 text-warning';
    case 'soon':
      return 'bg-primary/12 text-primary';
    case 'calm':
      return 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark';
    case 'muted':
    default:
      return 'bg-surface-light dark:bg-surface-dark text-text-tertiary-light dark:text-text-tertiary-dark';
  }
});
</script>

<template>
  <button
    class="sub-item relative flex items-center gap-3 w-full text-left rounded-2xl pl-4 pr-3.5 py-3 overflow-hidden bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark"
    :class="subscription.status === 'paused' && 'opacity-55'"
    :style="{ '--brand': subscription.color }"
    :aria-label="`${subscription.name}, ${formatCurrency(subscription.amount, subscription.currency)} ${freqLabel}, ${timeline.label}`"
    @click="handleClick"
  >
    <span class="sub-item__rail" aria-hidden="true" />

    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
      :style="{ backgroundColor: subscription.color + '1F' }"
    >
      <BrandIcon
        v-if="hasBrandIcon(subscription.icon)"
        :name="subscription.icon"
        size="sm"
        :style="{ color: subscription.color }"
      />
      <UIcon v-else :name="subscription.icon" size="sm" :style="{ color: subscription.color }" />
    </div>

    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-3 mb-0.5">
        <span
          class="text-sm font-semibold tracking-[-0.01em] truncate text-text-primary-light dark:text-text-primary-dark"
        >
          {{ subscription.name }}
        </span>
        <span
          class="text-sm font-bold tracking-[-0.01em] tabular-nums shrink-0 text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatCurrency(subscription.amount, subscription.currency) }}
        </span>
      </div>
      <div
        class="flex items-center gap-1.5 text-[11.5px] min-w-0 text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-[0.02em] lowercase"
          :class="timelinePillClass"
        >
          {{ timeline.label }}
        </span>
        <span v-if="accountName" class="select-none" aria-hidden="true">·</span>
        <span v-if="accountName" class="truncate min-w-0">{{ accountName }}</span>
        <span
          class="ml-auto font-semibold tabular-nums shrink-0 text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ freqLabel }}
        </span>
      </div>
    </div>

    <UIcon
      name="chevron_right"
      size="sm"
      class="sub-item__chev shrink-0 opacity-60 text-text-tertiary-light dark:text-text-tertiary-dark"
    />
  </button>
</template>

<style scoped>
.sub-item {
  transition:
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1),
    border-color 200ms ease,
    box-shadow 220ms ease;
}
.sub-item:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--brand) 50%, currentColor);
  box-shadow: 0 6px 14px -8px color-mix(in srgb, var(--brand) 50%, transparent);
}

/* Brand rail — uses --brand var */
.sub-item__rail {
  position: absolute;
  left: 0;
  top: 12px;
  bottom: 12px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--brand);
  opacity: 0.85;
}

.sub-item__chev {
  transition: transform 200ms ease;
}
.sub-item:hover .sub-item__chev {
  transform: translateX(2px);
  opacity: 1;
}
</style>
