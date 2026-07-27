<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { UButton } from '@/shared/ui';
import { CATEGORY_IDS } from '@/entities/category';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { TransactionFormData, TransactionType } from '../model/useTransactionForm';
import { useHashtags, useRecentTransactions } from '@/entities/transaction';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHashtagSuggestions } from '../model/useHashtagSuggestions';
import { FeatureHintPopover, useFeatureHints } from '@/features/feature-hints';
import { useSmartDefaults } from '../model/useSmartDefaults';
import { useAmountSuggestions } from '../model/useAmountSuggestions';
import { usePanelState } from '../model/usePanelState';
import { useHaptics } from '@/shared/lib/haptics';
import AmountSlab from './AmountSlab.vue';
import ExpensePanel from './ExpensePanel.vue';
import IncomePanel from './IncomePanel.vue';
import TransferPanel from './TransferPanel.vue';
import DebtPanel from './DebtPanel.vue';
import TransactionMetaRow from './TransactionMetaRow.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  userCurrency?: string;
  defaultAccountId?: string | null;
  isSubmitting?: boolean;
  isValid?: boolean;
  error?: string | null;
  splitData?: SplitExpenseData;
  splitValidationError?: string | null;
  autofocusAmount?: boolean;
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
  submit: [];
  back: [];
  'debt-submitted': [];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();

