<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DebtCardSkeleton,
  type Debt,
  type DebtByPerson,
  type DebtDirection,
  DEBT_DIRECTION_COLORS,
  countOverdueDebts,
  groupDebtsByPerson,
  bucketDebtsByType,
} from '@/entities/debt';
import { UBadge, UTabs, SectionHeader, IconBadge, EmptyState } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useExchangeRates } from '@/shared/api';
import { listTransition } from '@/shared/lib/transitions';
import { useHaptics } from '@/shared/lib/haptics';

const props = defineProps<{
  debts: Debt[];
  currency: string;
  loading?: boolean;
  hidden?: boolean;
}>();

const emit = defineEmits<{
  'debt-click': [debt: Debt];
  'person-click': [personName: string, debtType: 'given' | 'taken'];
  'add-click': [];
  'view-all': [];
}>();

const { trigger } = useHaptics();

const activeTab = ref('given');

const debtTabs = [
  { id: 'given', label: 'Вам должны' },
  { id: 'taken', label: 'Вы должны' },
];

function handleGroupClick(group: DebtByPerson) {
  trigger('selection');
  if (group.debts.length === 1) {
    emit('debt-click', group.debts[0]);
  } else {
    emit('person-click', group.personName, group.debtType);
  }
}

function handleTabChange(tab: string) {
  trigger('selection');
  activeTab.value = tab;
}

function handleAddClick() {
  trigger('selection');
  emit('add-click');
}

function handleViewAll() {
  trigger('selection');
  emit('view-all');
}

const { convert } = useExchangeRates(computed(() => props.currency));

const debtsByPerson = computed<DebtByPerson[]>(() => groupDebtsByPerson(props.debts, convert));
const debtsByType = computed(() => bucketDebtsByType(debtsByPerson.value));
const filteredDebts = computed(() => debtsByType.value[activeTab.value as DebtDirection]);

const MAX_VISIBLE_GROUPS = 4;

const hiddenCount = computed(() => {
  return Math.max(0, filteredDebts.value.length - MAX_VISIBLE_GROUPS);
});

const overdueCount = computed(() => countOverdueDebts(props.debts));
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      title="Долги"
      :count="debtsByPerson.length"
      show-view-all
      @add-click="handleAddClick"
      @view-all="handleViewAll"
    >
      <template #badge>
        <UBadge v-if="overdueCount > 0" variant="danger" size="xs">
          {{ overdueCount }} просрочено
        </UBadge>
      </template>
    </SectionHeader>

    <!-- Tabs -->
    <UTabs
      v-if="debtsByPerson.length > 0 && !loading"
      :model-value="activeTab"
      :items="debtTabs"
      size="sm"
      @update:model-value="handleTabChange"
    />

    <!-- Loading state -->
    <div v-if="loading" class="space-y-2">
      <DebtCardSkeleton v-for="i in 2" :key="i" />
    </div>

    <!-- Filtered Debts List -->
    <TransitionGroup
      v-else-if="filteredDebts.length > 0"
      tag="div"
      class="space-y-2"
      :enter-active-class="listTransition.enterActiveClass"
      :leave-active-class="listTransition.leaveActiveClass"
      :enter-from-class="listTransition.enterFromClass"
      :leave-to-class="listTransition.leaveToClass"
      :move-class="listTransition.moveClass"
    >
      <button
        v-for="group in filteredDebts.slice(0, MAX_VISIBLE_GROUPS)"
        :key="`${group.personName}_${group.debtType}`"
        class="w-full p-3 rounded-xl text-left bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80 transition-all duration-150"
        @click="handleGroupClick(group)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <IconBadge
              :icon="group.debtType === 'given' ? 'arrow_upward' : 'arrow_downward'"
              size="sm"
              :color="DEBT_DIRECTION_COLORS[group.debtType]"
            />
            <div class="min-w-0">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ group.hasPrivate ? '•••' : group.personName }}
              </p>
              <p
                v-if="group.nearestDueDate"
                class="text-xs"
                :class="
                  isPastDate(group.nearestDueDate)
                    ? 'text-danger font-medium'
                    : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                "
              >
                {{
                  isPastDate(group.nearestDueDate)
                    ? 'Просрочено'
                    : formatDate(group.nearestDueDate, { format: 'short' })
                }}
              </p>
              <p v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{
                  group.debts.length > 1
                    ? `${group.debts.length} ${pluralize(group.debts.length, 'долг', 'долга', 'долгов')}`
                    : 'Без срока'
                }}
              </p>
            </div>
          </div>

          <p
            class="text-sm font-semibold shrink-0"
            :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
          >
            {{
              formatMasked(group.totalRemaining, currency, (hidden ?? false) || group.hasPrivate)
            }}
          </p>
        </div>
      </button>
    </TransitionGroup>

    <!-- Truncation indicator -->
    <p
      v-if="filteredDebts.length > 0 && hiddenCount > 0 && !loading"
      class="text-xs text-center text-text-tertiary-light dark:text-text-tertiary-dark pt-1"
    >
      и ещё {{ hiddenCount }} {{ pluralize(hiddenCount, 'долг', 'долга', 'долгов') }}
    </p>

    <!-- Empty state for current tab (no debts of this type, but other type exists) -->
    <EmptyState
      v-if="filteredDebts.length === 0 && debtsByPerson.length > 0 && !loading"
      variant="inline"
      :icon="activeTab === 'given' ? 'arrow_upward' : 'arrow_downward'"
      :title="activeTab === 'given' ? 'Нет долгов «вам должны»' : 'Нет долгов «вы должны»'"
      description="Долги этого типа появятся здесь"
    />

    <!-- Empty state — no debts at all -->
    <EmptyState
      v-else-if="debtsByPerson.length === 0 && !loading"
      variant="inline"
      icon="check_circle"
      title="Вы без долгов!"
      description="Отличная финансовая дисциплина"
      icon-bg-class="bg-success-light"
      :action="{ label: 'Добавить долг', onClick: handleAddClick }"
    />
  </div>
</template>
