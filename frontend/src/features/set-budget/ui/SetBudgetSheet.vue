<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UInput } from '@/shared/ui';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';

const props = defineProps<{
  modelValue: boolean;
  currentAmount?: number;
  isOverride?: boolean;
  isSaving?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [amount: number];
  reset: [];
}>();

const { currency } = useUserCurrency();

const amount = ref<number | string>('');

// Sync amount when modal opens
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      amount.value = props.currentAmount ?? '';
    }
  },
);

const title = computed(() =>
  props.currentAmount !== undefined ? 'Изменить бюджет' : 'Установить бюджет',
);

const currencySymbol = computed(() => getCurrencySymbol(currency.value));

const isValid = computed(() => {
  const num = Number(amount.value);
  return !isNaN(num) && num > 0;
});

function handleSave() {
  if (!isValid.value) return;
  emit('save', Number(amount.value));
}

function handleReset() {
  emit('reset');
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Сумма бюджета
        </label>
        <UInput
          v-model="amount"
          variant="currency"
          placeholder="0"
          :suffix="currencySymbol"
          size="lg"
        />
      </div>
    </div>

    <template #actions>
      <UButton
        v-if="isOverride"
        variant="secondary"
        full-width
        :disabled="isSaving"
        @click="handleReset"
      >
        Сбросить к дефолту
      </UButton>
      <UButton
        variant="primary"
        full-width
        :loading="isSaving"
        :disabled="!isValid || isSaving"
        @click="handleSave"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
