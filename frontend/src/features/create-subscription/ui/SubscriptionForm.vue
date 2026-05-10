<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue';
import { UButton, UTabs, UToggle, UIcon, UInput } from '@/shared/ui';
import { CategoryChips, EXPENSE_CATEGORIES } from '@/entities/category';
import { AccountSelector, useAccounts } from '@/entities/account';
import { CURRENCIES, getCurrencyByCode } from '@/entities/currency';
import {
  formatNumberWithSpaces,
  sanitizeCurrencyInput,
  getCurrencySymbol,
} from '@/shared/lib/format/currency';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import {
  FREQUENCY_LABELS,
  type RecurringSubscriptionInsert,
} from '@/entities/recurring-subscription';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import DatePickerField from '@/features/add-transaction/ui/DatePickerField.vue';
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
const currencyOpen = ref(false);
const isAmountFocused = ref(false);
const amountInputRef = ref<HTMLInputElement | null>(null);
const amountBounce = ref(false);
const rawAmount = ref(props.formData.amount ? String(props.formData.amount) : '');

const currencySymbol = computed(() => getCurrencySymbol(props.formData.currency));

const displayAmount = computed(() => {
  if (!rawAmount.value) return '0';
  const dotIndex = rawAmount.value.indexOf('.');
  if (dotIndex === -1) return formatNumberWithSpaces(rawAmount.value) || '0';
  return (
    (formatNumberWithSpaces(rawAmount.value.slice(0, dotIndex) || '0') || '0') +
    rawAmount.value.slice(dotIndex)
  );
});

const heroColor = computed(() => props.formData.color || '#4f46e5');

const NOTIFY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'В день' },
  { value: 1, label: '1 день' },
  { value: 2, label: '2 дня' },
  { value: 3, label: '3 дня' },
  { value: 7, label: '7 дней' },
  { value: 14, label: '14 дней' },
];

const notifyDaysBefore = computed<number[]>(() => props.formData.notify_days_before ?? []);

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

const notifyHint = computed(() => {
  const values = notifyDaysBefore.value;
  if (values.length === 0) return 'Уведомления отключены';
  const parts = [...values]
    .sort((a, b) => a - b)
    .map((v) => {
      if (v === 0) return 'в день списания';
      if (v === 1) return 'за 1 день';
      return `за ${v} ${pluralizeDays(v)}`;
    });
  const joined = parts.join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
});

function isNotifySelected(value: number): boolean {
  return notifyDaysBefore.value.includes(value);
}

function toggleNotifyDay(value: number) {
  const current = notifyDaysBefore.value;
  const next = current.includes(value)
    ? current.filter((v) => v !== value)
    : [...current, value].sort((a, b) => a - b);
  update('notify_days_before', next);
}

const isComplete = computed(() =>
  Boolean(props.formData.name?.trim() && props.formData.amount > 0 && props.formData.billing_date),
);

function handleSubmit() {
  if (!isComplete.value || props.isSubmitting) return;
  emit('submit');
}

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
      color: '#4f46e5',
    });
  }
  nextTick(() => amountInputRef.value?.focus());
}

function onAmountInput(event: Event) {
  const sanitized = sanitizeCurrencyInput((event.target as HTMLInputElement).value);
  rawAmount.value = sanitized;
  const num = parseFloat(sanitized) || 0;
  if (!props.formData.amount && num > 0) {
    amountBounce.value = true;
    setTimeout(() => (amountBounce.value = false), 220);
  }
  update('amount', num);
}

function selectCurrency(cur: string) {
  update('currency', cur);
  currencyOpen.value = false;
}

onMounted(() => {
  if (!props.formData.name) {
    nextTick(() => amountInputRef.value?.focus());
  }
});
</script>

