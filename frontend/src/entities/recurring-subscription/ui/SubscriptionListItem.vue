<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UBadge } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { useHaptics } from '@/shared/lib/haptics';
import type { RecurringSubscription } from '../model/types';

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

const billingDateFormatted = computed(() => {
  return formatDate(props.subscription.billing_date, { format: 'short' });
});
</script>

<template>
  <button
    :class="[
      'w-full text-left rounded-xl transition-all duration-200 p-2.5',
      'hover:bg-surface-light dark:hover:bg-surface-dark',
      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
      subscription.status === 'paused' && 'opacity-60',
    ]"
    :aria-label="`${subscription.name}, ${formatCurrency(subscription.amount, subscription.currency)}`"
    @click="handleClick"
  >
    <div class="flex items-center gap-2.5">
      <!-- Icon (smaller) -->
      <div
        class="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        :style="{ backgroundColor: subscription.color + '20' }"
      >
        <UIcon :name="subscription.icon" size="sm" :style="{ color: subscription.color }" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
            >
              {{ subscription.name }}
            </p>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate">
              {{ billingDateFormatted }}
              <span v-if="accountName">&middot; {{ accountName }}</span>
            </p>
          </div>

          <!-- Amount + auto badge -->
          <div class="text-right shrink-0 flex items-center gap-1.5">
            <UBadge v-if="subscription.auto_charge" variant="primary" size="xs" shape="pill">
              авто
            </UBadge>
            <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
              {{ formatCurrency(subscription.amount, subscription.currency) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </button>
</template>
