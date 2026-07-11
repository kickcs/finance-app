<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, BrandIcon, hasBrandIcon } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { useHaptics } from '@/shared/lib/haptics';
import { pluralize } from '@/shared/lib/format/pluralize';
import type { RecurringSubscription } from '../model/types';
import { daysUntilBilling, formatFrequencyShort } from '../model/utils';

const props = withDefaults(
  defineProps<{
    subscription: RecurringSubscription;
    compact?: boolean;
    hidden?: boolean;
  }>(),
  { compact: false, hidden: false },
);

const emit = defineEmits<{
  click: [];
}>();

const { trigger } = useHaptics();

function handleClick() {
  trigger('selection');
  emit('click');
}

const isPaused = computed(() => props.subscription.status === 'paused');

const billingDateFormatted = computed(() =>
  formatDate(props.subscription.billing_date, { format: 'short' }),
);

const daysLeft = computed(() => daysUntilBilling(props.subscription.billing_date));

const countdownLabel = computed(() => {
  const days = daysLeft.value;
  if (days === 0) return 'сегодня';
  if (days === 1) return 'завтра';
  if (days < 0) return '';
  return `через ${days} ${pluralize(days, 'день', 'дня', 'дней')}`;
});

const frequencyLabel = computed(() =>
  formatFrequencyShort(props.subscription.frequency, props.subscription.frequency_days),
);
</script>

<template>
  <button
    class="w-full text-left rounded-xl transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
    :class="[compact ? 'p-2.5' : 'p-3', isPaused && 'opacity-60']"
    :aria-label="`${subscription.name}, ${formatMasked(subscription.amount, subscription.currency, hidden)}`"
    @click="handleClick"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon -->
      <div
        class="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
        :style="{ backgroundColor: subscription.color + '20' }"
      >
        <BrandIcon
          v-if="hasBrandIcon(subscription.icon)"
          :name="subscription.icon"
          size="md"
          :style="{ color: subscription.color }"
        />
        <UIcon v-else :name="subscription.icon" size="md" :style="{ color: subscription.color }" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate flex items-center gap-1"
            >
              {{ subscription.name }}
              <span v-if="isPaused" class="text-caption-sm text-warning font-normal">(пауза)</span>
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              {{ billingDateFormatted }}
              <span
                v-if="countdownLabel && !isPaused"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                &middot; {{ countdownLabel }}
              </span>
            </p>
          </div>

          <!-- Amount -->
          <div class="text-right shrink-0">
            <p
              class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark flex items-center justify-end gap-0.5"
            >
              <span
                v-if="subscription.auto_charge"
                class="text-warning text-caption"
                title="Автосписание"
              >
                &#9889;
              </span>
              {{ formatMasked(subscription.amount, subscription.currency, hidden) }}
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
              {{ frequencyLabel }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </button>
</template>
