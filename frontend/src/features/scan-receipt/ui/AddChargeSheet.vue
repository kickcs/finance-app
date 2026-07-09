<script setup lang="ts">
import { ref, computed, watch, useTemplateRef } from 'vue';
import { UButton, UModal } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { useHaptics } from '@/shared/lib/haptics';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
import { CHARGE_PRESETS, AMOUNT_CHARGE_PRESETS } from '../model/constants';
import type { NewChargeInput } from '../model/useItemsStep';
import type { ReceiptCharge } from '../model/types';

const props = defineProps<{
  open: boolean;
  charges: ReceiptCharge[];
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  add: [charge: NewChargeInput];
}>();

const { trigger } = useHaptics();

const label = ref('');
const mode = ref<'percent' | 'amount'>('percent');
const value = ref<number | null>(null);

const valueInputRef = useTemplateRef<HTMLInputElement>('valueInput');
const currencySymbol = computed(() => getCurrencySymbol(props.currency));

// Пресеты, которых ещё нет в списке (по названию)
const percentPresets = computed(() => {
  const existing = new Set(props.charges.map((c) => c.label));
  return CHARGE_PRESETS.filter((p) => !existing.has(p.label));
});

const amountPresets = computed(() => {
  const existing = new Set(props.charges.map((c) => c.label));
  return AMOUNT_CHARGE_PRESETS.filter((p) => !existing.has(p));
});

const isValid = computed(
  () => label.value.trim().length > 0 && value.value !== null && value.value > 0,
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      label.value = '';
      mode.value = 'percent';
      value.value = null;
    }
  },
);

function addPercentPreset(preset: (typeof CHARGE_PRESETS)[number]) {
  trigger('selection');
  emit('add', { label: preset.label, type: 'percent', percent: preset.defaultPercent });
  emit('update:open', false);
}

// Пресеты «Чаевые»/«Доставка» — суммы: подставляем имя и переводим форму в режим суммы
function pickAmountPreset(presetLabel: string) {
  trigger('selection');
  label.value = presetLabel;
  mode.value = 'amount';
  valueInputRef.value?.focus();
}

function setMode(newMode: 'percent' | 'amount') {
  if (mode.value === newMode) return;
  mode.value = newMode;
  trigger('selection');
}

function handleAdd() {
  if (!isValid.value) return;
  trigger('selection');
  const name = label.value.trim();
  emit(
    'add',
    mode.value === 'percent'
      ? { label: name, type: 'percent', percent: value.value! }
      : { label: name, type: 'amount', amount: value.value! },
  );
  emit('update:open', false);
}
</script>

<template>
  <UModal
    :model-value="open"
    title="Добавить сбор"
    @update:model-value="emit('update:open', $event)"
  >
    <div class="space-y-4">
      <!-- Пресеты -->
      <div v-if="percentPresets.length > 0 || amountPresets.length > 0">
        <p
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2"
        >
          Частые
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="preset in percentPresets"
            :key="preset.label"
            type="button"
            class="px-3 py-2 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark active:scale-95 transition-all"
            @click="addPercentPreset(preset)"
          >
            {{ preset.label }}
            <span class="text-primary tabular-nums">{{ preset.defaultPercent }}%</span>
          </button>
          <button
            v-for="presetLabel in amountPresets"
            :key="presetLabel"
            type="button"
            class="px-3 py-2 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark active:scale-95 transition-all"
            @click="pickAmountPreset(presetLabel)"
          >
            {{ presetLabel }}
            <span class="text-text-tertiary-light dark:text-text-tertiary-dark">…</span>
          </button>
        </div>
      </div>

      <!-- Свой сбор -->
      <div class="space-y-3">
        <p
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide"
        >
          Свой сбор
        </p>

        <input
          v-model="label"
          type="text"
          placeholder="Название — например, Обслуживание"
          aria-label="Название сбора"
          class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
        />

        <div class="flex items-center gap-2">
          <!-- Сегмент-контрол: % | сумма -->
          <div
            class="flex p-0.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shrink-0"
            role="group"
            aria-label="Тип сбора"
          >
            <button
              type="button"
              :aria-pressed="mode === 'percent'"
              :class="
                cn(
                  'px-3 py-2 rounded-[10px] text-body-sm font-semibold transition-all',
                  mode === 'percent'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary-light dark:text-text-secondary-dark',
                )
              "
              @click="setMode('percent')"
            >
              %
            </button>
            <button
              type="button"
              :aria-pressed="mode === 'amount'"
              :class="
                cn(
                  'px-3 py-2 rounded-[10px] text-body-sm font-semibold transition-all',
                  mode === 'amount'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-secondary-light dark:text-text-secondary-dark',
                )
              "
              @click="setMode('amount')"
            >
              {{ currencySymbol }}
            </button>
          </div>

          <input
            ref="valueInput"
            v-model.number="value"
            type="number"
            inputmode="decimal"
            min="0"
            :step="mode === 'percent' ? 0.1 : 1"
            :placeholder="mode === 'percent' ? '10' : '5 000'"
            :aria-label="mode === 'percent' ? 'Процент сбора' : 'Сумма сбора'"
            class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
            @keydown.enter.prevent="handleAdd"
          />
        </div>
      </div>
    </div>

    <template #actions>
      <UButton variant="primary" size="lg" full-width :disabled="!isValid" @click="handleAdd">
        Добавить сбор
      </UButton>
    </template>
  </UModal>
</template>