<template>
  <form
    class="flex flex-col gap-[22px]"
    :style="{ '--hero': heroColor }"
    @submit.prevent="handleSubmit"
  >
    <!-- HERO: amount, minimal -->
    <section class="relative px-1 pt-2 pb-3" aria-label="Сумма подписки">
      <div class="flex flex-col items-center gap-2">
        <p
          class="inline-flex items-center gap-2 text-[12px] font-semibold tracking-[-0.01em] text-text-secondary-light dark:text-text-secondary-dark max-w-full truncate"
        >
          <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: heroColor }" />
          {{ formData.name || 'Новая подписка' }}
        </p>

        <div
          class="hero__amount-row relative inline-flex items-baseline gap-1.5 cursor-text py-1"
          @click="amountInputRef?.focus()"
        >
          <input
            ref="amountInputRef"
            type="text"
            inputmode="decimal"
            :value="rawAmount"
            class="absolute inset-0 w-full h-full opacity-0 cursor-text"
            style="caret-color: transparent"
            aria-label="Сумма"
            @input="onAmountInput"
            @focus="isAmountFocused = true"
            @blur="isAmountFocused = false"
            @keydown.enter.prevent
          />
          <span
            class="hero__amount tabular-nums"
            :class="[
              formData.amount
                ? 'text-text-primary-light dark:text-text-primary-dark'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark',
              amountBounce && 'hero__amount--bounce',
            ]"
          >
            {{ displayAmount }}
          </span>
          <span
            class="hero__caret"
            :class="isAmountFocused && 'hero__caret--blink'"
            aria-hidden="true"
          />
          <span
            class="text-[22px] font-semibold ml-0.5 text-text-secondary-light dark:text-text-secondary-dark"
          >
            {{ currencySymbol }}
          </span>
        </div>

        <div
          class="inline-flex items-center gap-2 text-[12px] text-text-secondary-light dark:text-text-secondary-dark mt-0.5"
        >
          <Popover v-model:open="currencyOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="hero__chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark"
              >
                {{ getCurrencyByCode(formData.currency)?.flag }}
                {{ formData.currency }}
                <UIcon name="expand_more" size="xs" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" :side-offset="8" class="w-auto min-w-[160px] p-1">
              <button
                v-for="cur in CURRENCIES"
                :key="cur.code"
                type="button"
                :class="[
                  'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors',
                  cur.code === formData.currency
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark',
                ]"
                @click="selectCurrency(cur.code)"
              >
                <span>{{ cur.flag }}</span>
                <span>{{ cur.code }}</span>
                <span class="text-text-tertiary-light dark:text-text-tertiary-dark text-xs">
                  {{ cur.name }}
                </span>
              </button>
            </PopoverContent>
          </Popover>

          <span
            class="text-text-tertiary-light dark:text-text-tertiary-dark select-none"
            aria-hidden="true"
          >
            ·
          </span>
          <span class="font-medium">
            {{ FREQUENCY_LABELS[formData.frequency] || 'Ежемесячно' }}
          </span>
        </div>
      </div>
    </section>

    <!-- Service preset picker -->
    <ServicePresetPicker
      v-if="showPresetPicker"
      :selected="selectedPresetKey"
      @select="handlePresetSelect"
    />

    <!-- Name -->
    <div class="flex flex-col gap-2">
      <label class="field-label">Название</label>
      <UInput
        :model-value="formData.name"
        placeholder="Например, Netflix"
        @update:model-value="update('name', $event as string)"
      />
    </div>

    <!-- Frequency -->
    <div class="flex flex-col gap-2">
      <label class="field-label">Частота списания</label>
      <UTabs
        :model-value="formData.frequency"
        :items="frequencyTabs"
        size="sm"
        @update:model-value="
          update('frequency', $event as RecurringSubscriptionInsert['frequency'])
        "
      />
      <UInput
        v-if="formData.frequency === 'custom'"
        :model-value="String(formData.frequency_days || '')"
        placeholder="Каждые N дней"
        type="number"
        class="mt-2"
        @update:model-value="update('frequency_days', Number($event) || undefined)"
      />
    </div>

    <!-- Billing date -->
    <div class="flex flex-col gap-2">
      <label class="field-label">Следующее списание</label>
      <DatePickerField
        :model-value="formData.billing_date"
        placeholder="Выбрать дату"
        @update:model-value="update('billing_date', ($event as string) ?? '')"
      />
    </div>

    <!-- Account -->
    <div v-if="accounts.length > 0" class="flex flex-col gap-2">
      <label class="field-label">Со счёта</label>
      <AccountSelector
        :accounts="accounts"
        :selected-id="formData.account_id ?? null"
        label="Счёт"
        @select="update('account_id', $event)"
      />
    </div>

    <!-- Category -->
    <div class="flex flex-col gap-2">
      <label class="field-label">Категория расхода</label>
      <CategoryChips
        :categories="EXPENSE_CATEGORIES"
        :selected-id="formData.category_id || 'entertainment'"
        :rows="3"
        @select="update('category_id', $event)"
      />
    </div>

    <!-- Options card -->
    <div class="flex flex-col gap-2">
      <label class="field-label">Дополнительно</label>
      <div
        class="rounded-[18px] overflow-hidden bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark"
      >
        <div class="flex items-center gap-3 px-3.5 py-3.5">
          <div
            class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark"
          >
            <UIcon name="bolt" size="sm" />
          </div>
          <div class="flex-1 min-w-0">
            <p
              class="text-sm font-semibold tracking-[-0.01em] text-text-primary-light dark:text-text-primary-dark"
            >
              Автосписание
            </p>
            <p class="text-[12px] text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
              Создавать транзакцию автоматически
            </p>
          </div>
          <UToggle
            :model-value="formData.auto_charge ?? false"
            @update:model-value="update('auto_charge', $event)"
          />
        </div>

        <div class="h-px bg-border-light dark:bg-border-dark ml-[62px]" aria-hidden="true" />

        <div class="flex flex-col gap-3 px-3.5 py-3.5">
          <div class="flex items-center gap-3">
            <div
              class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark"
            >
              <UIcon name="notifications" size="sm" />
            </div>
            <div class="flex-1 min-w-0">
              <p
                class="text-sm font-semibold tracking-[-0.01em] text-text-primary-light dark:text-text-primary-dark"
              >
                Уведомить за
              </p>
              <p class="text-[12px] text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5">
                {{ notifyHint }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5 pl-[48px]">
            <button
              v-for="opt in NOTIFY_OPTIONS"
              :key="opt.value"
              type="button"
              :class="[
                'notify-chip px-3 h-8 rounded-full text-[12px] font-semibold tracking-[-0.01em] border transition-colors',
                isNotifySelected(opt.value)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark hover:border-primary/40',
              ]"
              :aria-pressed="isNotifySelected(opt.value)"
              @click="toggleNotifyDay(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div class="flex flex-col gap-2">
      <label class="field-label">
        Заметка
        <span
          class="font-medium tracking-normal normal-case text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          — по желанию
        </span>
      </label>
      <UInput
        :model-value="formData.description || ''"
        placeholder="Например, семейный план"
        @update:model-value="update('description', $event as string)"
      />
    </div>

    <!-- Submit -->
    <div class="mt-1">
      <UButton
        type="submit"
        variant="primary"
        size="xl"
        full-width
        :loading="isSubmitting"
        :disabled="!isComplete"
      >
        {{ submitLabel }}
      </UButton>
    </div>
  </form>
</template>

<style scoped>
.field-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding-left: 4px;
  color: var(--color-text-tertiary-light);
}
:root.dark .field-label,
.dark .field-label {
  color: var(--color-text-tertiary-dark);
}

.hero__amount {
  font-size: clamp(40px, 12vw, 56px);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1;
  transition:
    color 220ms ease,
    transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.hero__amount--bounce {
  transform: scale(1.05);
}

.hero__caret {
  display: inline-block;
  width: 2px;
  height: 38px;
  border-radius: 2px;
  background: var(--hero);
  opacity: 0;
  margin-bottom: 4px;
}
.hero__caret--blink {
  opacity: 1;
  animation: caret-blink 1s step-end infinite;
}

.hero__chip {
  transition:
    background 200ms ease,
    border-color 200ms ease;
}
.hero__chip:hover {
  border-color: var(--hero);
}

.stepper__btn {
  transition:
    background 180ms ease,
    color 180ms ease;
}

@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