function applyTypeChange(newType: TransactionType) {
  emit('update:formData', {
    ...props.formData,
    type: newType,
    categoryId: newType === 'transfer' ? CATEGORY_IDS.TRANSFER : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}

// Плите нужны символ валюты и баланс выбранного счёта — то же состояние,
// которым живут панели.
const {
  availableCurrencies,
  isMultiCurrency,
  currencySymbol,
  currentBalance,
  hasSufficientFunds,
  updateField,
} = usePanelState(props, (_e, value) => emit('update:formData', value));

/**
 * Направление движения денег по счёту на плите. Перевод тоже списывает —
 * поэтому на нём видно остаток и долю, а не просто текущий баланс. У долга
 * счёт выбирается внутри панели, там показывать нечего.
 */
const amountSign = computed<'minus' | 'plus' | null>(() => {
  if (props.formData.type === 'income') return 'plus';
  if (props.formData.type === 'debt') return null;
  return 'minus';
});

/** Списание сверх остатка — предупреждаем и на расходе, и на переводе. */
const showInsufficientFunds = computed(
  () => amountSign.value === 'minus' && !hasSufficientFunds.value,
);

/** На долге счёт выбирается внутри панели, поэтому баланса на плите ещё нет. */
const slabBalance = computed(() =>
  props.formData.type === 'debt' || !props.formData.accountId ? undefined : currentBalance.value,
);

const submitLabel = computed(() => {
  if (props.formData.type === 'transfer') return 'Перевести';
  if (props.formData.type === 'income') return 'Добавить доход';
  return 'Добавить расход';
});

/**
 * Заблокированная кнопка без объяснения — тупик: пользователь тапает и не
 * понимает, чего не хватает. Называем недостающее прямо над ней.
 */
const submitHint = computed(() => {
  if (props.isValid || props.isSubmitting) return null;

  const missing: string[] = [];
  if (!props.formData.accountId) missing.push('счёт');
  if (props.formData.amount <= 0) missing.push('сумму');

  if (props.formData.type === 'transfer') {
    if (!props.formData.toAccountId) missing.push('счёт зачисления');
    // Сумму зачисления просим отдельно, только когда есть из чего её считать:
    // иначе выходило «Укажите сумму и сумму зачисления».
    else if (props.formData.amount > 0 && !props.formData.toAmount) {
      missing.push('сумму зачисления');
    }
  } else if (!props.formData.categoryId) {
    missing.push('категорию');
  }

  // Перевод «сам в себя» в той же валюте невалиден, но ничего не «не хватает» —
  // без отдельной ветки кнопка снова гасла бы молча.
  if (
    !missing.length &&
    props.formData.type === 'transfer' &&
    props.formData.toAccountId === props.formData.accountId &&
    props.formData.currency === props.formData.toCurrency
  ) {
    return 'Выберите другой счёт или валюту зачисления';
  }

  if (!missing.length) return null;
  // «счёт и сумму и категорию» — перечисление через «и» читается только на двух
  // элементах; на трёх нужен обычный список.
  const last = missing[missing.length - 1];
  const head = missing.slice(0, -1);
  return `Укажите ${head.length ? `${head.join(', ')} и ${last}` : last}`;
});

const descriptionPlaceholder = computed(() => {
  if (props.formData.type === 'income') return '#зарплата, #фриланс...';
  if (props.formData.type === 'transfer') return '#накопления, #перевод...';
  return '#продукты, #кафе, #такси...';
});

// Hashtag suggestions
const { userId } = useCurrentUser();
const { hashtags } = useHashtags(userId);

const { filtered: filteredHashtags, buildInsertedDescription } = useHashtagSuggestions(
  () => props.formData.description || '',
  hashtags,
);

function insertHashtag(tag: string) {
  emit('update:formData', {
    ...props.formData,
    description: buildInsertedDescription(tag),
  });
}

// Haptic feedback
const { trigger } = useHaptics();

// Feature hints — split expense hint
const { shouldShowHint, dismissHint, markHintShown, getHintConfig } = useFeatureHints();
const showSplitHint = ref(false);
const splitHintConfig = getHintConfig('split-expense');

// Smart defaults (not applicable to debt flow — debt has its own form state)
// Окно 50: питает и smart defaults (сам берёт до 20 нужного типа), и частотный
// топ категорий в CategoryPicker — на 20 смешанных транзакциях топ был слишком шумным
const { transactions } = useRecentTransactions(userId, 50);
const { defaults } = useSmartDefaults(
  transactions,
  () => (props.formData.type === 'debt' ? 'expense' : props.formData.type),
  () => props.formData.accountId,
);

// Частые суммы показывает плита — она же владеет вводом суммы.
// Для перевода и долга композабл сам возвращает пустой список.
const { suggestions } = useAmountSuggestions(
  transactions,
  () => props.formData.type,
  () => props.formData.currency,
  () => props.formData.categoryId,
);

const { start: showSplitHintDelayed, stop: stopSplitHint } = useTimeoutFn(
  () => {
    showSplitHint.value = true;
    markHintShown();
  },
  500,
  { immediate: false },
);

// Apply smart defaults once per type when data becomes available
const smartDefaultsAppliedForType = ref<string | null>(null);

watch(
  defaults,
  (val) => {
    if (props.formData.type === 'debt') return;
    if (smartDefaultsAppliedForType.value === props.formData.type) return;
    if (!val.defaultCategoryId && !val.defaultAccountId) return;

    if (!props.formData.categoryId && val.defaultCategoryId) {
      const updates: Partial<TransactionFormData> = {
        categoryId: val.defaultCategoryId,
      };
      if (!props.formData.accountId && val.defaultAccountId) {
        updates.accountId = val.defaultAccountId;
      }
      smartDefaultsAppliedForType.value = props.formData.type;
      emit('update:formData', { ...props.formData, ...updates });
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (shouldShowHint('split-expense')) {
    showSplitHintDelayed();
  }
});

onUnmounted(() => stopSplitHint());

function dismissSplitHint() {
  showSplitHint.value = false;
  dismissHint('split-expense');
}

function handleSplitHintAction() {
  showSplitHint.value = false;
  dismissHint('split-expense');
  emit('setSplitEnabled', true);
}

// Haptic feedback on validation error
watch(
  () => props.error,
  (newError) => {
    if (newError) trigger('error');
  },
);

// Панель расхода рендерится в двух местах — внутри поповера-подсказки и без
// него. Общие пропы и обработчики вынесены, чтобы не дублировать два десятка
// строк привязок.
const expensePanelProps = computed(() => ({
  formData: props.formData,
  accounts: props.accounts,
  categories: props.expenseCategories,
  transactions: transactions.value,
  splitData: props.splitData,
  splitValidationError: props.splitValidationError,
}));

const expensePanelHandlers = {
  'update:formData': (value: TransactionFormData) => emit('update:formData', value),
  addParticipant: (name: string, fromContacts: boolean, color?: string) =>
    emit('addParticipant', name, fromContacts, color),
  removeParticipant: (id: string) => emit('removeParticipant', id),
  updateParticipantAmount: (id: string, amount: number) =>
    emit('updateParticipantAmount', id, amount),
  setSplitMethod: (method: SplitMethod) => emit('setSplitMethod', method),
  setMyShare: (amount: number) => emit('setMyShare', amount),
  setIsIncluded: (included: boolean) => emit('setIsIncluded', included),
  setSplitEnabled: (enabled: boolean) => emit('setSplitEnabled', enabled),
};
</script>

<template>
  <form
    class="form-root flex flex-1 flex-col transition-opacity duration-200"
    :class="isSubmitting && 'pointer-events-none opacity-60'"
    @submit.prevent="emit('submit')"
  >
    <AmountSlab
      :amount="formData.amount"
      :currency="formData.currency"
      :currency-symbol="currencySymbol"
      :available-currencies="availableCurrencies"
      :is-multi-currency="isMultiCurrency"
      :type="formData.type"
      :sign="amountSign"
      :current-balance="slabBalance"
      :show-insufficient-funds="showInsufficientFunds"
      :suggestions="suggestions"
      :autofocus="autofocusAmount"
      @update:amount="updateField('amount', $event)"
      @update:currency="updateField('currency', $event)"
      @update:type="applyTypeChange"
      @back="emit('back')"
    />

    <!-- Карточка наезжает на плиту: перекрытие даёт глубину, ради которой
         плита и появилась. -->
    <div
      class="content-card relative -mt-5 flex flex-1 flex-col gap-3 rounded-t-3xl bg-card-light px-4 pt-5 dark:bg-card-dark"
    >
      <FeatureHintPopover
        v-if="formData.type === 'expense' && splitHintConfig"
        :config="splitHintConfig"
        :open="showSplitHint"
        side="top"
        @dismiss="dismissSplitHint"
        @action="handleSplitHintAction"
      >
        <ExpensePanel v-bind="expensePanelProps" v-on="expensePanelHandlers" />
      </FeatureHintPopover>

      <IncomePanel
        v-else-if="formData.type === 'income'"
        :form-data="formData"
        :accounts="accounts"
        :categories="incomeCategories"
        :transactions="transactions"
        @update:form-data="emit('update:formData', $event)"
      />

      <TransferPanel
        v-else-if="formData.type === 'transfer'"
        :form-data="formData"
        :accounts="accounts"
        :user-currency="userCurrency"
        @update:form-data="emit('update:formData', $event)"
      />

      <!--
        Долг кэшируется: его поля (человек, даты, комиссия, переключатели) живут
        в собственной модели `useDebtForm`, а не в общей `formData`. Без
        `KeepAlive` случайный тап по соседнему сегменту и возврат стирали бы всё
        заполненное — до редизайна панели были смонтированы постоянно.
      -->
      <KeepAlive>
        <DebtPanel
          v-if="formData.type === 'debt'"
          :amount="formData.amount"
          :currency="formData.currency"
          :account-id="formData.accountId"
          :accounts="accounts"
          :default-account-id="defaultAccountId"
          @submitted="emit('debt-submitted')"
          @update:currency="updateField('currency', $event)"
          @update:account-id="updateField('accountId', $event)"
        />
      </KeepAlive>

      <!-- Комментарий и дата: два чипа вместо двух полей с подписями. Поле
           раскрывается на месте, поэтому подсказки хэштегов не двигают
           кнопку сабмита. -->
      <TransactionMetaRow
        v-if="formData.type !== 'debt'"
        :description="formData.description"
        :date="formData.date"
        :placeholder="descriptionPlaceholder"
        :hashtags="filteredHashtags"
        @update:description="updateField('description', $event)"
        @update:date="updateField('date', $event)"
        @insert-hashtag="insertHashtag"
      />

      <!-- Кнопка прилипает к низу: на «Переводе» форма выше экрана, и раньше до
           сабмита приходилось доскроллить. -->
      <div
        v-if="formData.type !== 'debt'"
        class="submit-bar sticky bottom-0 mt-auto -mx-4 px-4 pt-3 [--bar-bg:var(--color-card-light)] dark:[--bar-bg:var(--color-card-dark)]"
      >
        <p
          v-if="error"
          data-testid="validation-error"
          role="alert"
          class="pb-2 text-xs text-danger"
        >
          {{ error }}
        </p>
        <p
          v-else-if="submitHint"
          class="pb-2 text-center text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          {{ submitHint }}
        </p>

        <UButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
          data-testid="submit-btn"
          :loading="isSubmitting"
          :disabled="!isValid"
        >
          {{ submitLabel }}
        </UButton>
      </div>
    </div>
  </form>
</template>

<style scoped>
/*
 * Тень направлена вверх, в тон акценту: она и рисует стык карточки с плитой.
 * `color-mix` вместо сырого rgba — primary настраивается пользователем.
 */
.content-card {
  box-shadow: 0 -8px 24px -12px color-mix(in srgb, var(--color-primary) 35%, transparent);
}

/*
 * Подложка кнопки повторяет карточку. Цвет приходит переменной `--bar-bg`: её
 * ставит Tailwind-вариант `dark:` прямо на элементе — через `:global(html.dark)`
 * не выйдет, тема здесь навешивается классом на `html`, а не на конкретный узел.
 * Верх полупрозрачный, чтобы содержимое уезжало под панель, а не обрывалось.
 */
.submit-bar {
  background: linear-gradient(to bottom, transparent 0, var(--bar-bg) 0.75rem, var(--bar-bg));
  padding-bottom: max(var(--safe-area-inset-bottom), 0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .form-root {
    transition: none;
  }
}
</style>
