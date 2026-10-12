<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { UIcon } from '@/shared/ui/icon';
import AccountPopover from '@/entities/account/ui/AccountPopover.vue';
import type { AccountWithBalances } from '@/entities/account/model/types';
import { getCurrencyByCode } from '@/entities/currency';
import PaymentSplitBar from '@/entities/transaction/ui/PaymentSplitBar.vue';
import { formatCurrency, formatNumberWithSpaces } from '@/shared/lib/format/currency';
import { useAmountInput } from '@/shared/lib/hooks/useAmountInput';
import { resolveParts, validateSecondPart, type SecondPart } from '../model/paymentParts';
import { balanceIn, secondPartCandidates, startSecondPart } from '../model/secondPartAccounts';

/**
 * Оплата одной операции с двух счетов.
 *
 * Пока второй части нет — тихая кнопка «второй счёт». С ней — полоска
 * пропорции и две строки «● Счёт … сумма». Первый счёт обычно выбирает
 * селектор экрана выше; где его нет (`primaryPickable`), выбор в первой строке.
 */
const props = withDefaults(
  defineProps<{
    modelValue: SecondPart | null;
    accounts: AccountWithBalances[];
    primaryAccountId: string | null;
    currency: string;
    /** Итог операции. При якоре `primary` не используется — итог считает редактор. */
    total: number;
    /** `total` — итог задан, вторая часть отнимается от первой; `primary` — первая закреплена банком. */
    anchor?: 'total' | 'primary';
    /** Первая часть из уведомления банка (якорь `primary`). */
    primaryFixed?: number;
    /** Куда движутся деньги — для прогноза остатка под каждой частью; `null` — без прогноза. */
    sign?: 'minus' | 'plus' | null;
    /** Первый счёт выбирается прямо в первой строке — экран прячет свой селектор. */
    primaryPickable?: boolean;
  }>(),
  { anchor: 'total', primaryFixed: 0, sign: null, primaryPickable: false },
);

const emit = defineEmits<{
  'update:modelValue': [value: SecondPart | null];
  /** Только якорь `primary`: новый итог операции = первая часть + вторая. */
  'update:total': [value: number];
  'update:primaryAccountId': [value: string];
}>();

const candidates = computed(() =>
  secondPartCandidates(props.accounts, props.primaryAccountId, props.currency),
);
const primaryAccount = computed(() => props.accounts.find((a) => a.id === props.primaryAccountId));
const secondAccount = computed(() =>
  props.accounts.find((a) => a.id === props.modelValue?.accountId),
);

const parts = computed(() =>
  resolveParts({
    anchor: props.anchor,
    total: props.total,
    primaryFixed: props.primaryFixed,
    secondAmount: props.modelValue?.amount ?? 0,
  }),
);

const currencySymbol = computed(() => getCurrencyByCode(props.currency)?.symbol ?? props.currency);

function withSymbol(value: number) {
  return `${formatCurrency(value, props.currency, { showSymbol: false })} ${currencySymbol.value}`;
}

function formatPart(value: number) {
  return formatNumberWithSpaces(String(value)) || '0';
}

function emitPart(next: SecondPart | null) {
  emit('update:modelValue', next);
  if (props.anchor === 'primary') {
    const { total } = resolveParts({
      anchor: 'primary',
      total: 0,
      primaryFixed: props.primaryFixed,
      secondAmount: next?.amount ?? 0,
    });
    emit('update:total', total);
  }
}

// --- Ввод суммы второй части ----------------------------------------------------
const touched = ref(false);

const { inputRef, rawValue, displayAmount, isFocused, onInput } = useAmountInput({
  amount: () => props.modelValue?.amount ?? 0,
  onChange: (amount) => {
    if (!props.modelValue) return;
    if (amount > 0) touched.value = true;
    emitPart({ ...props.modelValue, amount });
  },
});

function enable() {
  emitPart(startSecondPart(candidates.value));
}

function selectAccount(accountId: string) {
  if (!props.modelValue) return;
  touched.value = true;
  emitPart({ ...props.modelValue, accountId });
}

function remove() {
  touched.value = false;
  emitPart(null);
}

/** Сразу к вводу суммы: ради неё вторую часть и включают. */
function focusAmount() {
  nextTick(() => inputRef.value?.focus());
}

watch(
  () => props.modelValue !== null,
  (on, wasOn) => {
    if (on && !wasOn) focusAmount();
  },
);

// Счёт второй части перестал подходить (его выбрали первым, сменилась валюта) — снимаем выбор.
watch(
  () => candidates.value.map((a) => a.id).join(),
  () => {
    const part = props.modelValue;
    if (!part?.accountId || props.accounts.length === 0) return;
    if (candidates.value.some((a) => a.id === part.accountId)) return;
    emitPart({ ...part, accountId: startSecondPart(candidates.value).accountId });
  },
  { immediate: true },
);

