<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon } from '@/shared/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import ChargeRow from './ChargeRow.vue';
import { CHARGE_PRESETS } from '../model/constants';
import { calcChargeAmount } from '../model/calcLineTotal';
import type { ReceiptCharge } from '../model/types';

const props = defineProps<{
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
  currency: string;
  validationError: string | null;
  disabled: boolean;
}>();

const emit = defineEmits<{
  addCharge: [label: string, percent: number];
  removeCharge: [id: string];
  toggleCharge: [id: string];
  updateChargePercent: [id: string, percent: number];
  updateChargeAmount: [id: string, amount: number];
  requestNext: [];
}>();

const { trigger } = useHaptics();

const addChargeOpen = ref(false);

const enabledCharges = computed(() => props.charges.filter((c) => c.enabled));
const hasCharges = computed(() => enabledCharges.value.length > 0);

/** Presets not yet added (match by label) */
const availablePresets = computed(() => {
  const existingLabels = new Set(props.charges.map((c) => c.label));
  return CHARGE_PRESETS.filter((p) => !existingLabels.has(p.label));
});

function getChargeAmount(charge: ReceiptCharge): number {
  return calcChargeAmount(props.subtotal, charge);
}

function handleAddPreset(preset: (typeof CHARGE_PRESETS)[number]) {
  emit('addCharge', preset.label, preset.defaultPercent);
  addChargeOpen.value = false;
  trigger('selection');
}
</script>

<template>
  <div
    class="absolute bottom-0 inset-x-0 border-t border-border-light/50 dark:border-border-dark/50 px-5 pt-4 pb-[calc(1.25rem+var(--safe-area-inset-bottom))] bg-background-light/85 dark:bg-background-dark/85 backdrop-blur-xl shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.1)] dark:shadow-none"
  >
    <!-- Total breakdown -->
    <div class="mb-3">
      <!-- Subtotal (always shown when charges exist) -->
      <template v-if="charges.length > 0">
        <div class="flex items-baseline justify-between mb-1">
          <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
            Подытог
          </span>
          <span
            class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums"
          >
            {{ formatCurrency(subtotal, currency) }}
          </span>
        </div>

        <!-- Charge rows -->
        <ChargeRow
          v-for="charge in charges"
          :key="charge.id"
          :charge="charge"
          :amount="getChargeAmount(charge)"
          :currency="currency"
          @toggle="emit('toggleCharge', charge.id)"
          @update-percent="emit('updateChargePercent', charge.id, $event)"
          @update-amount="emit('updateChargeAmount', charge.id, $event)"
          @remove="emit('removeCharge', charge.id)"
        />
      </template>

      <!-- Add charge button -->
      <div class="flex items-center mt-1 mb-2">
        <Popover v-model:open="addChargeOpen">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="flex items-center gap-1.5 text-caption font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors"
            >
              <UIcon name="add" size="xs" />
              <span>Добавить начисление</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" :side-offset="8" class="w-52 p-2">
            <div class="space-y-1">
              <button
                v-for="preset in availablePresets"
                :key="preset.label"
                type="button"
                class="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm text-text-primary-light dark:text-text-primary-dark hover:bg-surface-light dark:hover:bg-surface-dark active:scale-[0.98] transition-all"
                @click="handleAddPreset(preset)"
              >
                <span class="font-medium">{{ preset.label }}</span>
                <span class="text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums">
                  {{ preset.defaultPercent }}%
                </span>
              </button>
              <p
                v-if="availablePresets.length === 0"
                class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-center py-2"
              >
                Все начисления добавлены
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <!-- Divider before total -->
      <div v-if="hasCharges" class="h-px bg-border-light dark:bg-border-dark mb-2" />

      <div class="flex items-baseline justify-between">
        <span class="text-body font-medium text-text-primary-light dark:text-text-primary-dark">
          Итого
        </span>
        <span
          class="text-h3 font-bold text-text-primary-light dark:text-text-primary-dark tabular-nums transition-all duration-200"
        >
          {{ formatCurrency(totalAmount, currency) }}
        </span>
      </div>
    </div>

    <!-- Validation error -->
    <Transition name="section-slide">
      <p v-if="validationError" class="text-sm text-danger mb-3 flex items-center gap-2">
        <UIcon name="error" size="sm" class="flex-shrink-0" />
        {{ validationError }}
      </p>
    </Transition>

    <UButton
      variant="primary"
      size="lg"
      full-width
      :disabled="disabled"
      aria-label="Перейти к назначению участников"
      @click="emit('requestNext')"
    >
      Далее — Участники
      <UIcon name="arrow_forward" size="sm" class="ml-2" />
    </UButton>
  </div>
</template>
