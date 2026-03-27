<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  DebtCardSkeleton,
  type Debt,
  DEBT_DIRECTION_COLORS,
  getDebtDisplayName,
} from '@/entities/debt';
import { UBadge, UTabs, SectionHeader, IconBadge, EmptyState } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useExchangeRates } from '@/shared/api';
import { DEFAULT_CURRENCY } from '@/shared/config/currency';
import { listTransition } from '@/shared/lib/transitions';
import { useHaptics } from '@/shared/lib/haptics';

interface DebtByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  debtType: 'given' | 'taken';
  nearestDueDate: string | null;
  hasPrivate: boolean;
}

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

const activeDebts = computed(() => {
  return props.debts.filter((d) => !d.is_closed);
});

const debtsByPerson = computed<DebtByPerson[]>(() => {
  const grouped: Record<string, DebtByPerson> = {};

  for (const debt of activeDebts.value) {
    const personName = getDebtDisplayName(debt);
    const key = `${personName}_${debt.debt_type}`;

    if (!grouped[key]) {
      grouped[key] = {
        personName,
        debts: [],
        totalRemaining: 0,
        debtType: debt.debt_type,
        nearestDueDate: null,
        hasPrivate: false,
      };
    }

    grouped[key].debts.push(debt);
    if (debt.is_private) grouped[key].hasPrivate = true;
    grouped[key].totalRemaining += convert(
      debt.remaining_amount,
      debt.currency || DEFAULT_CURRENCY,
    );

    if (debt.next_payment_date) {
      if (!grouped[key].nearestDueDate || debt.next_payment_date < grouped[key].nearestDueDate!) {
        grouped[key].nearestDueDate = debt.next_payment_date;
      }
    }
  }

  return Object.values(grouped).sort((a, b) => {
    if (a.nearestDueDate && b.nearestDueDate) {
      return a.nearestDueDate!.localeCompare(b.nearestDueDate!);
    }
    if (a.nearestDueDate) return -1;
    if (b.nearestDueDate) return 1;
    return 0;
  });
});

const filteredDebts = computed(() => {
  return debtsByPerson.value.filter((g) => g.debtType === activeTab.value);
});

const MAX_VISIBLE_GROUPS = 4;

const hiddenCount = computed(() => {
  return Math.max(0, filteredDebts.value.length - MAX_VISIBLE_GROUPS);
});

const overdueCount = computed(() => {
  return activeDebts.value.filter((d) => d.next_payment_date && isPastDate(d.next_payment_date))
    .length;
});
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      title="Долги"
      :count="activeDebts.length"
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
      v-if="activeDebts.length > 0 && !loading"
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
      v-if="filteredDebts.length === 0 && activeDebts.length > 0 && !loading"
      variant="inline"
      :icon="activeTab === 'given' ? 'arrow_upward' : 'arrow_downward'"
      :title="activeTab === 'given' ? 'Нет долгов «вам должны»' : 'Нет долгов «вы должны»'"
      description="Долги этого типа появятся здесь"
    />

    <!-- Empty state — no debts at all -->
    <EmptyState
      v-else-if="activeDebts.length === 0 && !loading"
      variant="inline"
      icon="check_circle"
      title="Вы без долгов!"
      description="Отличная финансовая дисциплина"
      icon-bg-class="bg-success-light"
    />
  </div>
</template>
