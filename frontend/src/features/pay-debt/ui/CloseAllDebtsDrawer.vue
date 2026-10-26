<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { UOverlay } from '@/shared/ui/overlay';
import { Skeleton, UButton, UIcon } from '@/shared/ui';
import { AccountSelector, type AccountWithBalances } from '@/entities/account';
import {
  DebtPaymentFields,
  DebtProgressMeter,
  DebtAmountHeadline,
  hasMixedCurrencies,
  useDebtPaymentForm,
  useDebtCategoryOptions,
  getDebtSplit,
  type CloseAllPreview,
} from '@/entities/debt';
import { useHaptics } from '@/shared/lib/haptics';
import { getServerErrorMessage } from '@/shared/api/http';
import { formatCurrency, getCurrencySymbol } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { DEFAULT_CURRENCY } from '@/entities/currency';
import type { Debt } from '@/shared/api/database.types';
import { buildDistribution, type DistributionStatus } from '../model/closeAllDistribution';
import type { CloseAllInputOptions } from '../model/closeAllInput';
import { useCloseAllPreview } from '../model/useCloseAllPreview';
import PaymentPresetRow from './PaymentPresetRow.vue';

/**
 * Шторка «закрыть все долги человека», по раскладке как `PaymentDrawer`. Список долгов
 * и есть предпросмотр, все числа в нём считает сервер (`previewCloseAll`).
 */
const props = defineProps<{
  modelValue: boolean;
  /** Встречные долги — только в одной валюте: сначала они зачитываются, платёж закрывает остаток. */
  debts: Debt[];
  personName: string;
  accounts: AccountWithBalances[];
  isClosing?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  /** Без `paymentAmount` у «оплатить всё»: сумму тогда считает сервер, как и в предпросмотре. */
  confirm: [accountId: string, options: Omit<CloseAllInputOptions, 'transactionDate'>];
}>();

const { trigger } = useHaptics();

const selectedAccountId = ref<string | null>(null);

/** Ответ сервера на «оплатить всё»: итог, сторона и зачёт от суммы платежа не зависят. */
const baseline = ref<CloseAllPreview | null>(null);

/** Итог и сторона уже названы сервером: до этого разметка про них молчит. */
const isReady = computed(() => baseline.value !== null);

const isMixedCurrency = computed(() => hasMixedCurrencies(props.debts));
// Без зачёта все долги одной стороны, и первый её назовёт; до ответа сервера значение
// нигде не показывается (`isReady`).
const debtDirection = computed(
  () => baseline.value?.direction ?? props.debts[0]?.debt_type ?? 'given',
);
const offsetAmount = computed(() => baseline.value?.offset_amount ?? 0);

/** Сторона, которая переживёт зачёт: только по ней идут деньги и метр. */
const payingDebts = computed(() => props.debts.filter((d) => d.debt_type === debtDirection.value));

/** Итоги по валютам: у человека могут быть долги в разных валютах. Только для показа. */
const totalsByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const debt of payingDebts.value) {
    const currency = debt.currency || DEFAULT_CURRENCY;
    map.set(currency, (map.get(currency) || 0) + debt.remaining_amount);
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
});

/**
 * Остаток, который закрывает платёж. Разные валюты сервер в одну сумму не
 * складывает и отдаёт 0: выбор там — только «оплатить» или «простить», сумма
 * платежа остаётся нулевой.
 */
const totalDebt = computed(() => baseline.value?.net ?? 0);
/** Встречные долги равны — их закрывает один зачёт, деньги не двигаются. */
const isFullOffset = computed(() => offsetAmount.value > 0 && totalDebt.value === 0);

const debtCurrency = computed(() => props.debts[0]?.currency || DEFAULT_CURRENCY);
const currencySymbol = computed(() => getCurrencySymbol(debtCurrency.value));
const isPrivate = computed(() => props.debts.some((d) => d.is_private));

const { excessCategories } = useDebtCategoryOptions(debtDirection);

const {
  paymentAmount,
  forgiveRemainder,
  excessCategoryId,
  isOverpayment,
  excess,
  remainder,
  reset,
} = useDebtPaymentForm({
  remainingAmount: totalDebt,
  debtType: debtDirection,
  excessCategories,
});

