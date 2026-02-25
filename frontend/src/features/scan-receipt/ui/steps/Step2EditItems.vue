<script setup lang="ts">
import { ref } from 'vue';
import { UButton, UBadge, UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { haptics } from '@/shared/lib/haptics';
import ReceiptItemRow from '../ReceiptItemRow.vue';
import type { ReceiptItem } from '../../model/types';

const props = defineProps<{
  items: ReceiptItem[];
  currency: string;
  subtotal: number;
  serviceChargePercent: number | null;
  serviceChargeAmount: number;
  totalAmount: number;
}>();

const emit = defineEmits<{
  updateItem: [id: string, updates: Partial<ReceiptItem>];
  deleteItem: [id: string];
  addItem: [];
  next: [];
  back: [];
}>();

const validationError = ref<string | null>(null);
const invalidItemId = ref<string | null>(null);

function validateAndNext() {
  validationError.value = null;
  invalidItemId.value = null;

  const firstInvalid = props.items.find(
    (item) => !item.name.trim() || item.unitPrice <= 0,
  );

  if (firstInvalid) {
    invalidItemId.value = firstInvalid.id;
    validationError.value = !firstInvalid.name.trim()
      ? 'Заполните название позиции'
      : 'Цена позиции должна быть больше нуля';
    haptics.error();
    return;
  }

  emit('next');
}
</script>

<template>
  <div class="h-full flex flex-col">

    <!-- Scrollable items list -->
    <div class="flex-1 overflow-y-auto no-scrollbar px-5 pt-4 pb-4">

      <!-- Empty state -->
      <template v-if="items.length === 0">
        <div class="flex-1 flex flex-col items-center justify-center px-8 gap-5 py-10 h-full">
          <div class="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center">
            <UIcon name="receipt" size="xl" class="text-warning" />
          </div>
          <div class="text-center">
            <h3 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark mb-1">
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
          <div class="flex items-center gap-2">
            <h2 class="text-body font-semibold text-text-primary-light dark:text-text-primary-dark">
              Позиции чека
            </h2>
            <span
              v-if="serviceChargePercent && serviceChargeAmount > 0"
              class="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full tabular-nums"
            >
              +{{ serviceChargePercent }}% обсл.
            </span>
          </div>
          <UBadge variant="neutral" size="sm" shape="pill">
            {{ items.length }}
          </UBadge>
        </div>

        <!-- Items list -->
        <TransitionGroup
          tag="div"
          name="item-list"
          class="space-y-2 relative"
        >
          <ReceiptItemRow
            v-for="(item, index) in items"
            :key="item.id"
            :item="item"
            :index="index"
            :currency="currency"
            :service-charge-percent="serviceChargePercent"
            :is-invalid="invalidItemId === item.id"
            @update="emit('updateItem', item.id, $event); if (invalidItemId === item.id) { validationError = null; invalidItemId = null; }"
            @delete="emit('deleteItem', item.id)"
          />
        </TransitionGroup>

        <!-- Add item button -->
        <button
          type="button"
          class="mt-3 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl
                 border border-dashed border-border-light dark:border-border-dark
                 text-text-secondary-light dark:text-text-secondary-dark
                 hover:border-primary/40 hover:text-primary hover:bg-primary-light
                 active:scale-[0.98] transition-all duration-150"
          aria-label="Добавить позицию вручную"
          @click="emit('addItem')"
        >
          <UIcon name="add" size="sm" />
          <span class="text-body-sm font-medium">Добавить позицию</span>
        </button>
      </template>

    </div>

    <!-- Sticky footer -->
    <div
      class="flex-shrink-0 border-t border-border-light dark:border-border-dark
             px-5 pt-3 pb-[calc(1.25rem+var(--safe-area-inset-bottom))]
             bg-background-light dark:bg-background-dark"
    >
      <!-- Total breakdown -->
      <div class="mb-3">
        <!-- With service charge: show subtotal → charge → total -->
        <template v-if="serviceChargePercent && serviceChargeAmount > 0">
          <div class="flex items-baseline justify-between mb-1">
            <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
              Подытог
            </span>
            <span class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
              {{ formatCurrency(subtotal, currency) }}
            </span>
          </div>
          <div class="flex items-baseline justify-between mb-2">
            <span class="text-caption text-primary font-medium">
              Обслуживание {{ serviceChargePercent }}%
            </span>
            <span class="text-body-sm text-primary tabular-nums font-medium">
              +{{ formatCurrency(serviceChargeAmount, currency) }}
            </span>
          </div>
          <div class="h-px bg-border-light dark:bg-border-dark mb-2" />
        </template>
        <div class="flex items-baseline justify-between">
          <span class="text-body font-medium text-text-primary-light dark:text-text-primary-dark">
            Итого
          </span>
          <span
            class="text-h3 font-bold text-text-primary-light dark:text-text-primary-dark
                   tabular-nums transition-all duration-200"
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
