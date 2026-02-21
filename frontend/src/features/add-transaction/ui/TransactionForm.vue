<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { UInput, UButton, UTabs, UIcon } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { SplitExpenseData, SplitMethod } from '@/features/split-expense';
import type { TransactionFormData } from '../model/useTransactionForm';
import {
  useScrollableTabs,
  CYCLIC_PANEL_ORDER,
  TRANSACTION_TYPE_ORDER,
  type TransactionType,
} from '../model/useScrollableTabs';
import { useHashtags } from '@/entities/transaction';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/ui/primitives/popover';
import { Calendar } from '@/shared/ui/primitives/calendar';
import { CalendarDate, type DateValue } from '@internationalized/date';
import ExpensePanel from './ExpensePanel.vue';
import IncomePanel from './IncomePanel.vue';
import TransferPanel from './TransferPanel.vue';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  userCurrency?: string;
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
  addParticipant: [name: string];
  removeParticipant: [id: string];
  updateParticipantAmount: [id: string, amount: number];
  updateParticipantName: [id: string, name: string];
  setSplitMethod: [method: SplitMethod];
  setMyShare: [amount: number];
  setIsIncluded: [included: boolean];
  setSplitEnabled: [enabled: boolean];
}>();

const tabItems = [
  { id: 'expense', label: 'Расход' },
  { id: 'income', label: 'Доход' },
  { id: 'transfer', label: 'Перевод' },
];

const type = computed(() => props.formData.type);

