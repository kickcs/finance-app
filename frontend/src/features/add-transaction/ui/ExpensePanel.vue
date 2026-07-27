<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { UIcon, InitialAvatar } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { Transaction } from '@/shared/api/database.types';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { AccountWithBalances } from '@/entities/account';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import { CategoryPicker } from '@/entities/category';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  transactions?: Transaction[];
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  /** Переход на страницу закончился — можно дорисовывать ряд действий. */
  ready?: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();

const SplitExpenseDrawer = defineAsyncComponent(
  () => import('@/features/split-expense/ui/SplitExpenseDrawer.vue'),
);

// Сумма, валюта и счёт живут на карточке сверху — панели остаются категория
// и разделение расхода.
const { updateField } = usePanelState(props, emit);

const router = useRouter();
const drawerOpen = ref(false);

const hasSplit = computed(
  () => props.splitData?.enabled && props.splitData.participants.length > 0,
);

const splitSummary = computed(() => {
  if (!props.splitData || !hasSplit.value) return '';
  const names = props.splitData.participants.map((p) => p.personName);
  if (names.length <= 2) return names.join(', ');
  return `${names[0]}, ${names[1]} +${names.length - 2}`;
});

function clearSplit() {
  emit('setSplitEnabled', false);
}

function toScanReceipt() {
  router.push({ name: ROUTE_NAMES.SCAN_RECEIPT });
}

const chipBase =
  'meta-chip rounded-xl border transition-[color,background-color,border-color,transform] duration-200 active:scale-[0.99]';
// Действие, а не поле: без карточной заливки, чтобы не спорить с мета-строкой
const chipIdle = 'border-border-light dark:border-border-dark hover:border-primary/40';
</script>

<template>
  <div class="space-y-3" data-testid="expense-panel">
    <CategoryPicker
      :categories="categories"
      :selected-id="formData.categoryId"
      :transactions="transactions"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />

    <div v-if="ready !== false" class="form-tail flex items-stretch gap-2">
      <!-- Разделение настроено -->
      <div
        v-if="splitData && hasSplit"
        :class="[chipBase, 'flex min-w-0 flex-1 items-center border-primary/30 bg-primary/[0.05]']"
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left"
          @click="drawerOpen = true"
        >
          <div class="flex -space-x-1.5">
            <InitialAvatar
              v-for="p in splitData!.participants.slice(0, 3)"
              :key="p.id"
              :name="p.personName"
              :color="p.personColor || '#3b82f6'"
              size="xs"
              class="ring-1 ring-card-light dark:ring-card-dark"
            />
          </div>
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ splitSummary }}
            </span>
            <span class="block text-xs text-text-secondary-light dark:text-text-secondary-dark">
              Разделено на {{ splitData!.participants.length + (splitData!.isIncluded ? 1 : 0) }}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-label="Убрать разделение"
          class="flex h-11 w-11 shrink-0 items-center justify-center text-text-tertiary-light dark:text-text-tertiary-dark transition-colors hover:text-danger"
          @click="clearSplit"
        >
          <UIcon name="close" size="xs" />
        </button>
      </div>

      <!-- Разделение не настроено -->
      <button
        v-else-if="splitData"
        type="button"
        :class="[chipBase, chipIdle, 'flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5']"
        @click="drawerOpen = true"
      >
        <UIcon
          name="group"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <span
          class="min-w-0 flex-1 truncate text-left text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          Разделить расход
        </span>
        <UIcon
          name="chevron_right"
          size="sm"
          class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
      </button>

      <!-- Иконка без подписи не читалась: по ней не понимали, что кнопка
           заполняет форму из чека. -->
      <button
        type="button"
        :class="[chipBase, chipIdle, 'flex shrink-0 items-center gap-2 px-3 py-2.5']"
        @click="toScanReceipt"
      >
        <UIcon
          name="document_scanner"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <span
          class="whitespace-nowrap text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          Скан чека
        </span>
      </button>
    </div>

    <SplitExpenseDrawer
      v-if="splitData"
      :open="drawerOpen"
      :total-amount="formData.amount"
      :currency="formData.currency"
      :split-data="splitData"
      :validation-error="splitValidationError"
      @update:open="drawerOpen = $event"
      @add-participant="
        (name: string, fromContacts: boolean, color?: string) =>
          $emit('addParticipant', name, fromContacts, color)
      "
      @remove-participant="$emit('removeParticipant', $event)"
      @update-participant-amount="(id, amount) => $emit('updateParticipantAmount', id, amount)"
      @set-method="$emit('setSplitMethod', $event)"
      @set-my-share="$emit('setMyShare', $event)"
      @set-is-included="$emit('setIsIncluded', $event)"
      @set-enabled="$emit('setSplitEnabled', $event)"
    />
  </div>
</template>

<style scoped>
/* Scoped-стили между компонентами не наследуются — правило повторяет то, что
   есть в `TransactionForm` для остального хвоста формы. */
.form-tail {
  animation: tail-in 120ms ease-out both;
}

@keyframes tail-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .meta-chip {
    transition: none;
  }
  .form-tail {
    animation: none;
  }
}
</style>