/**
 * `immediate` обязателен: страница может отрендерить шторку сразу открытой, и
 * без первого прогона счёт остался бы невыбранным.
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (!isOpen) return;
    pickDefaultAccount();
  },
  { immediate: true },
);

function pickDefaultAccount() {
  const linkedAccountId = props.debts.find((d) => d.account_id)?.account_id;
  selectedAccountId.value = linkedAccountId || props.accounts[0]?.id || null;
}

// Счета могут приехать уже после открытия шторки: без счёта платёж не отправить.
watch(
  () => props.accounts,
  () => {
    if (props.modelValue && !selectedAccountId.value) pickDefaultAccount();
  },
);

/**
 * Итога нет (открытие заново, остатки поменялись): форма держала бы сумму и итог прошлого
 * раза и на миг показала бы «Сумма превышает долг», поэтому сумма — в ноль. Пришёл итог —
 * стартовая сумма весь остаток, как его посчитал сервер.
 */
watch(baseline, (value) => reset(value ? undefined : 0));

// --- Предпросмотр распределения: считает сервер ---

const {
  preview,
  error: previewError,
  paymentOptions,
  retry: retryPreview,
  canRetry: canRetryPreview,
  isSettled,
  isLoading: isPreviewLoading,
} = useCloseAllPreview({
  debts: () => props.debts,
  open: () => props.modelValue,
  amount: paymentAmount,
  forgiveRemainder,
  baseline,
});

/** Без стартового итога форме нечего показывать — остаётся только причина отказа. */
const isBlocked = computed(() => !!previewError.value && baseline.value === null);
const previewErrorText = computed(
  () => getServerErrorMessage(previewError.value) ?? 'Не удалось рассчитать закрытие долгов',
);

const listRows = computed(() =>
  preview.value
    ? buildDistribution(props.debts, preview.value).map(({ debt, covered, forgiven, status }) => ({
        debt,
        amount: covered + forgiven,
        status,
      }))
    : [],
);

/** Сумма, прощение и счёт нужны, пока деньги вообще двигаются: полный зачёт обходится без них. */
const showPaymentControls = computed(() => isReady.value && !isFullOffset.value);

const skeletonRowCount = computed(() => Math.min(props.debts.length, 5));

const STATUS_META = {
  offset: { label: 'Зачтётся', class: 'text-success' },
  closed: { label: 'Закроется', class: 'text-success' },
  forgiven: { label: 'Простится', class: 'text-warning' },
  paidAndForgiven: { label: 'Часть + прощение', class: 'text-warning' },
  partial: { label: 'Частично', class: 'text-primary' },
  open: { label: 'Не покрыт', class: 'text-text-tertiary-light dark:text-text-tertiary-dark' },
} as const;

/** Долг уходит из списка, если он оплачен целиком или остаток прощён. */
const CLOSING_STATUSES: DistributionStatus[] = ['offset', 'closed', 'forgiven', 'paidAndForgiven'];

const closingCount = computed(
  () => listRows.value.filter((row) => CLOSING_STATUSES.includes(row.status)).length,
);

/**
 * Метр по всем долгам разом: у одной валюты суммы складываются осмысленно,
 * при разных — нет, поэтому там его не показываем. Зачёт гасит эту сторону
 * так же, как платёж.
 */
const aggregate = computed(() => {
  let total = 0;
  let paid = offsetAmount.value;
  let forgiven = 0;
  for (const debt of payingDebts.value) {
    const split = getDebtSplit(debt);
    total += debt.total_amount;
    paid += split.paid;
    forgiven += split.forgiven;
  }
  return { total, paid, forgiven };
});

const paymentPart = computed(() => Math.min(paymentAmount.value, totalDebt.value));
const paidAfter = computed(() => aggregate.value.paid + paymentPart.value);
const forgivenAfter = computed(
  () =>
    aggregate.value.forgiven + (forgiveRemainder.value ? totalDebt.value - paymentPart.value : 0),
);

// --- Отправка ---

const isValid = computed(() => {
  if (!selectedAccountId.value || props.debts.length === 0) return false;
  // Отправлять можно только то, что сервер уже рассчитал для текущего ввода.
  if (!isSettled.value) return false;
  // Встречные долги, равные друг другу, закрываются одним зачётом, без платежа.
  if (paymentAmount.value <= 0 && !forgiveRemainder.value && totalDebt.value > 0) return false;
  if (isOverpayment.value && !excessCategoryId.value) return false;
  return true;
});

