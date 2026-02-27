<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { PREMIUM_FEATURES, PLAN_PRICES } from '@/entities/subscription';
import { useUpgrade } from '../model/useUpgrade';

defineProps<{
  modelValue: boolean;
  featureName?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

const { isLoading, startCheckout } = useUpgrade();

async function handlePurchase(plan: 'premium_monthly' | 'premium_yearly') {
  const success = await startCheckout(plan);
  if (success) {
    emit('update:modelValue', false);
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Ouro Premium"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-5">
      <p v-if="featureName" class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Функция «{{ featureName }}» доступна с Premium-подпиской.
      </p>

      <div class="space-y-3">
        <div
          v-for="feature in PREMIUM_FEATURES"
          :key="feature.label"
          class="flex items-start gap-3"
        >
          <UIcon :name="feature.icon" size="sm" class="text-primary mt-0.5" />
          <div>
            <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
              {{ feature.label }}
            </p>
            <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
              {{ feature.description }}
            </p>
          </div>
        </div>
      </div>

      <p class="text-xs text-center text-text-tertiary-light dark:text-text-tertiary-dark">
        7 дней бесплатно, затем от {{ PLAN_PRICES.premium_monthly }}
      </p>
    </div>

    <template #actions>
      <UButton
        variant="primary"
        full-width
        :loading="isLoading"
        @click="handlePurchase('premium_yearly')"
      >
        {{ PLAN_PRICES.premium_yearly }} — выгоднее
      </UButton>
      <UButton
        variant="secondary"
        full-width
        :loading="isLoading"
        @click="handlePurchase('premium_monthly')"
      >
        {{ PLAN_PRICES.premium_monthly }}
      </UButton>
    </template>
  </UModal>
</template>
