<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import type { Category } from '@/entities/category';
import {
  normalizeTagInput,
  TRANSACTION_TYPE_LABELS,
  type BulkAction,
  type TransactionsSummary,
} from '@/entities/transaction';
import { formatCurrency } from '@/shared/lib/format/currency';
import { cn } from '@/shared/lib/utils';
import { IconBadge, UButton, UIcon, UOverlay } from '@/shared/ui';
import type { ScopeChip } from '../model/scopeChips';
import type { BulkEditFlow, BulkPreview, BulkStep } from '../model/useBulkEditFlow';
import {
  actionTexts,
  lockedNote,
  opsAccusative,
  opsGenitive,
  opsInstrumental,
  summaryLabel,
} from '../model/bulkTexts';
import { formatTotals } from '../lib/formatTotals';
import BulkConfirmSummary from './BulkConfirmSummary.vue';

const props = defineProps<{
  flow: BulkEditFlow;
  /** Блок охвата «Изменить все»: чипы того же фильтра, что у ленты, и его итог. */
  scopeChips: ScopeChip[];
  summary?: TransactionsSummary;
  /** Категории-цели расходов и доходов; какие группы показывать — `categoryTypes`. */
  categories: Category[];
  categoryTypes: Array<'expense' | 'income'>;
  /** Все операции уже в одной категории — переносить в неё же бессмысленно. */
  sourceCategoryIds: string[];
  accounts: AccountWithBalances[];
  /** Существующие теги без `#`. */
  hashtags: string[];
}>();

const { step, mode, scopeCount, action, targetName, preview, isApplying, canGoBack } = props.flow;

// Пока шторка уезжает вниз, шаг и сводка уже сброшены — показываем последнее открытое.
const shown = shallowRef<{
  step: Exclude<BulkStep, 'closed'>;
  action: BulkAction | null;
  targetName?: string;
  preview: BulkPreview;
}>({ step: 'scope', action: null, preview: { status: 'idle' } });
watch(
  [step, action, targetName, preview],
  ([current]) => {
    if (current === 'closed') return;
    shown.value = {
      step: current,
      action: action.value,
      targetName: targetName.value,
      preview: preview.value,
    };
  },
  { immediate: true },
);

const isOpen = computed({
  get: () => step.value !== 'closed',
  set: (open: boolean) => {
    if (!open) props.flow.close();
  },
});

const scopeLabel = computed(() => (props.summary ? summaryLabel(props.summary, true) : ''));
const scopeTotals = computed(() => formatTotals(props.summary?.totals ?? []));
const lockedCount = computed(() => props.summary?.locked_count ?? 0);

const changed = computed(() =>
  shown.value.preview.status === 'ready' ? shown.value.preview.result.changed : 0,
);

const title = computed(() => {
  const count = scopeCount.value;
  const current = shown.value;
  switch (current.step) {
    case 'scope':
      return `Изменить все ${opsAccusative(count)}`;
    case 'verbs':
      return `Что сделать с ${opsInstrumental(count)}`;
    case 'pickCategory':
      return 'Куда перенести';
    case 'pickTransferAccount':
      return 'На какой счёт ушли деньги';
    case 'pickAccount':
      return 'На какой счёт перенести';
    case 'tag':
      return `Тег для ${opsGenitive(count)}`;
    case 'confirm':
      return current.action
        ? actionTexts(current.action, changed.value || count, current.targetName).title
        : '';
    default:
      return '';
  }
});

type Verb = {
  key: string;
  icon: string;
  label: string;
  danger?: boolean;
  /** Есть кнопкой на панели ручного выбора — в её «Ещё» не повторяем. */
  onPanel?: boolean;
  run: () => void;
};
const VERBS: Verb[] = [
  {
    key: 'category',
    icon: 'folder',
    label: 'Перенести в другую категорию',
    onPanel: true,
    run: () => props.flow.go('pickCategory'),
  },
  {
    key: 'transfer',
    icon: 'swap_horiz',
    label: 'Сделать переводом на свой счёт',
    onPanel: true,
    run: () => props.flow.go('pickTransferAccount'),
  },
  {
    key: 'account',
    icon: 'account_balance_wallet',
    label: 'Сменить счёт',
    onPanel: true,
    run: () => props.flow.go('pickAccount'),
  },
  { key: 'tag', icon: 'sell', label: 'Добавить тег', run: () => props.flow.go('tag') },
  {
    key: 'delete',
    icon: 'delete',
    label: 'Удалить',
    danger: true,
    run: () => props.flow.chooseAction({ kind: 'delete' }),
  },
];

