<script setup lang="ts">
import { computed, ref, onUnmounted, onMounted, nextTick, watch } from 'vue';
import { useTimeoutFn } from '@vueuse/core';
import { useMountedAnimation } from '@/shared/lib/hooks/useMountedAnimation';
import { UButton, UTabs } from '@/shared/ui';
import { CATEGORY_IDS } from '@/entities/category';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { TransactionFormData } from '../model/useTransactionForm';
import {
  useScrollableTabs,
  TRANSACTION_TYPE_ORDER,
  type TransactionType,
} from '../model/useScrollableTabs';
import { useHashtags, useRecentTransactions } from '@/entities/transaction';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHashtagSuggestions } from '../model/useHashtagSuggestions';
import { FeatureHintPopover, useFeatureHints } from '@/features/feature-hints';
import { useSmartDefaults } from '../model/useSmartDefaults';
import { useHaptics } from '@/shared/lib/haptics';
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
  'debt-submitted': [];
  addParticipant: [name: string, fromContacts: boolean, personColor?: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();

const ALL_TAB_ITEMS = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
  { id: 'debt', label: 'Долг' },
];

/** Индекс реальной панели «Расход» в цикличном порядке `[клон, ...реальные, клон]`. */
const EXPENSE_INDEX = 1;

const type = computed(() => props.formData.type);

function applyTypeChange(newType: string) {
  emit('update:formData', {
    ...props.formData,
    type: newType as TransactionType,
    categoryId: newType === 'transfer' ? CATEGORY_IDS.TRANSFER : '',
    toAccountId: null,
    toAmount: null,
    toCurrency: null,
  });
}

const {
  scrollContainer,
  handleTabClick,
  handleScrollEnd,
  handleScroll,
  onCyclicWrap,
  cyclicPanelOrder,
} = useScrollableTabs(type, applyTypeChange, TRANSACTION_TYPE_ORDER);

const activeIndex = computed(() => EXPENSE_INDEX + TRANSACTION_TYPE_ORDER.indexOf(type.value));

/**
 * Соседние панели нужны только тогда, когда карусель реально может на них
 * уехать, — поэтому поднимаем их на первом касании скроллера или клике по табу,
 * до того как палец сдвинулся. При открытии экрана рисуется одна панель вместо
 * шести (4 типа + 2 клона): вместе с лишними поддеревьями уходят запросы людей
 * и курсов валют, которые на «Расходе» не нужны вовсе.
 */
const neighborsArmed = ref(false);
function armNeighbors() {
  neighborsArmed.value = true;
}

function isRendered(index: number) {
  const distance = Math.abs(index - activeIndex.value);
  return distance === 0 || (neighborsArmed.value && distance === 1);
}

/**
 * Автофокус на сумме — только при первом показе экрана. Панели монтируются на
 * лету, и без этого флага каждое переключение вкладки заново поднимало бы
 * клавиатуру, а браузер доскроливал фокусируемое поле, воюя с каруселью.
 */
const autofocusSpent = ref(false);
function shouldAutofocus(index: number) {
  return Boolean(props.autofocusAmount) && !autofocusSpent.value && index === activeIndex.value;
}

// --- Плавная высота контейнера ---
const containerHeight = ref<string>('auto');
let lastCalculatedIndex = -1;
let rafHandle: number | null = null;
let pendingForce = false;

function updateContainerHeight(force: boolean) {
  if (!scrollContainer.value) return;

  // Ширину берём из bounding rect: offsetWidth округляется, и на дробном
  // масштабе деление даёт не тот индекс панели.
  const panelWidth = scrollContainer.value.getBoundingClientRect().width;
  if (panelWidth === 0) return;

  const currentIndex = Math.round(scrollContainer.value.scrollLeft / panelWidth);
  if (!force && currentIndex === lastCalculatedIndex) return;
  lastCalculatedIndex = currentIndex;

  const activePanel = scrollContainer.value.children[currentIndex] as HTMLElement | undefined;
  // Ноль приходит, когда панель перемонтируется, — схлопываться на него нельзя.
  if (activePanel && activePanel.offsetHeight > 0) {
    containerHeight.value = `${activePanel.offsetHeight}px`;
  }
}

/**
 * Замер высоты — чтение layout, за которым сразу идёт запись стиля. Батчим в
 * один кадр: иначе инерционный скролл и ResizeObserver форсят reflow на каждое
 * событие.
 */
function scheduleHeightUpdate(force = false) {
  pendingForce = pendingForce || force;
  if (rafHandle !== null) return;
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null;
    const shouldForce = pendingForce;
    pendingForce = false;
    updateContainerHeight(shouldForce);
  });
}

// Наблюдаем контейнер и ТОЛЬКО активную панель: раньше наблюдались все шесть, и
// ресайз невидимой панели дёргал пересчёт видимой.
let containerObserver: ResizeObserver | null = null;
let panelObserver: ResizeObserver | null = null;

watch(
  scrollContainer,
  (el) => {
    containerObserver?.disconnect();
    if (!el) return;
    containerObserver ??= new ResizeObserver(() => scheduleHeightUpdate(true));
    containerObserver.observe(el);
  },
  { immediate: true },
);

watch(
  [scrollContainer, activeIndex],
  ([el, index]) => {
    panelObserver?.disconnect();
    if (!el) return;
    panelObserver ??= new ResizeObserver(() => scheduleHeightUpdate(true));
    nextTick(() => {
      const panel = el.children[index as number] as HTMLElement | undefined;
      if (panel) panelObserver?.observe(panel);
      scheduleHeightUpdate(true);
    });
  },
  { immediate: true },
);

