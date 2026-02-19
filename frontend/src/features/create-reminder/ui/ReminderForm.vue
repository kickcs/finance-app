<script setup lang="ts">
import { computed } from 'vue';
import { UInput, UButton, UTabs, UColorPicker, UIconSelector } from '@/shared/ui';
import { FREQUENCY_LABELS, REMINDER_ICONS } from '@/entities/reminder';
import { ACCOUNT_COLORS } from '@/entities/account';
import { getTodayISO, isPastDate } from '@/shared/lib/date';
import type { ReminderFormData } from '../model/useCreateReminder';

const props = defineProps<{
  formData: ReminderFormData;
  isSubmitting?: boolean;
  error?: string | null;
  currency: string;
}>();

const emit = defineEmits<{
  'update:formData': [value: ReminderFormData];
  submit: [];
}>();

const frequencyTabs = Object.entries(FREQUENCY_LABELS).map(([id, label]) => ({
  id,
  label,
}));

function updateField<K extends keyof ReminderFormData>(
  field: K,
  value: ReminderFormData[K],
) {
  emit('update:formData', { ...props.formData, [field]: value });
}

const today = computed(() => getTodayISO());

const dateError = computed(() => {
  if (props.formData.next_date && isPastDate(props.formData.next_date)) {
    return 'Дата не может быть в прошлом';
  }
  return null;
});

const _isFormValid =
  props.formData.name.trim().length > 0 && props.formData.amount > 0;
</script>

<template>
  <form
    class="space-y-6 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Reminder Name -->
    <UInput
      :model-value="formData.name"
      label="Название подписки"
      placeholder="Netflix, Spotify, Яндекс Плюс..."
      @update:model-value="updateField('name', $event as string)"
    />

    <!-- Amount -->
    <UInput
      :model-value="String(formData.amount)"
      label="Сумма"
      placeholder="0"
      variant="currency"
      type="number"
      :suffix="currency"
      @update:model-value="updateField('amount', Number($event) || 0)"
    />

    <!-- Frequency -->
    <div class="space-y-3">
      <label
        class="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
      >
        Частота оплаты
      </label>
      <UTabs
        :items="frequencyTabs"
        :model-value="formData.frequency"
        @update:model-value="
          updateField('frequency', $event as ReminderFormData['frequency'])
        "
      />
    </div>

    <!-- Next Date -->
    <UInput
      :model-value="formData.next_date"
      label="Дата следующего платежа"
      type="date"
      :min="today"
      :error="dateError ?? undefined"
      @update:model-value="updateField('next_date', $event as string)"
    />

    <!-- Icon Selector -->
    <UIconSelector
      :model-value="formData.icon"
      :icons="REMINDER_ICONS"
      :color="formData.color"
      label="Иконка"
      @update:model-value="updateField('icon', $event)"
    />

    <!-- Color Picker -->
    <UColorPicker
      :model-value="formData.color"
      :colors="ACCOUNT_COLORS"
      label="Цвет"
      @update:model-value="updateField('color', $event)"
    />

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Submit Button -->
    <UButton
      type="submit"
      variant="primary"
      size="xl"
      full-width
      :loading="isSubmitting"
      :disabled="!formData.name.trim() || formData.amount <= 0"
    >
      Создать подписку
    </UButton>
  </form>
</template>
