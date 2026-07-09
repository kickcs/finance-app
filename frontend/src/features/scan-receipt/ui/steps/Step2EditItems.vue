<script setup lang="ts">
import { ref, computed } from 'vue';
import { UButton, UIcon } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useToast } from '@/shared/lib/composables/useToast';
import { formatCurrency } from '@/shared/lib/format/currency';
import ReceiptPaper from '../ReceiptPaper.vue';
import ReceiptItemRow from '../ReceiptItemRow.vue';
import ItemEditorSheet from '../ItemEditorSheet.vue';
import SplitItemModal from '../SplitItemModal.vue';
import ChargeRow from '../ChargeRow.vue';
import AddChargeSheet from '../AddChargeSheet.vue';
import TotalFooter from '../TotalFooter.vue';
import { calcChargeAmount } from '../../model/calcLineTotal';
import type { NewChargeInput } from '../../model/useItemsStep';
import type { ReceiptItem, ReceiptCharge } from '../../model/types';

const props = defineProps<{
  items: ReceiptItem[];
  currency: string;
  subtotal: number;
  charges: ReceiptCharge[];
  chargesAmount: number;
  totalAmount: number;
  ocrTotalAmount: number | null;
  totalMismatch: { diff: number } | null;
  /** Ручной режим: чека нет — «Переснять чек» не предлагаем */
  manualMode?: boolean;
}>();

const emit = defineEmits<{
  updateItem: [id: string, updates: Partial<ReceiptItem>];
  deleteItem: [id: string];
  addItem: [];
  splitItem: [id: string, firstQty: number];
  explodeItem: [id: string];
  addCharge: [charge: NewChargeInput];
  removeCharge: [id: string];
  toggleCharge: [id: string];
  updateChargePercent: [id: string, percent: number];
  updateChargeAmount: [id: string, amount: number];
  dismissMismatch: [];
  addDiffAsItem: [];
  next: [];
  back: [];
}>();

const { trigger } = useHaptics();
const { toast } = useToast();

const validationError = ref<string | null>(null);
const invalidItemId = ref<string | null>(null);

// Sheet-редактор позиции
const editorOpen = ref(false);
const editingItemId = ref<string | null>(null);
const editingItem = computed(() => props.items.find((i) => i.id === editingItemId.value) ?? null);

// Sheet добавления сбора
const addChargeOpen = ref(false);

// Split sheet
const splitModalOpen = ref(false);
const splitItemId = ref<string | null>(null);
const splitItem = computed(() => props.items.find((i) => i.id === splitItemId.value) ?? null);

function openEditor(item: ReceiptItem) {
  editingItemId.value = item.id;
  editorOpen.value = true;
  trigger('selection');
}

function handleEditorSave(updates: Partial<ReceiptItem>) {
  if (!editingItemId.value) return;
  emit('updateItem', editingItemId.value, updates);
  if (invalidItemId.value === editingItemId.value) {
    validationError.value = null;
    invalidItemId.value = null;
  }
}

function openSplitModal(item: ReceiptItem) {
  // Позицию нельзя разбить на две части, если в каждой не остаётся хотя бы 0.01
  // (шаг стеклянного степпера). Для таких позиций модалка залипла бы с
  // навсегда отключённой кнопкой — вместо этого подсказываем пользователю.
  if (item.qty < 0.02) {
    toast({
      title: 'Нельзя разделить',
      description: 'В позиции слишком мало для деления на две строки.',
      variant: 'warning',
    });
    return;
  }
  splitItemId.value = item.id;
  splitModalOpen.value = true;
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
    openEditor(firstInvalid);
    return;
  }

  emit('next');
}
</script>

