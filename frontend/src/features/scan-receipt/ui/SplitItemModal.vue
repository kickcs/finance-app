<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UButton, UIcon, UModal } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useHaptics } from '@/shared/lib/haptics';
import { calcSplitAmounts, calcLineTotal } from '../model/calcLineTotal';
import { canExplodeItem } from '../model/useItemsStep';
import type { ReceiptItem } from '../model/types';

const props = defineProps<{
  open: boolean;
  item: ReceiptItem | null;
  currency: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [firstQty: number];
  explode: [];
}>();

const { trigger } = useHaptics();

const splitFirstQty = ref(0);

const lineTotal = computed(() => (props.item ? calcLineTotal(props.item) : 0));

// «По 1 шт на строку» — правило берём из модели (единый источник правды)
const canExplode = computed(() => (props.item ? canExplodeItem(props.item) : false));

const splitSecondQty = computed(() => {
  if (!props.item) return 0;
  return Math.round((props.item.qty - splitFirstQty.value) * 100) / 100;
});

const splitValid = computed(() => splitFirstQty.value > 0 && splitSecondQty.value > 0);

const splitPreviewAmounts = computed(() => {
  if (!props.item || !splitValid.value) return [0, 0] as [number, number];
  return calcSplitAmounts(props.item, splitFirstQty.value);
});

watch(
  () => props.item,
  (item) => {
    if (!item) return;
    // Для целого qty — целая половина (floor), для дробного — ровно половина с
    // округлением до сетки 0.01. Зажимаем в [0.01, qty-0.01], чтобы во второй
    // строке всегда оставалось > 0 (иначе кнопка «Разделить» залипает).
    const half = Number.isInteger(item.qty)
      ? Math.floor(item.qty / 2)
      : Math.round((item.qty / 2) * 100) / 100;
    splitFirstQty.value = Math.min(Math.max(half, 0.01), Math.round((item.qty - 0.01) * 100) / 100);
  },
);

function stepFirstQty(delta: 1 | -1) {
  if (!props.item) return;
  trigger('selection');
  const next = Math.round((splitFirstQty.value + delta) * 100) / 100;
  splitFirstQty.value = Math.min(Math.max(next, 0.01), props.item.qty - 0.01);
}

function handleExplode() {
  trigger('success');
  emit('explode');
  emit('update:open', false);
}

function handleConfirm() {
  trigger('success');
  emit('confirm', splitFirstQty.value);
}
</script>

<template>
  <UModal
    :model-value="open"
    title="Разделить позицию"
    @update:model-value="emit('update:open', $event)"
  >
    <div v-if="item" class="space-y-4">
      <!-- Контекст: что делим -->
      <div
        class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-light dark:bg-surface-dark"
      >
        <div class="min-w-0 mr-3">
          <p
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ item.name || 'Без названия' }}
          </p>
          <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
            {{ item.qty }} шт
          </p>
        </div>
        <span class="text-sm font-bold text-primary tabular-nums shrink-0">
          {{ formatCurrency(lineTotal, currency) }}
        </span>
      </div>

      <!-- Быстрый режим: по одной штуке -->
      <button
        v-if="canExplode"
        type="button"
        class="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 text-left active:scale-[0.98] transition-all"
        @click="handleExplode"
      >
        <div class="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <UIcon name="format_list_numbered" size="sm" class="text-primary" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark">
            По 1 шт на строку
          </p>
          <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
            {{ item.qty }} отдельных строк — удобно раздать разным людям
          </p>
        </div>
        <UIcon
          name="chevron_right"
          size="xs"
          class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
        />
      </button>

      <!-- Кастомное деление на две строки -->
      <div>
        <p
          class="text-xs font-semibold text-text-tertiary-light dark:text-text-tertiary-dark uppercase tracking-wide mb-2"
        >
          Или на две строки
        </p>

        <div
          class="flex items-center justify-center gap-3 py-1"
          role="group"
          aria-label="Размер первой части"
        >
          <button
            type="button"
            aria-label="Меньше в первую строку"
            class="w-11 h-11 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:text-primary active:scale-90 transition-all"
            :disabled="splitFirstQty <= 0.01"
            @click="stepFirstQty(-1)"
          >
            <UIcon name="remove" size="sm" />
          </button>

          <input
            v-model.number="splitFirstQty"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0.01"
            :max="item.qty - 0.01"
            aria-label="Количество в первой строке"
            class="w-20 h-11 text-center rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark text-body font-bold text-text-primary-light dark:text-text-primary-dark outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 tabular-nums"
          />

          <button
            type="button"
            aria-label="Больше в первую строку"
            class="w-11 h-11 rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:text-primary active:scale-90 transition-all"
            :disabled="splitSecondQty <= 1"
            @click="stepFirstQty(1)"
          >
            <UIcon name="add" size="sm" />
          </button>
        </div>

        <!-- Живое превью двух строк -->
        <div
          class="mt-2 space-y-1.5 px-3 py-2.5 rounded-xl"
          :class="
            splitValid
              ? 'bg-primary/5 border border-primary/10'
              : 'bg-danger/5 border border-danger/20'
          "
        >
          <template v-if="splitValid">
            <div class="flex justify-between text-xs">
              <span class="text-text-secondary-light dark:text-text-secondary-dark">
                Строка 1 · {{ splitFirstQty }} шт
              </span>
              <span
                class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
              >
                {{ formatCurrency(splitPreviewAmounts[0], currency) }}
              </span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-text-secondary-light dark:text-text-secondary-dark">
                Строка 2 · {{ splitSecondQty }} шт
              </span>
              <span
                class="font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
              >
                {{ formatCurrency(splitPreviewAmounts[1], currency) }}
              </span>
            </div>
          </template>
          <p v-else class="text-xs text-danger">В каждой строке должно остаться больше нуля</p>
        </div>
      </div>

      <!-- Подсказка про совместные блюда -->
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark leading-relaxed">
        Если блюдо ели вместе — не делите его: на следующем шаге отметьте нескольких участников, и
        сумма разделится поровну.
      </p>
    </div>

    <template #actions>
      <UButton
        variant="primary"
        size="lg"
        full-width
        :disabled="!splitValid"
        @click="handleConfirm"
      >
        <UIcon name="call_split" size="sm" class="mr-2" />
        Разделить на две
      </UButton>
    </template>
  </UModal>
</template>
