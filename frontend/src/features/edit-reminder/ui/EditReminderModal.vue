<script setup lang="ts">
import { ref, watch } from 'vue';
import { UModal, UInput, UButton, UTabs } from '@/shared/ui';
import { FREQUENCY_LABELS } from '@/entities/reminder';
import type { Reminder } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  reminder: Reminder | null;
  currency: string;
  isUpdating?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [updates: Partial<Reminder>];
  cancel: [];
}>();

// Local form state
const name = ref('');
const amount = ref(0);
const frequency = ref<'weekly' | 'monthly' | 'yearly' | 'once'>('monthly');
const nextDate = ref('');

// Sync form state with reminder prop
watch(
  () => props.reminder,
  (r) => {
    if (r) {
      name.value = r.name;
      amount.value = r.amount;
      frequency.value = r.frequency as 'weekly' | 'monthly' | 'yearly' | 'once';
      nextDate.value = r.next_date ? r.next_date.split('T')[0] : '';
    }
  },
  { immediate: true },
);

const frequencyTabs = Object.entries(FREQUENCY_LABELS).map(([id, label]) => ({
  id,
  label,
}));

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}

function confirm() {
  emit('confirm', {
    name: name.value.trim(),
    amount: amount.value,
    frequency: frequency.value,
    next_date: nextDate.value,
  });
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    title="Редактировать подписку"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="reminder" class="space-y-4">
      <!-- Name -->
      <UInput
        v-model="name"
        data-testid="edit-reminder-name-input"
        label="Название"
        placeholder="Netflix, Spotify..."
      />

      <!-- Amount -->
      <UInput
        data-testid="edit-reminder-amount-input"
        :model-value="String(amount)"
        label="Сумма"
        placeholder="0"
        variant="currency"
        type="number"
        :suffix="currency"
        @update:model-value="amount = Number($event) || 0"
      />

      <!-- Frequency -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Частота
        </label>
        <UTabs
          v-model="frequency"
          data-testid="edit-reminder-frequency-tabs"
          :items="frequencyTabs"
        />
      </div>

      <!-- Next Date -->
      <UInput
        v-model="nextDate"
        data-testid="edit-reminder-next-date-input"
        label="Следующий платёж"
        type="date"
      />
    </div>

    <template #actions>
      <UButton variant="secondary" full-width data-testid="edit-reminder-cancel-btn" @click="close">
        Отмена
      </UButton>
      <UButton
        data-testid="edit-reminder-save-btn"
        variant="primary"
        full-width
        :loading="isUpdating"
        :disabled="!name.trim() || amount <= 0"
        @click="confirm"
      >
        Сохранить
      </UButton>
    </template>
  </UModal>
</template>