const confirmLabel = computed(() => {
  if (props.isClosing) return 'Закрываем…';
  if (isFullOffset.value) return 'Зачесть все долги';
  if (forgiveRemainder.value && paymentAmount.value === 0) return 'Простить все долги';
  if (isMixedCurrency.value || paymentAmount.value >= totalDebt.value) return 'Закрыть все долги';
  return `Внести ${formatCurrency(paymentAmount.value, debtCurrency.value, { showSymbol: false })}`;
});

function setOpen(value: boolean) {
  // Пока расчёт идёт, закрытие шторки оставило бы процесс без индикатора —
  // держим её открытой до конца.
  if (props.isClosing) return;
  emit('update:modelValue', value);
}

function confirm() {
  if (!isValid.value || !selectedAccountId.value || props.isClosing) return;
  trigger('selection');
  // Параметры платежа — те самые, по которым сервер рассчитал предпросмотр.
  emit('confirm', selectedAccountId.value, {
    ...paymentOptions.value,
    excessCategoryId: isOverpayment.value ? excessCategoryId.value : undefined,
  });
}
</script>

<template>
  <UOverlay
    :model-value="modelValue"
    title="Закрыть долги"
    desktop="panel"
    fill
    @update:model-value="setOpen"
  >
    <template #action>
      <UButton
        variant="primary"
        size="sm"
        data-testid="close-all-submit"
        :loading="isClosing"
        :disabled="!isValid || isClosing"
        @click="confirm"
      >
        {{ confirmLabel }}
      </UButton>
    </template>

    <div data-testid="close-all-drawer" class="space-y-5">
      <!-- Кто и сколько долгов -->
      <div class="flex items-center justify-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-caption font-medium"
          :class="
            !isReady
              ? 'bg-primary/10 text-primary'
              : debtDirection === 'given'
                ? 'bg-debt-given-light text-debt-given'
                : 'bg-debt-received-light text-debt-received'
          "
        >
          <UIcon name="person" size="xs" />
          {{ personName }}
        </span>
        <span
          v-if="isReady"
          class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ debtDirection === 'given' ? 'вам должны' : 'вы должны' }} · {{ debts.length }}
          {{ pluralize(debts.length, 'долг', 'долга', 'долгов') }}
        </span>
      </div>

      <div
        v-if="previewError"
        data-testid="close-all-preview-error"
        class="flex items-center justify-between gap-3 rounded-xl bg-danger/5 border border-danger/20 p-3 text-sm text-danger"
      >
        <p>{{ previewErrorText }}</p>
        <UButton
          v-if="canRetryPreview"
          variant="ghost"
          size="sm"
          data-testid="close-all-preview-retry"
          @click="retryPreview"
        >
          Повторить
        </UButton>
      </div>

      <template v-if="!isBlocked">
        <Skeleton
          v-if="isPreviewLoading"
          data-testid="close-all-amount-skeleton"
          class="mx-auto h-10 w-44 rounded-lg"
        />
        <template v-else-if="isReady">
          <!--
            Сумма-героем — та же раскладка, что в шторке одиночного платежа
            (`PaymentDrawer`), поэтому она вынесена в `entities/debt`. Полный зачёт
            денег не двигает: ни суммы, ни счёта у него нет.
          -->
          <DebtAmountHeadline
            v-if="showPaymentControls && !isMixedCurrency"
            v-model="paymentAmount"
            :currency-symbol="currencySymbol"
            :disabled="isClosing"
            input-testid="close-all-amount-input"
          />

          <!--
            Разные валюты: одной суммой их не набрать — выбор сводится к «оплатить» или
            «простить», а сумма платежа остаётся нулевой.
          -->
          <div v-else-if="isMixedCurrency" class="flex flex-col items-center gap-1">
            <p
              v-for="item in totalsByCurrency"
              :key="item.currency"
              class="text-2xl font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
            >
              {{ formatCurrency(item.amount, item.currency) }}
            </p>
          </div>

          <PaymentPresetRow
            v-if="showPaymentControls"
            v-model:amount="paymentAmount"
            v-model:forgive-remainder="forgiveRemainder"
            :total="totalDebt"
            :disabled="isClosing"
            :show-half="!isMixedCurrency"
            id-prefix="close-all-preset"
          />

          <!-- Живой предпросмотр по всем долгам сразу -->
          <DebtProgressMeter
            v-if="!isMixedCurrency"
            size="sm"
            :total="aggregate.total"
            :paid="paidAfter"
            :forgiven="forgivenAfter"
            :currency="debtCurrency"
            :hidden="isPrivate"
          />
        </template>

        <!--
        Список долгов и есть распределение: сумма слева — что достанется долгу,
        подпись справа — что с ним станет.
      -->
        <div class="space-y-2">
          <div class="flex items-baseline justify-between gap-2">
            <p
              class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
            >
              Куда пойдут деньги
            </p>
            <p
              v-if="preview"
              class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              закроется {{ closingCount }} из {{ debts.length }}
            </p>
          </div>
          <p
            v-if="offsetAmount > 0"
            data-testid="close-all-offset-note"
            class="text-caption text-text-secondary-light dark:text-text-secondary-dark"
          >
            Сначала зачёт: по {{ formatCurrency(offsetAmount, debtCurrency) }} с каждой стороны.
          </p>

          <ul class="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
            <li
              v-for="n in isPreviewLoading ? skeletonRowCount : 0"
              :key="`skeleton-${n}`"
              data-testid="close-all-skeleton-row"
              class="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-b-0"
            >
              <Skeleton class="h-4 w-32" />
              <span class="shrink-0 space-y-1.5">
                <Skeleton class="ml-auto h-4 w-20" />
                <Skeleton class="ml-auto h-3 w-14" />
              </span>
            </li>
            <li
              v-for="item in listRows"
              :key="item.debt.id"
              data-testid="close-all-debt-row"
              class="flex items-center justify-between gap-3 px-3 py-2.5 border-b border-border-light dark:border-border-dark last:border-b-0"
              :class="item.status === 'open' && 'opacity-55'"
            >
              <span
                class="min-w-0 flex-1 truncate text-body-sm text-text-primary-light dark:text-text-primary-dark"
              >
                {{ item.debt.name }}
              </span>
              <span class="shrink-0 text-right">
                <span
                  class="block text-body-sm font-semibold tabular-nums text-text-primary-light dark:text-text-primary-dark"
                >
                  {{ formatCurrency(item.amount, item.debt.currency || DEFAULT_CURRENCY) }}
                </span>
                <span class="block text-caption" :class="STATUS_META[item.status].class">
                  {{ STATUS_META[item.status].label }}
                </span>
              </span>
            </li>
          </ul>
        </div>

        <div v-if="showPaymentControls" class="space-y-2" :inert="isClosing || undefined">
          <AccountSelector
            :accounts="accounts"
            :selected-id="selectedAccountId"
            :label="debtDirection === 'given' ? 'Куда зачислить' : 'С какого счёта списать'"
            @select="selectedAccountId = $event"
          />
          <p v-if="!selectedAccountId" class="text-xs text-warning">
            Выберите счёт для проведения платежей
          </p>
        </div>

        <DebtPaymentFields
          v-if="showPaymentControls"
          v-model:amount="paymentAmount"
          v-model:forgive-remainder="forgiveRemainder"
          v-model:excess-category-id="excessCategoryId"
          :excess-categories="excessCategories"
          :is-overpayment="isOverpayment"
          :excess="excess"
          :remainder="remainder"
          :inert="isClosing || undefined"
          :remaining="totalDebt"
          :currency="debtCurrency"
          :direction="debtDirection"
        >
          <template #forgive-note>
            <template v-if="offsetAmount > 0">
              Остаток после зачёта —
              <span class="font-semibold">{{ formatCurrency(totalDebt, debtCurrency) }}</span>
              — будет прощён и списан как подарок.
            </template>
            <template v-else>
              Все долги
              <template v-if="isMixedCurrency">
                (
                <span v-for="(item, i) in totalsByCurrency" :key="item.currency">
                  <span class="font-semibold">
                    {{ formatCurrency(item.amount, item.currency) }}
                  </span>
                  <template v-if="i < totalsByCurrency.length - 1">+</template>
                </span>
                )
              </template>
              <template v-else>
                на сумму
                <span class="font-semibold">{{ formatCurrency(totalDebt, debtCurrency) }}</span>
              </template>
              будут прощены и списаны как подарок.
            </template>
          </template>
        </DebtPaymentFields>
      </template>
    </div>
  </UOverlay>
</template>
