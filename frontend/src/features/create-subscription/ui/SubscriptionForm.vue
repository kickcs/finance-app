<script setup lang="ts">
import { computed, ref } from 'vue';
import { UInput, UButton, UTabs, UToggle } from '@/shared/ui';
import { CategoryChips, EXPENSE_CATEGORIES } from '@/entities/category';
import { AccountSelector, useAccounts } from '@/entities/account';
import { CURRENCIES } from '@/entities/currency';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import {
  FREQUENCY_LABELS,
  type RecurringSubscriptionInsert,
} from '@/entities/recurring-subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import ServicePresetPicker from './ServicePresetPicker.vue';
import type { ServicePreset } from '@/entities/recurring-subscription';

const props = withDefaults(
  defineProps<{
    formData: RecurringSubscriptionInsert;
    isSubmitting?: boolean;
    submitLabel?: string;
    showPresetPicker?: boolean;
  }>(),
  {
    submitLabel: 'Создать',
    showPresetPicker: true,
  },
);

const emit = defineEmits<{
  'update:formData': [data: RecurringSubscriptionInsert];
  submit: [];
}>();

const { userId } = useCurrentUser();
const { accounts } = useAccounts(userId);

const selectedPresetKey = ref<string | null>(null);

const currencySymbol = computed(() => getCurrencySymbol(props.formData.currency));

const frequencyTabs = Object.entries(FREQUENCY_LABELS).map(([id, label]) => ({ id, label }));

function update<K extends keyof RecurringSubscriptionInsert>(
  field: K,
  value: RecurringSubscriptionInsert[K],
) {
  emit('update:formData', { ...props.formData, [field]: value });
}

function handlePresetSelect(preset: ServicePreset | null, key: string | null) {
  selectedPresetKey.value = key;
  if (preset) {
    emit('update:formData', {
      ...props.formData,
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
    });
  } else {
    emit('update:formData', {
      ...props.formData,
      name: '',
      icon: 'subscriptions',
      color: '#6366f1',
    });
  }
}

function handleAccountSelect(accountId: string) {
  update('account_id', accountId);
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="emit('submit')">
    <!-- Service preset picker -->
    <ServicePresetPicker
      v-if="showPresetPicker"
      :selected="selectedPresetKey"
      @select="handlePresetSelect"
    />

    <!-- Name -->
    <UInput
      :model-value="formData.name"
      label="Название"
      placeholder="Название подписки"
      @update:model-value="update('name', $event as string)"
    />

    <!-- Amount + Currency -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Сумма
      </label>
      <div class="flex gap-2">
        <div class="relative shrink-0">
          <select
            :value="formData.currency"
            class="appearance-none h-full bg-surface-light dark:bg-surface-dark rounded-xl px-3 pr-8 text-sm font-medium border border-border-light dark:border-border-dark focus:outline-none focus:ring-2 focus:ring-primary text-text-primary-light dark:text-text-primary-dark"
            @change="update('currency', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="c in CURRENCIES" :key="c.code" :value="c.code">
              {{ c.flag }} {{ c.code }}
            </option>
          </select>
        </div>
        <div class="flex-1">
          <UInput
            :model-value="String(formData.amount || '')"
            placeholder="0"
            variant="currency"
            type="number"
            :suffix="currencySymbol"
            @update:model-value="update('amount', Number($event) || 0)"
          />
        </div>
      </div>
    </div>

    <!-- Account -->
    <div v-if="accounts.length > 0" class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Счёт для списания
      </label>
      <AccountSelector
        :accounts="accounts"
        :selected-id="formData.account_id ?? null"
        label="Счёт"
        @select="handleAccountSelect"
      />
    </div>

    <!-- Frequency -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Частота
      </label>
      <UTabs
        :model-value="formData.frequency"
        :items="frequencyTabs"
        size="sm"
        @update:model-value="
          update('frequency', $event as RecurringSubscriptionInsert['frequency'])
        "
      />
      <!-- Custom frequency days -->
      <UInput
        v-if="formData.frequency === 'custom'"
        :model-value="String(formData.frequency_days || '')"
        label="Количество дней"
        placeholder="30"
        type="number"
        @update:model-value="update('frequency_days', Number($event) || undefined)"
      />
    </div>

    <!-- Billing date -->
    <UInput
      :model-value="formData.billing_date"
      label="Дата списания"
      type="date"
      @update:model-value="update('billing_date', $event as string)"
    />

    <!-- Category -->
    <div class="space-y-2">
      <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
        Категория
      </label>
      <CategoryChips
        :categories="EXPENSE_CATEGORIES"
        :selected-id="formData.category_id || 'entertainment'"
        :rows="1"
        @select="update('category_id', $event)"
      />
    </div>

    <!-- Notify days before -->
    <UInput
      :model-value="String(formData.notify_days_before ?? 2)"
      label="Напомнить за (дней)"
      type="number"
      placeholder="2"
      @update:model-value="
        update('notify_days_before', Math.min(30, Math.max(1, Number($event) || 1)))
      "
    />

    <!-- Auto-charge toggle -->
    <div
      class="flex items-center justify-between p-3 rounded-xl bg-surface-light dark:bg-surface-dark"
    >
      <div>
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          Автоматическое списание
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
          Списывать автоматически в день оплаты
        </p>
      </div>
      <UToggle
        :model-value="formData.auto_charge ?? false"
        @update:model-value="update('auto_charge', $event)"
      />
    </div>

    <!-- Description -->
    <UInput
      :model-value="formData.description || ''"
      label="Описание (необязательно)"
      placeholder="Добавьте описание..."
      @update:model-value="update('description', $event as string)"
    />

    <!-- Submit button -->
    <UButton type="submit" variant="primary" size="xl" full-width :loading="isSubmitting">
      {{ submitLabel }}
    </UButton>
  </form>
</template>