<template>
  <div class="h-full flex flex-col relative">
    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-56">
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
            <UButton v-if="!manualMode" variant="ghost" size="md" full-width @click="emit('back')">
              Переснять чек
            </UButton>
          </div>
        </div>
      </template>

      <!-- Populated state: весь шаг — один чековый лист -->
      <template v-else>
        <ReceiptPaper :title="`Позиции чека · ${items.length}`" class="mb-4">
          <!-- Items list -->
          <TransitionGroup tag="div" name="item-list" class="relative">
            <ReceiptItemRow
              v-for="(item, index) in items"
              :key="item.id"
              :item="item"
              :index="index"
              :currency="currency"
              :is-invalid="invalidItemId === item.id"
              @edit="openEditor(item)"
              @delete="emit('deleteItem', item.id)"
              @split="openSplitModal(item)"
            />
          </TransitionGroup>

          <!-- Сборы и чаевые — печатаются строками на том же чеке -->
          <div
            v-if="charges.length > 0"
            aria-label="Сборы и чаевые"
            class="px-4 py-2 border-b border-dashed border-border-light dark:border-border-dark"
          >
            <ChargeRow
              v-for="charge in charges"
              :key="charge.id"
              :charge="charge"
              :amount="calcChargeAmount(subtotal, charge)"
              :currency="currency"
              @toggle="emit('toggleCharge', charge.id)"
              @update-percent="emit('updateChargePercent', charge.id, $event)"
              @update-amount="emit('updateChargeAmount', charge.id, $event)"
              @remove="emit('removeCharge', charge.id)"
            />
          </div>

          <!-- Печатная строка действий: позиция | сбор -->
          <div
            class="grid grid-cols-2 divide-x divide-dashed divide-border-light dark:divide-border-dark"
          >
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 px-3 py-3.5 text-primary active:bg-surface-light dark:active:bg-surface-dark transition-colors duration-150"
              aria-label="Добавить позицию вручную"
              @click="emit('addItem')"
            >
              <UIcon name="add" size="sm" />
              <span class="text-body-sm font-semibold">Позиция</span>
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-1.5 px-3 py-3.5 text-primary active:bg-surface-light dark:active:bg-surface-dark transition-colors duration-150"
              aria-label="Добавить сбор или чаевые"
              @click="addChargeOpen = true"
            >
              <UIcon name="add" size="sm" />
              <span class="text-body-sm font-semibold">Сбор</span>
            </button>
          </div>
        </ReceiptPaper>
      </template>
    </div>

    <!-- Sticky Glass Footer -->
    <TotalFooter
      :subtotal="subtotal"
      :charges-amount="chargesAmount"
      :total-amount="totalAmount"
      :currency="currency"
      :validation-error="validationError"
      :disabled="items.length === 0"
      @request-next="validateAndNext"
    >
      <template #banner>
        <!-- Сверка с итогом чека из OCR -->
        <Transition name="section-slide">
          <div
            v-if="totalMismatch && ocrTotalAmount"
            class="mb-3 px-3 py-2.5 rounded-xl bg-warning/[0.08] border border-warning/20"
            role="alert"
          >
            <div class="flex items-start gap-2">
              <UIcon name="warning" size="sm" class="text-warning flex-shrink-0 mt-0.5" />
              <p class="text-xs text-warning font-medium flex-1">
                Позиции дают {{ formatCurrency(totalAmount, currency) }}, а в чеке итог
                {{ formatCurrency(ocrTotalAmount, currency) }} — разница
                {{ formatCurrency(Math.abs(totalMismatch.diff), currency) }}
              </p>
            </div>
            <div class="flex items-center gap-4 mt-1.5 pl-6">
              <button
                v-if="totalMismatch.diff > 0"
                type="button"
                class="text-xs font-semibold text-warning underline underline-offset-2"
                @click="emit('addDiffAsItem')"
              >
                Добавить разницу строкой
              </button>
              <button
                type="button"
                class="text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
                @click="emit('dismissMismatch')"
              >
                Скрыть
              </button>
            </div>
          </div>
        </Transition>
      </template>
    </TotalFooter>

    <!-- Add charge sheet -->
    <AddChargeSheet
      v-model:open="addChargeOpen"
      :charges="charges"
      :currency="currency"
      @add="emit('addCharge', $event)"
    />

    <!-- Item editor sheet -->
    <ItemEditorSheet
      v-model:open="editorOpen"
      :item="editingItem"
      :currency="currency"
      @save="handleEditorSave"
      @split="editingItem && openSplitModal(editingItem)"
      @delete="editingItemId && emit('deleteItem', editingItemId)"
    />

    <!-- Split sheet -->
    <SplitItemModal
      v-model:open="splitModalOpen"
      :item="splitItem"
      :currency="currency"
      @explode="
        () => {
          emit('explodeItem', splitItemId!);
          splitItemId = null;
        }
      "
      @confirm="
        (firstQty) => {
          emit('splitItem', splitItemId!, firstQty);
          splitModalOpen = false;
          splitItemId = null;
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

@media (prefers-reduced-motion: reduce) {
  .item-list-enter-active,
  .item-list-leave-active,
  .item-list-move {
    transition: opacity 0.15s ease !important;
  }
  .item-list-enter-from,
  .item-list-leave-to {
    transform: none !important;
  }
}
</style>
