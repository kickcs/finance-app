<script setup lang="ts">
import { computed, ref } from 'vue';
import { UCard, UButton, UBadge, UIcon } from '@/shared/ui';
import { useSubscription, PLAN_LABELS } from '@/entities/subscription';
import { PremiumUpgradeModal } from '@/features/upgrade-to-premium';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { formatDate } from '@/shared/lib/format/date';

const { userId } = useCurrentUser();
const { subscription, isPremium } = useSubscription(userId);

const showUpgrade = ref(false);

const statusBadgeVariant = computed(() => isPremium.value ? 'success' : 'neutral');

const statusLabel = computed(() => {
  if (subscription.value.status === 'trialing') return 'Пробный период';
  if (subscription.value.cancel_at_period_end) return 'Отменена';
  return isPremium.value ? 'Активна' : 'Бесплатный';
});
</script>

<template>
  <div>
    <h2 class="text-sm font-semibold text-text-secondary-light dark:text-text-secondary-dark px-2 mb-2 uppercase tracking-wider">
      Подписка
    </h2>
    <UCard class="p-4 space-y-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <UIcon name="workspace_premium" size="sm" class="text-primary" />
          <span class="font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ PLAN_LABELS[subscription.plan] || 'Бесплатный' }}
          </span>
        </div>
        <UBadge :variant="statusBadgeVariant" size="sm" shape="pill">{{ statusLabel }}</UBadge>
      </div>

      <p v-if="isPremium && subscription.current_period_end"
         class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
        {{ subscription.cancel_at_period_end ? 'Действует до' : 'Следующая оплата' }}:
        {{ formatDate(subscription.current_period_end) }}
      </p>

      <UButton v-if="!isPremium" variant="primary" full-width @click="showUpgrade = true">
        Перейти на Premium
      </UButton>
    </UCard>

    <PremiumUpgradeModal v-model="showUpgrade" />
  </div>
</template>
