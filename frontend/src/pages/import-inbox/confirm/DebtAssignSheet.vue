<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import {
  DrawerRoot,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerTitle,
} from 'vaul-vue';
import { UButton, UIcon } from '@/shared/ui';
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';
import { useDrawerKeyboard } from '@/shared/lib/composables/useDrawerKeyboard';
import { formatCurrency, sanitizeCurrencyInput } from '@/shared/lib/format/currency';
import { PersonSelector, type Person } from '@/entities/person';
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
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  apply: [value: DebtAssignState];
  'save-person': [name: string];
}>();

const isDesktop = useIsDesktop();

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

function close() {
  emit('update:open', false);
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
  close();
}

const drawerContentRef = ref<{ $el?: HTMLElement } | null>(null);
const footerRef = ref<HTMLDivElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);
const { setupKeyboardListener, cleanupKeyboardListener } = useDrawerKeyboard(
  drawerContentRef,
  footerRef,
  scrollRef,
);

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
      nextTick(() => setupKeyboardListener());
    } else {
      cleanupKeyboardListener();
    }
  },
);
</script>

<template>
  <DrawerRoot
    :open="open"
    :direction="isDesktop ? 'right' : 'bottom'"
    @update:open="emit('update:open', $event)"
  >
    <DrawerPortal>
      <DrawerOverlay class="fixed inset-0 z-50 bg-black/40" />
      <DrawerContent
        ref="drawerContentRef"
        class="fixed z-50 flex flex-col bg-card-light dark:bg-card-dark"
        :class="
          isDesktop
            ? 'top-0 right-0 bottom-0 w-[420px] rounded-l-2xl border-l border-border-light dark:border-border-dark'
            : 'bottom-0 left-0 right-0 rounded-t-2xl border-t border-border-light dark:border-border-dark'
        "
      >
        <div v-if="!isDesktop" class="flex justify-center pt-3 pb-1">
          <DrawerHandle class="w-10 h-1 rounded-full bg-border-light dark:bg-border-dark" />
        </div>

        <div class="px-5 pb-2" :class="{ 'pt-4': isDesktop }">
          <div class="flex items-center justify-between">
            <DrawerTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ title }}
            </DrawerTitle>
            <button
              type="button"
              aria-label="Закрыть"
              class="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
              @click="close"
            >
              <UIcon name="close" size="sm" />
            </button>
          </div>
        </div>

        <div ref="scrollRef" class="px-5 space-y-3" data-vaul-no-drag>
          <PersonSelector
            :model-value="draft.personName"
            :people="people"
            :placeholder="namePlaceholder"
            :auto-save="true"
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

        <div ref="footerRef" class="px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <UButton variant="primary" size="md" full-width @click="save">Готово</UButton>
        </div>
      </DrawerContent>
    </DrawerPortal>
  </DrawerRoot>
</template>
