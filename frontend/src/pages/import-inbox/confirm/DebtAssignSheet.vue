<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { UButton, UIcon } from '@/shared/ui';
import { formatCurrency, sanitizeCurrencyInput } from '@/shared/lib/format/currency';
import { PersonSelector, type Person, type DebtUsage } from '@/entities/person';
import {
  debtNetAmount,
  validateDebtAssign,
  validateFee,
  type DebtAssignState,
} from '../model/debtAssign';

const props = defineProps<{
  open: boolean;
  state: DebtAssignState;
  direction: 'given' | 'taken';
  totalAmount: number;
  currency: string;
  people: Person[];
  /** Долги — сигнал частоты для порядка имён в списке. */
  debts?: DebtUsage[];
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  apply: [value: DebtAssignState];
  'save-person': [name: string];
}>();

// Черновик: применяется только по «Готово», закрытие свайпом не портит состояние.
const draft = ref<DebtAssignState>({ ...props.state });
const rawFeeValue = ref(props.state.fee > 0 ? String(props.state.fee) : '');
// Ошибку по имени не показываем до первой попытки сабмита — иначе шторка
// ругается на пустую форму сразу при открытии.
const submitAttempted = ref(false);
const error = ref<string | null>(null);

const title = computed(() => (props.direction === 'given' ? 'Кому в долг?' : 'У кого в долг?'));
const namePlaceholder = 'Имя человека';

const netAmount = computed(() => debtNetAmount(props.totalAmount, draft.value.fee));
const showBreakdown = computed(() => props.direction === 'given' && draft.value.fee > 0);

function handleFeeInput(raw: string) {
  // Как fee-инпут в TransferPanel: sanitize → сырая строка → parseFloat.
  const sanitized = sanitizeCurrencyInput(raw);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  draft.value.fee = Number.isNaN(num) ? 0 : num;
  // Ошибку комиссии показываем реактивно, не дожидаясь сабмита.
  const feeError = validateFee(draft.value.fee, props.totalAmount);
  if (feeError) error.value = feeError;
  else if (submitAttempted.value)
    error.value = validateDebtAssign(draft.value, props.totalAmount, props.direction);
  else error.value = null;
}

function updatePersonName(name: string) {
  draft.value.personName = name;
  if (submitAttempted.value) {
    error.value = validateDebtAssign(draft.value, props.totalAmount, props.direction);
  }
}

function save() {
  submitAttempted.value = true;
  const err = validateDebtAssign(draft.value, props.totalAmount, props.direction);
  if (err) {
    error.value = err;
    return;
  }
  // Имя тримим (уходит в имя долга), комиссия имеет смысл только при выдаче —
  // для taken инпут скрыт, но черновик мог сохранить значение с прошлого раза.
  emit('apply', {
    personName: draft.value.personName.trim(),
    fee: props.direction === 'given' ? draft.value.fee : 0,
  });
  emit('update:open', false);
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = { ...props.state };
      rawFeeValue.value = draft.value.fee > 0 ? String(draft.value.fee) : '';
      submitAttempted.value = false;
      error.value = null;
      // Фокус в PersonSelector НЕ ставим автоматически — иначе в TMA клавиатура
      // выпрыгивает поверх шторки ещё до того, как пользователь что-то тапнул.
    }
  },
);
</script>

<template>
  <UOverlay
    :model-value="open"
    :title="title"
    fill
    @update:model-value="emit('update:open', $event)"
  >
    <template #action>
      <UButton variant="primary" size="sm" @click="save">Готово</UButton>
    </template>

    <div class="space-y-3">
      <PersonSelector
        :model-value="draft.personName"
        :people="people"
        :debts="debts"
        :placeholder="namePlaceholder"
        auto-save
        @update:model-value="updatePersonName"
        @select="updatePersonName"
        @save-person="(name: string) => emit('save-person', name)"
      />

      <!-- Комиссия — только при выдаче долга (со счёта уходит вся сумма, часть — комиссии). -->
      <div
        v-if="direction === 'given'"
        class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-light/50 dark:bg-surface-dark/50 border border-border-light dark:border-border-dark"
      >
        <UIcon
          name="receipt_long"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark shrink-0"
        />
        <span class="text-xs text-text-secondary-light dark:text-text-secondary-dark shrink-0">
          Комиссия
        </span>
        <input
          type="text"
          inputmode="decimal"
          :value="rawFeeValue"
          placeholder="0"
          class="flex-1 min-w-0 bg-transparent text-sm text-right text-text-primary-light dark:text-text-primary-dark outline-none tabular-nums"
          @input="handleFeeInput(($event.target as HTMLInputElement).value)"
        />
        <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark shrink-0">
          {{ currency }}
        </span>
      </div>

      <!-- Разложение суммы: долг + комиссия = сумма импорта. -->
      <p
        v-if="showBreakdown"
        class="px-1 text-xs text-text-tertiary-light dark:text-text-tertiary-dark tabular-nums"
      >
        Долг {{ formatCurrency(netAmount, currency) }} + комиссия
        {{ formatCurrency(draft.fee, currency) }} = {{ formatCurrency(totalAmount, currency) }}
      </p>

      <p v-if="error" class="px-1 text-xs text-danger">{{ error }}</p>
    </div>
  </UOverlay>
</template>
