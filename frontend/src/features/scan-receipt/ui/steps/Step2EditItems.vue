<script setup lang="ts">
import { ref, computed, useTemplateRef } from 'vue';
import { UButton, UBadge, UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import ReceiptItemRow from '../ReceiptItemRow.vue';
import SplitItemModal from '../SplitItemModal.vue';
import TotalFooter from '../TotalFooter.vue';
import { formatCurrency } from '@/shared/lib/format/currency';
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
  updateChargeAmount: [id: string, amount: number];
  next: [];
  back: [];
}>();

function formatChargeBadge(charge: ReceiptCharge): string {
  if (charge.type === 'amount') {
    return `+${formatCurrency(charge.amount, props.currency)} ${charge.label.toLowerCase()}`;
  }
  return `+${charge.percent}% ${charge.label.toLowerCase()}`;
}

const { trigger } = useHaptics();

const itemRowRefs = useTemplateRef<InstanceType<typeof ReceiptItemRow>[]>('itemRows');

const validationError = ref<string | null>(null);
const invalidItemId = ref<string | null>(null);

// Split modal state
const splitModalOpen = ref(false);
const splitItem = ref<ReceiptItem | null>(null);

function openSplitModal(item: ReceiptItem) {
  splitItem.value = item;
  splitModalOpen.value = true;
}

const enabledCharges = computed(() => props.charges.filter((c) => c.enabled));

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
            <UButton variant="primary" size="lg" full-width @click="emit('addItem')">
              <UIcon name="add" size="sm" class="mr-2" />
              Добавить вручную
            </UButton>
            <UButton variant="ghost" size="md" full-width @click="emit('back')">
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
              class="text-caption font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums"
            >
              {{ formatChargeBadge(charge) }}
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
    <TotalFooter
      :subtotal="subtotal"
      :charges="charges"
      :charges-amount="chargesAmount"
      :total-amount="totalAmount"
      :currency="currency"
      :validation-error="validationError"
      :disabled="items.length === 0"
      @add-charge="(label, percent) => emit('addCharge', label, percent)"
      @remove-charge="(id) => emit('removeCharge', id)"
      @toggle-charge="(id) => emit('toggleCharge', id)"
      @update-charge-percent="(id, percent) => emit('updateChargePercent', id, percent)"
      @update-charge-amount="(id, amount) => emit('updateChargeAmount', id, amount)"
      @request-next="validateAndNext"
    />

    <!-- Split Modal -->
    <SplitItemModal
      v-model:open="splitModalOpen"
      :item="splitItem"
      :currency="currency"
      @confirm="
        (firstQty) => {
          emit('splitItem', splitItem!.id, firstQty);
          splitModalOpen = false;
          splitItem = null;
        }
      "
    />
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
