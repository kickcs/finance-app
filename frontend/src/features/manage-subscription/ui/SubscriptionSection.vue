<script setup lang="ts">
import { computed } from 'vue';
import { UCard, UIcon, IconBadge } from '@/shared/ui';
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
  <div>
    <h2
      class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider"
    >
      Подписка
    </h2>
    <UCard class="divide-y divide-border-light dark:divide-border-dark overflow-hidden">
      <button
        class="w-full flex items-center gap-4 p-4 transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:bg-surface-light dark:active:bg-surface-dark text-left"
        @click="emit('upgrade')"
      >
        <IconBadge icon="workspace_premium" size="sm" color="#f59e0b" />
        <div class="flex-1 min-w-0">
          <p class="font-medium text-text-primary-light dark:text-text-primary-dark truncate">
            {{ isPremium ? PLAN_LABELS[subscription.plan] || 'Premium' : 'Premium подписка' }}
          </p>
          <p
            v-if="isPremium && subscription.current_period_end"
            class="text-xs text-text-secondary-light dark:text-text-secondary-dark truncate"
          >
            {{ subscription.cancel_at_period_end ? 'Действует до' : 'Следующая оплата' }}:
            {{ formatDate(subscription.current_period_end) }}
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="text-sm font-medium"
            :class="
              isPremium ? 'text-success' : 'text-text-secondary-light dark:text-text-secondary-dark'
            "
          >
            {{ statusLabel }}
          </span>
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </div>
      </button>
    </UCard>
  </div>
</template>
