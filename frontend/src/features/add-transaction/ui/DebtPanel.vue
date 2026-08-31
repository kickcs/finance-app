<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon, ToggleRow } from '@/shared/ui';
import { getCurrencyByCode } from '@/entities/currency';
import { sanitizeCurrencyInput, formatCurrency } from '@/shared/lib/format/currency';
import { formatCompactDate } from '@/shared/lib/format/date';
import { PersonPicker, usePeople } from '@/entities/person';
import { useDebts, DueDateField, DebtDirectionPill } from '@/entities/debt';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import { DatePickerField } from '@/shared/ui/date-picker';
import SubmitBar from './SubmitBar.vue';

const props = defineProps<{
  /** Сумма, валюта и счёт живут в общей форме — панель только следует за ними. */
  amount: number;
  currency: string;
  accountId: string | null;
  accounts: AccountWithBalances[];
  defaultAccountId?: string | null;
  /** Десктопная модалка: подвал без safe-area и без компенсации `-mx-4`. */
  flush?: boolean;
}>();

const emit = defineEmits<{
  submitted: [];
  /**
   * Счёт долга поднимается в общую форму, чтобы карточка суммы знала, из каких
   * валют этого счёта выбирать. Валюту отдельным событием не шлём: наверху счёт
   * и валюта пишутся одним `update:formData`, а два emit'а подряд в одном тике
   * читали бы один и тот же несвежий `props.formData` — второй затирал бы счёт,
   * записанный первым.
   */
  'update:accountId': [value: string];
  /**
   * Как долг двинет баланс: направление плюс то, что уходит сверх суммы.
   * Карточка суммы рисует по этому прогноз остатка — так же, как на расходе.
   */
  'balance-effect': [value: { sign: 'minus' | 'plus' | null; extraDebit: number }];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
// Долги — сигнал частоты для порядка людей. Запрос уже прогрет дашбордом,
// поэтому здесь это чтение кэша, а не поход в сеть.
const { debts } = useDebts(userId, { status: 'active' });
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

// Карточка суммы — единственный редактор суммы и валюты долга; своя модель
// подтягивается за ней, а обратный ход идёт через `update:currency` при смене
// счёта.
watch(
  () => props.amount,
  (amount) => updateField('amount', amount),
  { immediate: true },
);
watch(
  () => props.currency,
  (currency) => updateField('currency', currency),
  { immediate: true },
);

/**
 * Счёт берём тот, что уже выбран в форме, а не профильный дефолт: панель
 * монтируется при заходе на вкладку, и подстановка «своего» счёта молча
 * перебивала бы счёт и валюту начатой транзакции другого типа.
 */
watch(
  [() => props.accounts, () => props.accountId],
  ([accs, accountId]) => {
    if (accs.length === 0) return;
    const preferred =
      (accountId && accs.find((a) => a.id === accountId)) ||
      (props.defaultAccountId && accs.find((a) => a.id === props.defaultAccountId)) ||
      accs[0];
    if (formData.value.account_id === preferred.id) return;

    updateField('account_id', preferred.id);
    // Наверх сообщаем, только если счёт пришёл не оттуда — иначе это эхо.
    // Валюту подберёт сама форма: она пишет счёт и валюту одним обновлением.
    if (preferred.id !== accountId) emit('update:accountId', preferred.id);
  },
  { immediate: true },
);

/**
 * Эффект считаем `computed`: он пересчитывается только на смену направления,
 * комиссии и флага транзакции, поэтому наблюдатель не шлёт событие наверх на
 * каждое нажатие цифры в сумме.
 */
const balanceEffect = computed(() => ({
  sign: formData.value.skip_transaction
    ? null
    : formData.value.debt_type === 'given'
      ? ('minus' as const)
      : ('plus' as const),
  extraDebit: formData.value.skip_transaction ? 0 : formData.value.fee,
}));

watch(balanceEffect, (effect) => emit('balance-effect', effect), { immediate: true });

const isDebtDateOpen = ref(false);
const showMore = ref(false);

/** Сколько необязательных полей заполнено — подпись «Ещё» иначе выглядит пустой. */
const extrasCount = computed(
  () =>
    Number(Boolean(formData.value.due_date)) +
    Number(Boolean(formData.value.description.trim())) +
    Number(formData.value.is_private) +
    Number(formData.value.skip_transaction) +
    Number(formData.value.fee > 0),
);

// Комиссию платит отправитель, поэтому она есть только при выдаче долга.
// Без транзакции списывать нечего — поле тоже прячем.
const showFeeInput = computed(
  () => formData.value.debt_type === 'given' && !formData.value.skip_transaction,
);

const rawFeeValue = ref('');
const isFeeInputFocused = ref(false);
const totalDebited = computed(() => formData.value.amount + formData.value.fee);

function handleFeeInput(raw: string) {
  const sanitized = sanitizeCurrencyInput(raw);
  rawFeeValue.value = sanitized;
  const num = parseFloat(sanitized);
  updateField('fee', Number.isNaN(num) ? 0 : num);
}

function handleFeeBlur() {
  isFeeInputFocused.value = false;
  if (formData.value.fee === 0) rawFeeValue.value = '';
}

// Модель сама обнуляет комиссию при смене направления или отключении
// транзакции — сырое значение инпута должно поехать следом. Пока поле в фокусе
// не трогаем: иначе промежуточные «0» и «0.» стирались бы прямо во время ввода.
watch(
  () => formData.value.fee,
  (fee) => {
    if (isFeeInputFocused.value) return;
    if (fee === 0 && rawFeeValue.value !== '') rawFeeValue.value = '';
  },
);

async function handleSubmit() {
  if (!userId.value) return;
  const debtId = await createDebt(userId.value);
  if (debtId) {
    trigger('success');
    emit('submitted');
  }
}

const personLabel = computed(() =>
  formData.value.debt_type === 'given' ? 'Кому дали в долг' : 'У кого взяли в долг',
);

/**
 * Подпись замыкающего чипа считаем тем же форматтером, что рисует само поле:
 * раскладка рядов меряет ширину по этой строке, и разойдись они — последний ряд
 * сошёлся бы не по той ширине.
 */
const debtDateLabel = computed(() =>
  formData.value.debt_date ? formatCompactDate(formData.value.debt_date) : 'Дата',
);
const skipToggleTitle = computed(() =>
  formData.value.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс',
);

/**
 * Заблокированная кнопка без объяснения — тупик: пользователь тапает и не
 * понимает, чего не хватает. Называем недостающее прямо над ней, как на
 * остальных вкладках.
 */
const submitHint = computed(() => {
  if (isValid.value || isSubmitting.value) return null;

  const missing: string[] = [];
  if (!formData.value.person_name.trim()) missing.push('имя');
  if (formData.value.amount <= 0) missing.push('сумму');
  if (!formData.value.account_id) missing.push('счёт');

  if (!missing.length) return null;
  // «имя и сумму и счёт» — перечисление через «и» читается только на двух
  // элементах; на трёх нужен обычный список.
  const last = missing[missing.length - 1];
  const head = missing.slice(0, -1);
  return `Укажите ${head.length ? `${head.join(', ')} и ${last}` : last}`;
});

/**
 * Печатаем сумму тем же символом, что и главная сумма выше: `Intl` для UZS
 * отдаёт код «UZS», и под «98 000 сўм» появлялось «98 000 UZS» — две записи
 * одной валюты на одном экране.
 */
function withSymbol(value: number) {
  const symbol = getCurrencyByCode(formData.value.currency)?.symbol ?? formData.value.currency;
  return `${formatCurrency(value, formData.value.currency, { showSymbol: false })} ${symbol}`;
}
</script>

<template>
  <div class="flex flex-1 flex-col gap-3 pb-4 md:pb-8">
    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <!--
      Дата замыкает тот же ряд чипов, что и люди: своей строкой она занимала
      целый ярус ради одной кнопки, а в общей раскладке добирает последний ряд,
      который всё равно не сходился по ширине.
    -->
    <PersonPicker
      :people="people"
      :debts="debts"
      :selected="formData.person_name"
      :label="personLabel"
      :trailing-label="debtDateLabel"
      @select="updateField('person_name', $event)"
      @create="(name: string) => createPerson({ name })"
    >
      <template #trailing>
        <DatePickerField
          v-model:open="isDebtDateOpen"
          class="w-full"
          variant="chip"
          aria-label="Дата долга"
          :model-value="formData.debt_date"
          @update:model-value="updateField('debt_date', $event)"
        />
      </template>
    </PersonPicker>

    <!--
      Срок, комиссия, комментарий и два переключателя заполняют единицы — на
      виду они растягивали панель на два экрана. Волосяная линия сверху нужна,
      чтобы строка вообще читалась как элемент управления: без неё её не
      замечали. Счётчик показывает, что под «Ещё» уже что-то задано.
    -->
    <div class="border-t border-border-light pt-1 dark:border-border-dark">
      <button
        type="button"
        data-testid="debt-more-toggle"
        :aria-expanded="showMore"
        class="flex w-full items-center justify-between rounded-xl px-1 py-2 text-sm text-text-secondary-light transition-colors hover:text-text-primary-light dark:text-text-secondary-dark dark:hover:text-text-primary-dark"
        @click="showMore = !showMore"
      >
        <span>
          Ещё
          <span v-if="extrasCount" class="text-primary">· {{ extrasCount }}</span>
        </span>
        <UIcon
          name="expand_more"
          size="sm"
          class="more-chevron transition-transform duration-200"
          :class="showMore && 'rotate-180'"
        />
      </button>
    </div>

    <div v-if="showMore" class="space-y-3">
      <!-- Комиссия живёт здесь: её подпись была длиннее самого поля, а зависит
           она от `skip_transaction`, который тоже под «Ещё». -->
      <div v-if="showFeeInput" class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Комиссия за перевод
        </label>
        <div
          class="flex items-center gap-2 rounded-xl border border-border-light px-3 py-2.5 dark:border-border-dark"
        >
          <UIcon
            name="receipt_long"
            size="sm"
            class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <input
            type="text"
            inputmode="decimal"
            :value="rawFeeValue"
            placeholder="0"
            aria-label="Комиссия за перевод"
            data-testid="debt-fee-input"
            class="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-text-primary-light outline-none dark:text-text-primary-dark"
            @input="handleFeeInput(($event.target as HTMLInputElement).value)"
            @focus="isFeeInputFocused = true"
            @blur="handleFeeBlur"
          />
          <span class="shrink-0 text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
            {{ formData.currency }}
          </span>
        </div>
        <p
          v-if="formData.fee > 0"
          class="px-1 text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          Со счёта спишется {{ withSymbol(totalDebited) }} — долг
          {{ withSymbol(formData.amount) }} + комиссия {{ withSymbol(formData.fee) }}
        </p>
      </div>

      <DueDateField
        :model-value="formData.due_date"
        @update:model-value="updateField('due_date', $event)"
      />

      <UInput
        :model-value="formData.description"
        label="Комментарий (необязательно)"
        placeholder="Добавьте описание..."
        @update:model-value="updateField('description', $event as string)"
      />

      <ToggleRow
        :model-value="formData.is_private"
        title="Скрыть сумму"
        description="Сумма не будет видна в общем списке"
        @update:model-value="updateField('is_private', $event)"
      />

      <ToggleRow
        :model-value="formData.skip_transaction"
        :title="skipToggleTitle"
        description="Транзакция не будет создана"
        @update:model-value="updateField('skip_transaction', $event)"
      />
    </div>

    <!-- Кнопка прилипает к низу: без этого раскрытое «Ещё» плюс поднявшаяся
         под комментарием клавиатура уносили её за экран. -->
    <SubmitBar :flush="flush">
      <template #hint>
        <p v-if="error" role="alert" class="pb-2 text-xs text-danger">{{ error }}</p>
        <p
          v-else-if="submitHint"
          data-testid="debt-submit-hint"
          class="pb-2 text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ submitHint }}
        </p>
      </template>

      <UButton
        type="button"
        variant="primary"
        size="lg"
        full-width
        data-testid="debt-submit"
        :loading="isSubmitting"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        Создать долг
      </UButton>
    </SubmitBar>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .more-chevron {
    transition: none;
  }
}
</style>
