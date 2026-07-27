<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UInput, UButton, UIcon, ToggleRow } from '@/shared/ui';
import { DEFAULT_CURRENCY, getCurrencyByCode } from '@/entities/currency';
import { sanitizeCurrencyInput, formatCurrency } from '@/shared/lib/format/currency';
import { PersonSelector, usePeople } from '@/entities/person';
import { AccountPopover } from '@/entities/account';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';
import type { AccountWithBalances } from '@/entities/account';
import { useDebtForm } from '../model/useDebtForm';
import DebtDirectionPill from './DebtDirectionPill.vue';
import DatePickerField from './DatePickerField.vue';

const props = defineProps<{
  /** Сумма, валюта и счёт живут в общей форме — панель только следует за ними. */
  amount: number;
  currency: string;
  accountId: string | null;
  accounts: AccountWithBalances[];
  defaultAccountId?: string | null;
}>();

const emit = defineEmits<{
  submitted: [];
  'update:currency': [value: string];
  /**
   * Счёт долга поднимается в общую форму, чтобы плита знала, из каких валют
   * этого счёта выбирать. Без этого долг на мультивалютном счёте молча
   * залипал на первой валюте.
   */
  'update:accountId': [value: string];
}>();

const { userId } = useCurrentUser();
const { people, createPerson } = usePeople(userId);
const { trigger } = useHaptics();
const { formData, isValid, isSubmitting, error, createDebt, updateField } = useDebtForm();

// Плита — единственный редактор суммы и валюты долга; своя модель подтягивается
// за ней, а обратный ход идёт через `update:currency` при смене счёта.
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
    if (preferred.id !== accountId) {
      emit('update:accountId', preferred.id);
      emit('update:currency', preferred.balances[0]?.currency || DEFAULT_CURRENCY);
    }
  },
  { immediate: true },
);

function handleAccountChange(accountId: string) {
  trigger('selection');
  const account = props.accounts.find((a) => a.id === accountId);
  const currencies = account?.balances.map((b) => b.currency) || [];
  updateField('account_id', accountId);
  emit('update:accountId', accountId);
  if (!currencies.includes(props.currency)) {
    emit('update:currency', currencies[0] || DEFAULT_CURRENCY);
  }
}

const isDebtDateOpen = ref(false);
const isDueDateOpen = ref(false);
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
const skipToggleTitle = computed(() =>
  formData.value.debt_type === 'given' ? 'Не списывать с баланса' : 'Не добавлять на баланс',
);

const selectedAccount = computed(() =>
  props.accounts.find((a) => a.id === formData.value.account_id),
);

/**
 * Печатаем сумму тем же символом, что и главная сумма выше: `Intl` для UZS
 * отдаёт код «UZS», и под «98 000 сўм» появлялось «Спишется 98 000 UZS» — две
 * записи одной валюты на одном экране.
 */
function withSymbol(value: number) {
  const symbol = getCurrencyByCode(formData.value.currency)?.symbol ?? formData.value.currency;
  return `${formatCurrency(value, formData.value.currency, { showSymbol: false })} ${symbol}`;
}

/**
 * Итог одной строкой. Блок с иконкой, заливкой и `p-4` занимал два яруса ради
 * факта, который читается фразой; на экране, который целиком не влезал, это
 * была самая дорогая строка из всех.
 */
const summaryText = computed(() => {
  if (formData.value.skip_transaction || !formData.value.account_id) return null;
  if (formData.value.amount <= 0) return null;

  const isGiven = formData.value.debt_type === 'given';
  // При выдаче со счёта уходит долг вместе с комиссией — показываем итог.
  const amount = isGiven ? totalDebited.value : formData.value.amount;
  const verb = isGiven ? 'Спишется' : 'Добавится';
  const preposition = isGiven ? 'с' : 'на';
  return `${verb} ${withSymbol(amount)} ${preposition} «${selectedAccount.value?.name ?? ''}»`;
});
</script>

<template>
  <div class="space-y-3 pb-4 md:pb-8">
    <DebtDirectionPill
      :model-value="formData.debt_type"
      @update:model-value="updateField('debt_type', $event)"
    />

    <!--
      Три поля срослись в один список. Раньше у каждого была своя подпись
      сверху, своя рамка и свой зазор — восемь ярусов там, где хватает четырёх;
      подписи уехали внутрь строк иконкой и плейсхолдером.
    -->
    <div
      data-testid="debt-fields"
      class="divide-y divide-border-light overflow-hidden rounded-xl border border-border-light dark:divide-border-dark dark:border-border-dark"
    >
      <!-- `self-start`: список подсказок PersonSelector лежит в потоке, под
           полем. С `items-center` иконка уезжала бы в середину выросшей строки —
           к списку, а не к полю, — как только поле получает фокус. Отступ равен
           половине высоты строки поля (py-3 + text-sm). -->
      <div data-testid="debt-row-person" class="flex items-start gap-2 px-3">
        <UIcon
          name="group"
          size="sm"
          class="mt-3.5 shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <PersonSelector
          class="min-w-0 flex-1"
          variant="flush"
          :model-value="formData.person_name"
          :people="people"
          :placeholder="personLabel"
          @update:model-value="updateField('person_name', $event)"
          @select="updateField('person_name', $event)"
          @save-person="(name) => createPerson({ name })"
        />
      </div>

      <AccountPopover
        :accounts="accounts"
        :selected-id="formData.account_id"
        @select="handleAccountChange"
      >
        <template #trigger>
          <button
            data-testid="debt-row-account"
            type="button"
            aria-label="Выбрать счёт"
            class="flex w-full items-center gap-2 px-3 py-3 text-left"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: selectedAccount?.color }"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm text-text-primary-light dark:text-text-primary-dark"
            >
              {{ selectedAccount?.name ?? 'Выберите счёт' }}
            </span>
            <UIcon
              name="expand_more"
              size="sm"
              class="shrink-0 text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </button>
        </template>
      </AccountPopover>

      <div data-testid="debt-row-date">
        <DatePickerField
          v-model:open="isDebtDateOpen"
          flush
          :model-value="formData.debt_date"
          @update:model-value="updateField('debt_date', $event)"
        />
      </div>
    </div>

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

      <div class="space-y-1.5">
        <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
          Срок возврата
        </label>
        <DatePickerField
          v-model:open="isDueDateOpen"
          :model-value="formData.due_date"
          placeholder="Без срока"
          clearable
          @update:model-value="updateField('due_date', $event)"
        />
      </div>

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

    <p
      v-if="summaryText"
      data-testid="debt-summary"
      class="px-1 text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      {{ summaryText }}
    </p>

    <p v-if="error" class="text-xs text-danger">{{ error }}</p>

    <UButton
      type="button"
      variant="primary"
      size="lg"
      full-width
      :loading="isSubmitting"
      :disabled="!isValid"
      @click="handleSubmit"
    >
      Создать долг
    </UButton>
  </div>
</template>

<style scoped>
@media (prefers-reduced-motion: reduce) {
  .more-chevron {
    transition: none;
  }
}
</style>
