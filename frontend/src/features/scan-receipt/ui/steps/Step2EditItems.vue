<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';
import { UButton, UBadge, UIcon, UModal } from '@/shared/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import ReceiptItemRow from '../ReceiptItemRow.vue';
import ChargeRow from '../ChargeRow.vue';
import { CHARGE_PRESETS } from '../../model/constants';
import { calcSplitAmounts } from '../../model/calcLineTotal';
import type { ReceiptItem, ReceiptCharge } from '../../model/types';

const props = defineProps<{
  items: ReceiptItem[];
  currency: string;
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
}>();

const emit = defineEmits<{
  updateItem: [id: string, updates: Partial<ReceiptItem>];
  deleteItem: [id: string];
  addItem: [];
  splitItem: [id: string, firstQty: number];
  addCharge: [label: string, percent: number];
  removeCharge: [id: string];
  toggleCharge: [id: string];
  updateChargePercent: [id: string, percent: number];
  next: [];
  back: [];
}>();

const { trigger } = useHaptics();

const itemRowRefs = useTemplateRef<InstanceType<typeof ReceiptItemRow>[]>('itemRows');

const validationError = ref<string | null>(null);
const invalidItemId = ref<string | null>(null);
const addChargeOpen = ref(false);

// Split modal state
const splitModalOpen = ref(false);
const splitItem = ref<ReceiptItem | null>(null);
const splitFirstQty = ref(0);

const splitSecondQty = computed(() => {
  if (!splitItem.value) return 0;
  return splitItem.value.qty - splitFirstQty.value;
});

const splitValid = computed(() => {
  return splitFirstQty.value > 0 && splitSecondQty.value > 0;
});

const splitPreviewAmounts = computed(() => {
  if (!splitItem.value || !splitValid.value) return [0, 0] as [number, number];
  return calcSplitAmounts(splitItem.value, splitFirstQty.value);
});

function openSplitModal(item: ReceiptItem) {
  splitItem.value = item;
  splitFirstQty.value = Math.floor(item.qty / 2);
  splitModalOpen.value = true;
}

function confirmSplit() {
  if (!splitItem.value || !splitValid.value) return;
  emit('splitItem', splitItem.value.id, splitFirstQty.value);
  splitModalOpen.value = false;
  splitItem.value = null;
}

const enabledCharges = computed(() => props.charges.filter((c) => c.enabled));
const hasCharges = computed(() => enabledCharges.value.length > 0);

/** Presets not yet added (match by label) */
const availablePresets = computed(() => {
  const existingLabels = new Set(props.charges.map((c) => c.label));
  return CHARGE_PRESETS.filter((p) => !existingLabels.has(p.label));
});

function getChargeAmount(charge: ReceiptCharge): number {
  if (!charge.enabled) return 0;
  return Math.round((props.subtotal * charge.percent) / 100);
}

function handleAddPreset(preset: (typeof CHARGE_PRESETS)[number]) {
  emit('addCharge', preset.label, preset.defaultPercent);
  addChargeOpen.value = false;
  trigger('selection');
}

function validateAndNext() {
  validationError.value = null;
  invalidItemId.value = null;

  const firstInvalid = props.items.find((item) => !item.name.trim() || item.unitPrice <= 0);

  if (firstInvalid) {
    invalidItemId.value = firstInvalid.id;
    validationError.value = !firstInvalid.name.trim()
      ? 'Заполните название позиции'
      : 'Цена позиции должна быть больше нуля';
    trigger('error');
    return;
  }

  emit('next');
}

function handleFocusNext(index: number, currentField: 'name' | 'price' | 'qty') {
  let nextField: 'name' | 'price' | 'qty' = 'name';
  let nextIndex = index;

  if (currentField === 'name') {
    nextField = 'price';
  } else if (currentField === 'price' || currentField === 'qty') {
    if (index + 1 < props.items.length) {
      nextField = 'name';
      nextIndex = index + 1;
    } else {
      validateAndNext();
      return;
    }
  }

  itemRowRefs.value?.[nextIndex]?.focusField(nextField);
}
</script>