const verbs = computed(() =>
  mode.value === 'manual' ? VERBS.filter((verb) => !verb.onPanel) : VERBS,
);

const categoryGroups = computed(() =>
  props.categoryTypes.map((type) => ({
    type,
    title: TRANSACTION_TYPE_LABELS[type],
    items: props.categories.filter((category) => category.type === type),
  })),
);
const isCurrentCategory = (id: string) =>
  props.sourceCategoryIds.length === 1 && props.sourceCategoryIds[0] === id;

function balanceLine(account: AccountWithBalances): string {
  return account.balances
    .map((balance) => formatCurrency(balance.balance, balance.currency))
    .join(' · ');
}

function pickAccount(account: AccountWithBalances) {
  const next: BulkAction =
    shown.value.step === 'pickTransferAccount'
      ? { kind: 'transfer', to_account_id: account.id }
      : { kind: 'account', account_id: account.id };
  props.flow.chooseAction(next, account.name);
}

const tagText = ref('');
const newTag = computed(() => normalizeTagInput(tagText.value));
watch(isOpen, (open) => {
  if (open) tagText.value = '';
});

function chooseTag(tag: string) {
  if (tag) props.flow.chooseAction({ kind: 'tag', tag });
}

const canApply = computed(
  () => shown.value.preview.status === 'ready' && changed.value > 0 && !isApplying.value,
);
const applyLabel = computed(() =>
  shown.value.action && shown.value.preview.status === 'ready'
    ? actionTexts(shown.value.action, changed.value).button
    : 'Готовим сводку…',
);

const ROW =
  'flex w-full items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-40';
</script>

