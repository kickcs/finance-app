<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, UCard } from '@/shared/ui';
import { useSubscription, PLAN_LABELS } from '@/entities/subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { formatDate } from '@/shared/lib/format/date';

const emit = defineEmits<{ upgrade: [] }>();

const { userId } = useCurrentUser();
const { subscription, isPremium } = useSubscription(userId);

const statusLabel = computed(() => {
  if (subscription.value.status === 'trialing') return 'Пробный период';
  if (subscription.value.cancel_at_period_end) return 'Отменена';
  return isPremium.value ? 'Активна' : 'Бесплатный';
});
</script>

<template>
  <section>
    <h2
      class="text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2"
    >
      Подписка
    </h2>
    <UCard class="overflow-hidden">
      <button
        data-testid="subscription-button"
        class="w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark text-left"
        @click="emit('upgrade')"
      >
        <UIcon
          name="workspace_premium"
          size="sm"
          class="text-text-secondary-light dark:text-text-secondary-dark shrink-0"
        />
        <div class="flex-1 min-w-0">
          <p
            data-testid="subscription-plan-label"
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ isPremium ? PLAN_LABELS[subscription.plan] || 'Premium' : 'Premium подписка' }}
          </p>
          <p
            v-if="isPremium && subscription.current_period_end"
            data-testid="subscription-period-end"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark truncate"
          >
            {{ subscription.cancel_at_period_end ? 'Действует до' : 'Следующая оплата' }}:
            {{ formatDate(subscription.current_period_end) }}
          </p>
        </div>
        <span
          data-testid="subscription-status-label"
          class="text-sm shrink-0"
          :class="
            isPremium ? 'text-success' : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ statusLabel }}
        </span>
        <UIcon
          name="chevron_right"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </button>
    </UCard>
  </section>
</template>
