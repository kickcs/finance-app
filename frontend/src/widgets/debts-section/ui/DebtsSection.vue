<script setup lang="ts">
import { computed, ref } from 'vue';
import { DebtCardSkeleton, type Debt, DEBT_DIRECTION_COLORS } from '@/entities/debt';
import { UBadge, UTabs, SectionHeader, IconBadge, EmptyState } from '@/shared/ui';
import { formatMasked } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { useExchangeRates } from '@/shared/api';

interface DebtByPerson {
  personName: string;
  debts: Debt[];
  totalRemaining: number;
  debtType: 'given' | 'taken';
  nearestDueDate: string | null;
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

const activeTab = ref('given');

const debtTabs = [
  { id: 'given', label: 'Вам должны' },
  { id: 'taken', label: 'Вы должны' },
];

function handleGroupClick(group: DebtByPerson) {
  if (group.debts.length === 1) {
    emit('debt-click', group.debts[0]);
  } else {
    emit('person-click', group.personName, group.debtType);
  }
}

const { convert } = useExchangeRates(computed(() => props.currency));

const activeDebts = computed(() => {
  return props.debts.filter((d) => !d.is_closed);
});

const debtsByPerson = computed<DebtByPerson[]>(() => {
  const grouped: Record<string, DebtByPerson> = {};

  for (const debt of activeDebts.value) {
    const personName = debt.person_name || debt.name || 'Без имени';
    const key = `${personName}_${debt.debt_type}`;

    if (!grouped[key]) {
      grouped[key] = {
        personName,
        debts: [],
        totalRemaining: 0,
        debtType: debt.debt_type,
        nearestDueDate: null,
      };
    }

    grouped[key].debts.push(debt);
    grouped[key].totalRemaining += convert(debt.remaining_amount, debt.currency || 'UZS');

    if (debt.next_payment_date) {
      if (
        !grouped[key].nearestDueDate ||
        new Date(debt.next_payment_date) < new Date(grouped[key].nearestDueDate!)
      ) {
        grouped[key].nearestDueDate = debt.next_payment_date;
      }
    }
  }

  return Object.values(grouped).sort((a, b) => {
    if (a.nearestDueDate && b.nearestDueDate) {
      return new Date(a.nearestDueDate).getTime() - new Date(b.nearestDueDate).getTime();
    }
    if (a.nearestDueDate) return -1;
    if (b.nearestDueDate) return 1;
    return 0;
  });
});

const filteredDebts = computed(() => {
  return debtsByPerson.value.filter((g) => g.debtType === activeTab.value);
});

const overdueCount = computed(() => {
  const now = new Date();
  return activeDebts.value.filter((d) => d.next_payment_date && new Date(d.next_payment_date) < now)
    .length;
});

function isOverdue(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      title="Долги"
      :count="activeDebts.length"
      show-view-all
      @add-click="$emit('add-click')"
      @view-all="$emit('view-all')"
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
      v-model="activeTab"
      :items="debtTabs"
      size="sm"
    />

    <!-- Loading state -->
    <div v-if="loading" class="space-y-2">
      <DebtCardSkeleton v-for="i in 2" :key="i" />
    </div>

    <!-- Filtered Debts List -->
    <TransitionGroup
      v-else-if="filteredDebts.length > 0"
      name="debt-list"
      tag="div"
      class="space-y-2"
    >
      <button
        v-for="group in filteredDebts.slice(0, 4)"
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
                {{ group.personName }}
              </p>
              <p
                v-if="group.nearestDueDate"
                class="text-xs"
                :class="
                  isOverdue(group.nearestDueDate)
                    ? 'text-danger font-medium'
                    : 'text-text-tertiary-light dark:text-text-tertiary-dark'
                "
              >
                {{
                  isOverdue(group.nearestDueDate)
                    ? 'Просрочено'
                    : formatDate(group.nearestDueDate, { format: 'short' })
                }}
              </p>
              <p v-else class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ group.debts.length > 1 ? `${group.debts.length} долга` : 'Без срока' }}
              </p>
            </div>
          </div>

          <p
            class="text-sm font-semibold shrink-0"
            :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
          >
            {{ formatMasked(group.totalRemaining, currency, hidden ?? false) }}
          </p>
        </div>
      </button>
    </TransitionGroup>

    <!-- Empty state for current tab -->
    <div v-else-if="activeDebts.length > 0" class="py-6 text-center">
      <p class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
        {{ activeTab === 'given' ? 'Нет долгов «вам должны»' : 'Нет долгов «вы должны»' }}
      </p>
    </div>

    <!-- Empty state — no debts at all -->
    <EmptyState
      v-else-if="!loading"
      variant="inline"
      icon="check_circle"
      title="Вы без долгов!"
      description="Отличная финансовая дисциплина"
      icon-bg-class="bg-success-light"
    />
  </div>
</template>

<style scoped>
.debt-list-enter-active,
.debt-list-leave-active {
  transition: all 0.15s ease;
}

.debt-list-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}

.debt-list-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.debt-list-move {
  transition: transform 0.15s ease;
}
</style>