<template>
  <UOverlay v-model="isOpen" :title="title" desktop="panel" :fill="shown.step === 'tag'">
    <template #leading>
      <!-- 44×44 для пальца; отрицательные поля не дают шапке вырасти на шагах с «Назад» -->
      <button
        v-if="canGoBack"
        type="button"
        data-testid="bulk-sheet-back"
        aria-label="Назад"
        class="-my-1.5 -ml-3 -mr-1.5 flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary-light hover:bg-surface-light dark:text-text-secondary-dark dark:hover:bg-surface-dark"
        @click="flow.back()"
      >
        <UIcon name="arrow_back" size="sm" />
      </button>
    </template>

    <div data-testid="bulk-edit-sheet" :data-step="shown.step">
      <!-- Охват и действия -->
      <template v-if="shown.step === 'scope' || shown.step === 'verbs'">
        <div
          v-if="shown.step === 'scope'"
          data-testid="bulk-scope"
          class="mb-2 rounded-2xl bg-background-light p-3 dark:bg-background-dark"
        >
          <div v-if="scopeChips.length > 0" class="mb-2.5 flex flex-wrap gap-1.5">
            <span
              v-for="chip in scopeChips"
              :key="chip.key"
              class="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-light px-2.5 text-xs font-medium dark:bg-surface-dark"
            >
              <UIcon v-if="chip.icon" :name="chip.icon" size="xs" :style="{ color: chip.color }" />
              <span
                v-else-if="chip.dot"
                class="size-2 rounded-full"
                :style="{ backgroundColor: chip.dot }"
              />
              {{ chip.label }}
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-3 text-body-sm">
            <span class="text-text-secondary-light dark:text-text-secondary-dark">
              {{ scopeLabel }}
            </span>
            <span class="font-semibold tabular-nums">{{ scopeTotals }}</span>
          </div>
        </div>

        <button
          v-for="verb in verbs"
          :key="verb.key"
          type="button"
          :data-testid="`bulk-verb-${verb.key}`"
          :class="cn(ROW, 'min-h-14 py-1.5', verb.danger && 'text-danger')"
          @click="verb.run"
        >
          <IconBadge
            :icon="verb.icon"
            size="lg"
            :bg-class="verb.danger ? 'bg-danger-light' : 'bg-surface-light dark:bg-surface-dark'"
          />
          <span class="text-body font-medium">{{ verb.label }}</span>
        </button>

        <p
          v-if="mode === 'all' && lockedCount > 0"
          data-testid="bulk-locked-note"
          class="mt-3 text-body-sm leading-snug text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ lockedNote(lockedCount) }}
        </p>
      </template>

      <!-- Категория-цель -->
      <template v-else-if="shown.step === 'pickCategory'">
        <section v-for="group in categoryGroups" :key="group.type" class="mb-4 last:mb-0">
          <h3
            v-if="categoryGroups.length > 1"
            class="mb-2 text-xs font-semibold text-text-secondary-light dark:text-text-secondary-dark"
          >
            {{ group.title }}
          </h3>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="category in group.items"
              :key="category.id"
              type="button"
              :data-testid="`bulk-category-${category.id}`"
              :disabled="isCurrentCategory(category.id)"
              class="flex min-h-[76px] flex-col items-center gap-1.5 rounded-2xl bg-background-light px-1 pt-3 pb-2.5 text-center text-xs font-medium transition-colors hover:bg-surface-light active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 dark:bg-background-dark dark:hover:bg-surface-dark"
              @click="
                flow.chooseAction({ kind: 'category', category_id: category.id }, category.name)
              "
            >
              <IconBadge :icon="category.icon" :color="category.color" size="md" />
              <span class="line-clamp-2">{{ category.name }}</span>
            </button>
          </div>
        </section>
      </template>

      <!-- Счёт-цель -->
      <template v-else-if="shown.step === 'pickTransferAccount' || shown.step === 'pickAccount'">
        <button
          v-for="account in accounts"
          :key="account.id"
          type="button"
          :data-testid="`bulk-account-${account.id}`"
          :class="cn(ROW, 'min-h-14 py-2')"
          @click="pickAccount(account)"
        >
          <IconBadge :icon="account.icon" :color="account.color" size="md" />
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="truncate text-body font-medium">{{ account.name }}</span>
            <span
              class="truncate text-xs tabular-nums text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              {{ balanceLine(account) }}
            </span>
          </span>
          <UIcon
            name="chevron_right"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
        </button>
      </template>

      <!-- Тег -->
      <template v-else-if="shown.step === 'tag'">
        <form
          class="flex items-center gap-2 rounded-xl bg-background-light py-1 pr-1 pl-3 dark:bg-background-dark"
          @submit.prevent="chooseTag(newTag)"
        >
          <span class="font-semibold text-text-tertiary-light dark:text-text-tertiary-dark">#</span>
          <input
            v-model="tagText"
            data-testid="bulk-tag-input"
            type="text"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="новый тег"
            aria-label="Новый тег"
            maxlength="100"
            class="h-11 min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-tertiary-light dark:placeholder:text-text-tertiary-dark"
          />
          <UButton
            type="button"
            size="sm"
            :disabled="!newTag"
            data-testid="bulk-tag-add"
            @click="chooseTag(newTag)"
          >
            Добавить
          </UButton>
        </form>

        <div v-if="hashtags.length > 0" class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="tag in hashtags"
            :key="tag"
            type="button"
            :data-testid="`bulk-tag-${tag}`"
            class="inline-flex h-11 items-center rounded-full bg-surface-light px-4 text-body-sm font-medium transition-colors hover:bg-border-light active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-surface-dark dark:hover:bg-border-dark"
            @click="chooseTag(tag)"
          >
            #{{ tag }}
          </button>
        </div>
      </template>

      <!-- Сводка -->
      <BulkConfirmSummary
        v-else-if="shown.action"
        :action="shown.action"
        :target-name="shown.targetName"
        :preview="shown.preview"
        :categories="categories"
        :accounts="accounts"
        :source-category-id="sourceCategoryIds.length === 1 ? sourceCategoryIds[0] : undefined"
      />
    </div>

    <template v-if="shown.step === 'confirm'" #footer>
      <div class="flex gap-2">
        <UButton
          variant="secondary"
          data-testid="bulk-confirm-cancel"
          @click="canGoBack ? flow.back() : flow.close()"
        >
          {{ canGoBack ? 'Назад' : 'Отмена' }}
        </UButton>
        <UButton
          :variant="shown.action?.kind === 'delete' ? 'danger' : 'primary'"
          class="flex-1"
          data-testid="bulk-confirm-apply"
          :disabled="!canApply"
          :loading="isApplying"
          @click="flow.apply()"
        >
          {{ applyLabel }}
        </UButton>
      </div>
    </template>
  </UOverlay>
</template>