// Полоска появляется целой и расходится на доли — видно, что сумма разделилась.
const revealed = ref(false);
onMounted(() => {
  if (props.modelValue) {
    // Принудительный reflow фиксирует стартовую ширину, иначе переход не запустится.
    void document.body.offsetWidth;
    if (props.modelValue.amount === 0) focusAmount();
  }
  revealed.value = true;
});

const barSegments = computed(
  () =>
    [
      {
        label: primaryAccount.value?.name ?? 'Первый счёт',
        amount: revealed.value ? parts.value.primaryAmount : parts.value.total,
        color: primaryAccount.value?.color,
      },
      {
        label: secondAccount.value?.name ?? 'Второй счёт',
        amount: revealed.value ? parts.value.secondAmount : 0,
        color: secondAccount.value?.color,
      },
    ] as [
      { label: string; amount: number; color?: string },
      { label: string; amount: number; color?: string },
    ],
);

// --- Прогноз остатка ------------------------------------------------------------
interface Note {
  tone: 'muted' | 'warning';
  text: string;
}

function forecast(account: AccountWithBalances | undefined, amount: number): Note | null {
  if (!props.sign || !account) return null;
  const balance = balanceIn(account, props.currency);
  if (amount <= 0) return { tone: 'muted', text: `Баланс ${withSymbol(balance)}` };
  if (props.sign === 'minus' && balance < amount) {
    return { tone: 'warning', text: `Не хватает ${withSymbol(amount - balance)}` };
  }
  return props.sign === 'minus'
    ? { tone: 'muted', text: `Останется ${withSymbol(balance - amount)}` }
    : { tone: 'muted', text: `Станет ${withSymbol(balance + amount)}` };
}

const primaryNote = computed<Note | null>(() =>
  props.anchor === 'primary'
    ? { tone: 'muted', text: 'из уведомления банка' }
    : forecast(primaryAccount.value, parts.value.primaryAmount),
);
const secondNote = computed(() => forecast(secondAccount.value, parts.value.secondAmount));

// Пока счёт не выбран, подсказкой служит сама строка «Выберите счёт»; ошибки суммы —
// только после того, как пользователь что-то ввёл или ушёл из поля.
const visibleError = computed(() => {
  const part = props.modelValue;
  if (!part?.accountId || !touched.value) return null;
  return validateSecondPart({
    total: parts.value.total,
    primaryAccountId: props.primaryAccountId,
    secondPart: part,
  });
});

const noteClass = (note: Note) =>
  note.tone === 'warning'
    ? 'font-medium text-warning'
    : 'text-text-tertiary-light dark:text-text-tertiary-dark';
</script>