<template>
  <div class="h-full flex flex-col relative">
    <!-- Scrollable items list -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-52">
      <!-- Empty state -->
      <template v-if="items.length === 0">
        <div class="flex-1 flex flex-col items-center justify-center px-8 gap-5 py-10 h-full">
          <div class="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center">
            <UIcon name="receipt" size="xl" class="text-warning" />
          </div>
          <div class="text-center">
            <h3
              class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark mb-1"
            >
              Позиции не найдены
            </h3>
            <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
              Добавьте позиции вручную или переснимите чек
            </p>
          </div>
          <div class="flex flex-col gap-2 w-full">
            <UButton variant="primary" size="lg" :full-width="true" @click="emit('addItem')">
              <UIcon name="add" size="sm" class="mr-2" />
              Добавить вручную
            </UButton>
            <UButton variant="ghost" size="md" :full-width="true" @click="emit('back')">
              Переснять чек
            </UButton>
          </div>
        </div>
      </template>

      <!-- Populated state -->
      <template v-else>
        <!-- Section header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark">
              Позиции чека
            </h2>
            <span
              v-for="charge in enabledCharges"
              :key="charge.id"
              class="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums"
            >
              +{{ charge.percent }}% {{ charge.label.toLowerCase() }}
            </span>
          </div>
          <UBadge variant="neutral" size="sm" shape="pill">
            {{ items.length }}
          </UBadge>
        </div>

        <!-- Items list -->
        <TransitionGroup tag="div" name="item-list" class="space-y-2 relative">
          <ReceiptItemRow
            v-for="(item, index) in items"
            ref="itemRows"
            :key="item.id"
            :item="item"
            :index="index"
            :currency="currency"
            :charges="charges"
            :is-invalid="invalidItemId === item.id"
            @update="
              emit('updateItem', item.id, $event);
              if (invalidItemId === item.id) {
                validationError = null;
                invalidItemId = null;
              }
            "
            @delete="emit('deleteItem', item.id)"
            @split="openSplitModal(item)"
            @focus-next="handleFocusNext(index, $event)"
          />
        </TransitionGroup>

        <!-- Add item button -->
        <button
          type="button"
          class="mt-3 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border border-dashed border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:border-primary/40 hover:text-primary hover:bg-primary-light active:scale-[0.98] transition-all duration-150"
          aria-label="Добавить позицию вручную"
          @click="emit('addItem')"
        >
          <UIcon name="add" size="sm" />
          <span class="text-body-sm font-medium">Добавить позицию</span>
        </button>
      </template>
    </div>

    <!-- Sticky Glass Footer -->
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
        :full-width="true"
        :disabled="items.length === 0"
        aria-label="Перейти к назначению участников"
        @click="validateAndNext"
      >
        Далее — Участники
        <UIcon name="arrow_forward" size="sm" class="ml-2" />
      </UButton>
    </div>

    <!-- Split Modal -->
    <UModal v-model="splitModalOpen" title="Разделить позицию">
      <div v-if="splitItem" class="space-y-4">
        <!-- Item being split -->
        <div class="px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark">
          <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            {{ splitItem.name }}
          </p>
          <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
            Количество: {{ splitItem.qty }}
          </p>
        </div>

        <!-- First part input -->
        <div>
          <label
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
          >
            Первая часть
          </label>
          <input
            v-model.number="splitFirstQty"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0.01"
            :max="splitItem.qty - 0.01"
            class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
          />
        </div>

        <!-- Second part (auto-calculated) -->
        <div>
          <label
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5 block"
          >
            Вторая часть
          </label>
          <div
            class="w-full px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-sm font-medium tabular-nums"
            :class="
              splitSecondQty > 0
                ? 'text-text-primary-light dark:text-text-primary-dark'
                : 'text-danger'
            "
          >
            {{ splitSecondQty > 0 ? splitSecondQty : 'Некорректное значение' }}
          </div>
        </div>

        <!-- Preview of amounts -->
        <div
          v-if="splitValid"
          class="space-y-1.5 px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10"
        >
          <div class="flex justify-between text-xs">
            <span class="text-text-secondary-light dark:text-text-secondary-dark">
              Часть 1 ({{ splitFirstQty }})
            </span>
            <span
              class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
            >
              {{ formatCurrency(splitPreviewAmounts[0], currency) }}
            </span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-text-secondary-light dark:text-text-secondary-dark">
              Часть 2 ({{ splitSecondQty }})
            </span>
            <span
              class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
            >
              {{ formatCurrency(splitPreviewAmounts[1], currency) }}
            </span>
          </div>
        </div>
      </div>

      <template #actions>
        <UButton
          variant="primary"
          size="lg"
          full-width
          :disabled="!splitValid"
          @click="confirmSplit"
        >
          <UIcon name="call_split" size="sm" class="mr-2" />
          Разделить
        </UButton>
      </template>
    </UModal>
  </div>
</template>

<style>
@import '../transitions.css';
</style>

<style scoped>
.item-list-enter-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.item-list-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: absolute;
  width: 100%;
}
.item-list-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.97);
}
.item-list-leave-to {
  opacity: 0;
  transform: translateX(20px) scale(0.97);
}
.item-list-move {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