onUnmounted(() => {
  containerObserver?.disconnect();
  panelObserver?.disconnect();
  if (rafHandle !== null) cancelAnimationFrame(rafHandle);
});

function onScroll() {
  handleScroll();
  scheduleHeightUpdate();
}
function onScrollEnd() {
  handleScrollEnd();
  scheduleHeightUpdate();
}
onCyclicWrap(() => scheduleHeightUpdate(true));

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

function updateField<K extends keyof TransactionFormData>(field: K, value: TransactionFormData[K]) {
  emit('update:formData', { ...props.formData, [field]: value });
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
  // Панели уже смонтировались и забрали автофокус — дальше он не нужен.
  nextTick(() => {
    autofocusSpent.value = true;
  });

  if (shouldShowHint('split-expense')) {
    showSplitHintDelayed();
  }
});

onUnmounted(() => {
  stopSplitHint();
});

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
    if (newError) {
      trigger('error');
    }
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

// Единственная входная анимация: она же прячет кадр, в котором карусель ещё не
// припарковалась на нужной панели.
const { isMounted } = useMountedAnimation();
</script>

<template>
  <form
    class="form-root space-y-4 transition-opacity duration-200"
    :class="[
      isSubmitting && 'opacity-60 pointer-events-none',
      isMounted ? 'opacity-100' : 'opacity-0',
    ]"
    @submit.prevent="$emit('submit')"
  >
    <!-- Type Tabs -->
    <UTabs
      :model-value="formData.type"
      :items="ALL_TAB_ITEMS"
      @update:model-value="
        (v: string) => {
          armNeighbors();
          handleTabClick(v as TransactionType);
        }
      "
    />

    <!-- Swipeable panels with smooth height -->
    <div class="panels-viewport overflow-hidden" :style="{ height: containerHeight }">
      <div
        ref="scrollContainer"
        class="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar -mx-4 md:-mx-0 h-full scroll-smooth"
        @scrollend="onScrollEnd"
        @scroll="onScroll"
        @pointerdown="armNeighbors"
        @touchstart.passive="armNeighbors"
        @wheel.passive="armNeighbors"
        @keydown="armNeighbors"
      >
        <div
          v-for="(panelType, idx) in cyclicPanelOrder"
          :key="`${panelType}-${idx}`"
          class="min-w-full snap-start px-4 md:px-0"
          :inert="idx !== activeIndex || undefined"
          :aria-hidden="idx !== activeIndex || undefined"
        >
          <template v-if="isRendered(idx)">
            <FeatureHintPopover
              v-if="panelType === 'expense' && idx === EXPENSE_INDEX && splitHintConfig"
              :config="splitHintConfig"
              :open="showSplitHint"
              side="top"
              @dismiss="dismissSplitHint"
              @action="handleSplitHintAction"
            >
              <ExpensePanel
                v-bind="expensePanelProps"
                :autofocus-amount="shouldAutofocus(idx)"
                v-on="expensePanelHandlers"
              />
            </FeatureHintPopover>
            <ExpensePanel
              v-else-if="panelType === 'expense'"
              v-bind="expensePanelProps"
              :autofocus-amount="shouldAutofocus(idx)"
              v-on="expensePanelHandlers"
            />
            <IncomePanel
              v-else-if="panelType === 'income'"
              :form-data="formData"
              :accounts="accounts"
              :categories="incomeCategories"
              :transactions="transactions"
              :autofocus-amount="shouldAutofocus(idx)"
              @update:form-data="$emit('update:formData', $event)"
            />
            <TransferPanel
              v-else-if="panelType === 'transfer'"
              :form-data="formData"
              :accounts="accounts"
              :user-currency="userCurrency"
              @update:form-data="$emit('update:formData', $event)"
            />
            <DebtPanel
              v-else-if="panelType === 'debt'"
              :accounts="accounts"
              :default-account-id="defaultAccountId"
              :autofocus-amount="shouldAutofocus(idx)"
              @submitted="$emit('debt-submitted')"
            />
          </template>
        </div>
      </div>
    </div>

    <!-- Комментарий и дата: два чипа вместо двух полей с подписями. Поле
         раскрывается на месте, поэтому подсказки хэштегов больше не двигают
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
      class="submit-bar sticky bottom-0 -mx-4 px-4 pt-3 md:-mx-0 md:px-0 [--bar-bg:var(--color-background-light)] dark:[--bar-bg:var(--color-background-dark)] md:[--bar-bg:var(--color-card-light)] dark:md:[--bar-bg:var(--color-card-dark)]"
    >
      <p v-if="error" data-testid="validation-error" role="alert" class="pb-2 text-xs text-danger">
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
  </form>
</template>

<style scoped>
.panels-viewport {
  transition: height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/*
 * Цвет подложки приходит переменной `--bar-bg`: её ставят Tailwind-варианты
 * `dark:` / `md:` прямо на элементе. Через `:global(html.dark)` не выйдет —
 * тема здесь навешивается классом `.dark`, а не на конкретный узел.
 * Верх полупрозрачный, чтобы содержимое уезжало под панель, а не обрывалось.
 */
.submit-bar {
  background: linear-gradient(to bottom, transparent 0, var(--bar-bg) 0.75rem, var(--bar-bg));
  padding-bottom: max(env(safe-area-inset-bottom), 0.75rem);
}

@media (prefers-reduced-motion: reduce) {
  .form-root,
  .panels-viewport {
    transition: none;
  }
  .form-root :deep(.scroll-smooth) {
    scroll-behavior: auto;
  }
}
</style>