<template>
  <!-- Делить нечего, пока не выбран первый счёт -->
  <button
    v-if="!modelValue && primaryAccountId && candidates.length > 0"
    type="button"
    data-testid="add-second-part"
    aria-label="Добавить второй счёт"
    class="add-second -mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-text-tertiary-light hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-tertiary-dark dark:hover:text-primary-hover"
    @click="enable"
  >
    <UIcon name="add" size="xs" />
    второй счёт
  </button>

  <div v-else-if="modelValue" data-testid="payment-parts-editor" class="space-y-2">
    <PaymentSplitBar :segments="barSegments" />

    <div class="grid grid-cols-[minmax(0,1fr)_auto_2rem] items-center gap-x-1">
      <!-- Первая часть: доля считается сама -->
      <AccountPopover
        v-if="primaryPickable"
        :accounts="accounts"
        :selected-id="primaryAccountId"
        @select="emit('update:primaryAccountId', $event)"
      >
        <template #trigger>
          <button
            type="button"
            data-testid="primary-account-trigger"
            :aria-label="`Первый счёт: ${primaryAccount?.name ?? 'не выбран'}`"
            class="-ml-1 flex min-w-0 items-center gap-1.5 justify-self-start rounded-md px-1 py-1 text-sm text-text-secondary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-secondary-dark"
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full bg-text-tertiary-light dark:bg-text-tertiary-dark"
              :style="primaryAccount?.color ? { backgroundColor: primaryAccount.color } : undefined"
            />
            <span class="truncate">{{ primaryAccount?.name ?? 'Выберите счёт' }}</span>
            <UIcon name="expand_more" size="xs" class="shrink-0" />
          </button>
        </template>
      </AccountPopover>
      <div
        v-else
        class="flex min-w-0 items-center gap-1.5 py-1 text-sm text-text-secondary-light dark:text-text-secondary-dark"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full bg-text-tertiary-light dark:bg-text-tertiary-dark"
          :style="primaryAccount?.color ? { backgroundColor: primaryAccount.color } : undefined"
        />
        <span class="truncate">{{ primaryAccount?.name ?? 'Счёт не выбран' }}</span>
      </div>
      <span
        data-testid="primary-part-amount"
        class="justify-self-end px-1 text-sm font-medium tabular-nums"
        :class="
          parts.primaryAmount < 0
            ? 'text-danger'
            : 'text-text-primary-light dark:text-text-primary-dark'
        "
      >
        {{ formatPart(parts.primaryAmount) }}
      </span>
      <span aria-hidden="true" />
      <p
        v-if="primaryNote"
        data-testid="primary-part-note"
        class="col-span-3 -mt-1 pb-1 pl-3.5 text-xs"
        :class="noteClass(primaryNote)"
        :aria-live="primaryNote.tone === 'warning' ? 'polite' : 'off'"
      >
        {{ primaryNote.text }}
      </p>

      <!-- Вторая часть: свой счёт, своя сумма -->
      <AccountPopover
        :accounts="candidates"
        :selected-id="modelValue.accountId"
        @select="selectAccount"
      >
        <template #trigger>
          <button
            type="button"
            data-testid="second-account-trigger"
            :aria-label="secondAccount ? `Второй счёт: ${secondAccount.name}` : 'Выберите счёт'"
            class="-ml-1 flex min-w-0 items-center gap-1.5 justify-self-start rounded-md px-1 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              secondAccount
                ? 'text-text-secondary-light dark:text-text-secondary-dark'
                : 'font-medium text-primary dark:text-primary-hover'
            "
          >
            <span
              class="h-2 w-2 shrink-0 rounded-full"
              :class="!secondAccount && 'ring-1 ring-inset ring-current'"
              :style="secondAccount ? { backgroundColor: secondAccount.color } : undefined"
            />
            <span class="truncate">{{ secondAccount?.name ?? 'Выберите счёт' }}</span>
            <UIcon name="expand_more" size="xs" class="shrink-0" />
          </button>
        </template>
      </AccountPopover>

      <label
        class="second-amount relative flex h-8 min-w-[4.5rem] cursor-text items-center justify-end gap-0.5 px-1 shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--color-text-tertiary-light)_45%,transparent)] focus-within:shadow-[inset_0_-2px_0_var(--color-primary)] dark:shadow-[inset_0_-1px_0_color-mix(in_srgb,var(--color-text-tertiary-dark)_70%,transparent)]"
      >
        <input
          ref="inputRef"
          type="text"
          inputmode="decimal"
          :value="rawValue"
          aria-label="Сумма со второго счёта"
          data-testid="second-part-amount"
          class="absolute inset-0 h-full w-full cursor-text opacity-0 caret-transparent"
          @input="onInput"
          @blur="touched = true"
          @keydown.enter.prevent
        />
        <span
          class="pointer-events-none text-sm font-medium tabular-nums"
          :class="
            modelValue.amount
              ? 'text-text-primary-light dark:text-text-primary-dark'
              : 'text-text-tertiary-light dark:text-text-tertiary-dark'
          "
        >
          {{ displayAmount }}
        </span>
        <span
          class="pointer-events-none inline-block h-4 w-[1.5px] rounded-full"
          :class="isFocused ? 'animate-caret-blink' : 'opacity-0'"
          :style="{ backgroundColor: secondAccount?.color ?? 'var(--color-primary)' }"
        />
      </label>

      <button
        type="button"
        data-testid="remove-second-part"
        aria-label="Убрать второй счёт"
        class="flex h-8 w-8 items-center justify-center justify-self-end rounded-full text-text-tertiary-light hover:bg-surface-light hover:text-text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-tertiary-dark dark:hover:bg-surface-dark dark:hover:text-text-primary-dark"
        @click="remove"
      >
        <UIcon name="close" size="xs" />
      </button>
      <p
        v-if="secondNote"
        data-testid="second-part-note"
        class="col-span-3 -mt-1 pl-3.5 text-xs"
        :class="noteClass(secondNote)"
        :aria-live="secondNote.tone === 'warning' ? 'polite' : 'off'"
      >
        {{ secondNote.text }}
      </p>
    </div>

    <p v-if="visibleError" data-testid="second-part-error" role="alert" class="text-xs text-danger">
      {{ visibleError }}
    </p>
  </div>
</template>

<style scoped>
.add-second {
  transition: color 150ms ease;
}

@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
.animate-caret-blink {
  animation: caret-blink 1s step-end infinite;
}

@media (prefers-reduced-motion: reduce) {
  .add-second {
    transition: none;
  }
  .animate-caret-blink {
    animation: none;
  }
}
</style>