function applyTypeChange(newType: string) {
  emit('update:formData', {
    ...props.formData,
    type: newType as 'income' | 'expense' | 'transfer',
    categoryId: newType === 'transfer' ? 'transfer' : '',
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
} = useScrollableTabs(type, applyTypeChange);

// --- Smooth Height Auto-adjust ---
const containerHeight = ref<string>('auto');
let resizeObserver: ResizeObserver | null = null;
let lastCalculatedIndex = -1;

function updateContainerHeight(force = false) {
  if (!scrollContainer.value) return;

  // Use bounding rect width to prevent 0-width collapse issues
  const rect = scrollContainer.value.getBoundingClientRect();
  const panelWidth = rect.width;
  if (panelWidth === 0) return;

  const currentIndex = Math.round(
    scrollContainer.value.scrollLeft / panelWidth,
  );

  if (!force && currentIndex === lastCalculatedIndex) return;
  lastCalculatedIndex = currentIndex;

  const panels = scrollContainer.value.children;

  if (panels[currentIndex]) {
    const activePanel = panels[currentIndex] as HTMLElement;
    // Fix: check if height is greater than 0 before updating to prevent snapping to 0 when element remounts
    if (activePanel.offsetHeight > 0) {
      containerHeight.value = `${activePanel.offsetHeight}px`;
    }
  }
}

// Observe scrollContainer and its children once available
watch(scrollContainer, (el) => {
  resizeObserver?.disconnect();
  if (!el) return;

  resizeObserver = new ResizeObserver(() => updateContainerHeight(true));
  resizeObserver.observe(el);
  Array.from(el.children).forEach((child) => {
    resizeObserver?.observe(child);
  });
  nextTick(() => updateContainerHeight(true));
});

onUnmounted(() => {
  resizeObserver?.disconnect();
});

// Update height on scroll, type change, and cyclic wrap
function onScroll() {
  handleScroll();
  updateContainerHeight();
}
function onScrollEnd() {
  handleScrollEnd();
  updateContainerHeight();
}
onCyclicWrap(() => updateContainerHeight(true));
// ---

// Only real panels (not clones) get autofocus — clones are at index 0 and last
const realPanelIndices = new Set(TRANSACTION_TYPE_ORDER.map((_, i) => i + 1));

const submitLabel = computed(() => {
  if (props.formData.type === 'transfer') return 'Перевести';
  if (props.formData.type === 'income') return 'Добавить доход';
  return 'Добавить расход';
});

const descriptionPlaceholder = computed(() => {
  if (props.formData.type === 'income') return '#зарплата, #фриланс...';
  if (props.formData.type === 'transfer') return '#накопления, #перевод...';
  return '#продукты, #кафе, #такси...';
});

// Hashtag suggestions
const { userId } = useCurrentUser();
const { hashtags } = useHashtags(userId);
const descriptionFocused = ref(false);

function insertHashtag(tag: string) {
  const current = props.formData.description || '';
  const separator = current && !current.endsWith(' ') ? ' ' : '';
  emit('update:formData', {
    ...props.formData,
    description: current + separator + tag,
  });
}

// Calendar date picker
const calendarOpen = ref(false);

const calendarValue = computed(() => {
  const d = new Date(props.formData.date);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
});

const displayDate = computed(() => {
  const d = new Date(props.formData.date);
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
});

function onCalendarSelect(value: DateValue | undefined) {
  if (!value) return;
  const date = new Date(value.year, value.month - 1, value.day);
  emit('update:formData', {
    ...props.formData,
    date: date.getTime(),
  });
  calendarOpen.value = false;
}

// Staggered entrance animation control
const isMounted = ref(false);
onMounted(() =>
  requestAnimationFrame(() => {
    isMounted.value = true;
  }),
);
</script>

<template>
  <form
    class="space-y-4 transition-opacity duration-200"
    :class="isSubmitting && 'opacity-60 pointer-events-none'"
    @submit.prevent="$emit('submit')"
  >
    <!-- Type Tabs -->
    <div
      class="stagger-1 transform transition-all duration-500 ease-out"
      :class="
        isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      "
    >
      <UTabs
        :model-value="formData.type"
        :items="tabItems"
        @update:model-value="
          (v: string) => handleTabClick(v as TransactionType)
        "
      />
    </div>

    <!-- Swipeable panels with smooth height -->
    <div
      class="stagger-2 transform transition-all duration-500 ease-out delay-75 overflow-hidden"
      :class="
        isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      "
      :style="{
        height: containerHeight,
        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }"
    >
      <div
        ref="scrollContainer"
        class="flex items-start overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar -mx-4 h-full"
        @scrollend="onScrollEnd"
        @scroll="onScroll"
      >
        <div
          v-for="(panelType, idx) in CYCLIC_PANEL_ORDER"
          :key="`${panelType}-${idx}`"
          class="min-w-full snap-start px-4"
        >
          <ExpensePanel
            v-if="panelType === 'expense'"
            :form-data="formData"
            :accounts="accounts"
            :categories="expenseCategories"
            :split-data="splitData"
            :split-validation-error="splitValidationError"
            :autofocus-amount="autofocusAmount && realPanelIndices.has(idx)"
            @update:form-data="$emit('update:formData', $event)"
            @add-participant="$emit('addParticipant', $event)"
            @remove-participant="$emit('removeParticipant', $event)"
            @update-participant-amount="
              (id, amount) => $emit('updateParticipantAmount', id, amount)
            "
            @update-participant-name="
              (id, name) => $emit('updateParticipantName', id, name)
            "
            @set-split-method="$emit('setSplitMethod', $event)"
            @set-my-share="$emit('setMyShare', $event)"
            @set-is-included="$emit('setIsIncluded', $event)"
            @set-split-enabled="$emit('setSplitEnabled', $event)"
          />
          <IncomePanel
            v-else-if="panelType === 'income'"
            :form-data="formData"
            :accounts="accounts"
            :categories="incomeCategories"
            @update:form-data="$emit('update:formData', $event)"
          />
          <TransferPanel
            v-else-if="panelType === 'transfer'"
            :form-data="formData"
            :accounts="accounts"
            :user-currency="userCurrency"
            @update:form-data="$emit('update:formData', $event)"
          />
        </div>
      </div>
    </div>

    <!-- Bottom section -->
    <div
      class="space-y-3 stagger-3 transform transition-all duration-500 ease-out delay-150"
      :class="
        isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      "
    >
      <!-- Description & Date row -->
      <div
        class="grid grid-cols-2 gap-2"
        @focusin="descriptionFocused = true"
        @focusout="descriptionFocused = false"
      >
        <UInput
          :model-value="formData.description"
          label="Комментарий"
          :placeholder="descriptionPlaceholder"
          @update:model-value="
            $emit('update:formData', {
              ...formData,
              description: $event as string,
            })
          "
          @keydown.enter.prevent
        />

        <div class="flex flex-col gap-1.5 w-full">
          <label
            class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark ml-0.5"
          >
            Дата
          </label>
          <Popover v-model:open="calendarOpen">
            <PopoverTrigger as-child>
              <button
                type="button"
                class="flex items-center justify-between w-full px-3 py-3 rounded-lg text-sm bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark text-text-primary-light dark:text-text-primary-dark transition-all duration-150"
              >
                <span>{{ displayDate }}</span>
                <UIcon
                  name="calendar_today"
                  size="sm"
                  class="text-text-tertiary-light dark:text-text-tertiary-dark"
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="top"
              :side-offset="8"
              :collision-padding="16"
              class="w-auto p-0"
            >
              <Calendar
                :model-value="calendarValue"
                locale="ru-RU"
                @update:model-value="onCalendarSelect"
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <!-- Hashtag suggestions (full width, outside grid) with staggered chips -->
      <Transition name="hashtags-container">
        <div
          v-if="descriptionFocused && hashtags.length > 0"
          class="flex gap-1.5 overflow-x-auto no-scrollbar py-1"
        >
          <button
            v-for="(h, i) in hashtags"
            :key="h.tag"
            type="button"
            class="hashtag-chip shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark hover:bg-primary-light hover:text-primary hover:border-primary/30 active:scale-95 transition-all duration-200"
            :style="{ transitionDelay: `${i * 30}ms` }"
            @mousedown.prevent="insertHashtag(h.tag)"
          >
            {{ h.tag }}
          </button>
        </div>
      </Transition>

      <!-- Error -->
      <p v-if="error" class="text-xs text-danger">{{ error }}</p>

      <!-- Submit (Sticky on mobile if needed, but safe padding) -->
      <div class="pt-2 pb-safe">
        <UButton
          type="submit"
          variant="primary"
          size="lg"
          full-width
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
.hashtags-container-enter-active,
.hashtags-container-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.hashtags-container-enter-from,
.hashtags-container-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.hashtags-container-enter-from .hashtag-chip,
.hashtags-container-leave-to .hashtag-chip {
  opacity: 0;
  transform: translateY(-4px) scale(0.95);
}
.pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 16px);
}
</style>
