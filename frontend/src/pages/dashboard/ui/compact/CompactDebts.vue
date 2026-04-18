<script setup lang="ts">
import { computed, ref } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { pluralize } from '@/shared/lib/format/pluralize';
import { useHaptics } from '@/shared/lib/haptics';
import {
  DEBT_DIRECTION_COLORS,
  countOverdueDebts,
  groupDebtsByPerson,
  bucketDebtsByType,
  type DebtByPerson,
} from '@/entities/debt';
import { useDashboardContext } from '../../model/dashboardContext';
import {
  SECTION_LABEL_CLASS,
  VIEW_ALL_BTN_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  iconTileStyle,
} from './constants';
import CompactRowSkeleton from './CompactRowSkeleton.vue';

const { debts, debtsLoading, currency, isHidden, convert, nav } = useDashboardContext();
const { trigger } = useHaptics();

const COMPACT_DEBT_LIMIT = 3;
const DEBT_TABS = ['given', 'taken'] as const;
type DebtTab = (typeof DEBT_TABS)[number];

const debtsByPerson = computed<DebtByPerson[]>(() => groupDebtsByPerson(debts.value, convert));
const groupsByTab = computed(() => bucketDebtsByType(debtsByPerson.value));

const activeDebtTab = ref<DebtTab>('given');

const filteredDebts = computed(() => groupsByTab.value[activeDebtTab.value]);
const visibleDebts = computed(() => filteredDebts.value.slice(0, COMPACT_DEBT_LIMIT));
const hiddenDebtsCount = computed(() =>
  Math.max(0, filteredDebts.value.length - COMPACT_DEBT_LIMIT),
);

const debtTabCounts = computed<Record<DebtTab, number>>(() => ({
  given: groupsByTab.value.given.length,
  taken: groupsByTab.value.taken.length,
}));

const overdueDebtCount = computed(() => countOverdueDebts(debts.value));

function handleGroupClick(group: DebtByPerson): void {
  trigger('selection');
  if (group.debts.length === 1) {
    nav.toDebt(group.debts[0]);
  } else {
    nav.toDebts(group.personName, group.debtType);
  }
}

function handleTabClick(tab: DebtTab): void {
  trigger('selection');
  activeDebtTab.value = tab;
}
</script>

<template>
  <section data-testid="compact-debts" :class="SECTION_CARD_CLASS">
    <div :class="SECTION_HEADER_CLASS">
      <div class="flex items-center gap-1.5 min-w-0">
        <p :class="SECTION_LABEL_CLASS">Долги</p>
        <span
          v-if="overdueDebtCount > 0"
          class="text-caption-xs font-bold uppercase tracking-wider text-danger bg-danger/10 px-1.5 py-0.5 rounded"
        >
          {{ overdueDebtCount }} просроч.
        </span>
      </div>
      <button type="button" :class="[VIEW_ALL_BTN_CLASS, 'shrink-0']" @click="nav.toDebts()">
        Все
      </button>
    </div>

    <div v-if="!debtsLoading && debtsByPerson.length > 0" class="flex gap-1 px-3 pt-2 pb-1">
      <button
        v-for="tab in DEBT_TABS"
        :key="tab"
        type="button"
        class="flex items-center gap-1 px-2 py-1 rounded-md text-caption-sm font-semibold uppercase tracking-wider transition-colors"
        :class="
          activeDebtTab === tab
            ? 'bg-primary/10 text-primary'
            : 'text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-light dark:hover:bg-surface-dark'
        "
        @click="handleTabClick(tab)"
      >
        <UIcon :name="tab === 'given' ? 'arrow_upward' : 'arrow_downward'" size="xs" />
        <span>{{ tab === 'given' ? 'Должны вам' : 'Вы должны' }}</span>
        <span v-if="debtTabCounts[tab] > 0" class="tabular-nums opacity-70">
          · {{ debtTabCounts[tab] }}
        </span>
      </button>
    </div>

    <CompactRowSkeleton v-if="debtsLoading" :count="2" />
    <template v-else-if="debtsByPerson.length === 0">
      <button
        type="button"
        aria-label="Добавить долг"
        class="w-full flex items-center justify-center gap-2 px-3 py-4 text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors"
        @click="nav.toNewDebt"
      >
        <UIcon name="check_circle" size="sm" class="text-success" />
        <span>Без долгов</span>
      </button>
    </template>
    <template v-else-if="visibleDebts.length === 0">
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark text-center py-3">
        {{
          activeDebtTab === 'given' ? 'Никто вам ничего не должен' : 'Вы никому ничего не должны'
        }}
      </p>
    </template>
    <template v-else>
      <button
        v-for="(group, index) in visibleDebts"
        :key="`${group.personName}_${group.debtType}`"
        type="button"
        :aria-label="`Долг: ${group.hasPrivate ? 'скрыто' : group.personName}`"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80"
        :class="{ 'border-t border-border-light dark:border-border-dark': index !== 0 }"
        @click="handleGroupClick(group)"
      >
        <div
          class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          :style="iconTileStyle(DEBT_DIRECTION_COLORS[group.debtType])"
        >
          <UIcon
            :name="group.debtType === 'given' ? 'arrow_upward' : 'arrow_downward'"
            size="xs"
            :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
          />
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-body-sm font-semibold truncate text-text-primary-light dark:text-text-primary-dark"
          >
            {{ group.hasPrivate ? '•••' : group.personName }}
            <span
              v-if="group.debts.length > 1"
              class="ml-1 text-caption-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              · {{ group.debts.length }}
            </span>
          </p>
          <p
            v-if="group.nearestDueDate"
            class="text-caption-sm"
            :class="
              isPastDate(group.nearestDueDate)
                ? 'text-danger font-semibold'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark'
            "
          >
            {{
              isPastDate(group.nearestDueDate)
                ? 'Просрочено'
                : formatDate(group.nearestDueDate, { format: 'short' })
            }}
          </p>
          <p v-else class="text-caption-sm text-text-tertiary-light dark:text-text-tertiary-dark">
            Без срока
          </p>
        </div>
        <span
          class="text-body-sm font-bold tabular-nums shrink-0"
          :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
        >
          {{
            formatMasked(
              group.totalRemaining,
              currency,
              isHidden || group.hasPrivate,
              COMPACT_FORMAT,
            )
          }}
        </span>
      </button>
      <p
        v-if="hiddenDebtsCount > 0"
        class="text-caption-sm text-center text-text-tertiary-light dark:text-text-tertiary-dark py-1.5 border-t border-border-light dark:border-border-dark"
      >
        и ещё {{ hiddenDebtsCount }}
        {{ pluralize(hiddenDebtsCount, 'долг', 'долга', 'долгов') }}
      </p>
    </template>
  </section>
</template>
