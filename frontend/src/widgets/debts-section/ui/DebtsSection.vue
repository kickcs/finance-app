<script setup lang="ts">
import { computed } from 'vue';
import {
  DebtCardSkeleton,
  type Debt,
  DEBT_DIRECTION_COLORS,
} from '@/entities/debt';
import { UIcon, UButton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
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
}>();

const emit = defineEmits<{
  'debt-click': [debt: Debt];
  'person-click': [personName: string, debtType: 'given' | 'taken'];
  'add-click': [];
  'view-all': [];
}>();

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
    grouped[key].totalRemaining += convert(
      debt.remaining_amount,
      debt.currency || 'UZS',
    );

    if (debt.next_payment_date) {
      if (
        !grouped[key].nearestDueDate ||
        new Date(debt.next_payment_date) <
          new Date(grouped[key].nearestDueDate!)
      ) {
        grouped[key].nearestDueDate = debt.next_payment_date;
      }
    }
  }

  return Object.values(grouped).sort((a, b) => {
    if (a.debtType !== b.debtType) {
      return a.debtType === 'given' ? -1 : 1;
    }
    if (a.nearestDueDate && b.nearestDueDate) {
      return (
        new Date(a.nearestDueDate).getTime() -
        new Date(b.nearestDueDate).getTime()
      );
    }
    if (a.nearestDueDate) return -1;
    if (b.nearestDueDate) return 1;
    return 0;
  });
});

const totalGivenDebts = computed(() => {
  return activeDebts.value
    .filter((d) => d.debt_type === 'given')
    .reduce(
      (sum, d) => sum + convert(d.remaining_amount, d.currency || 'UZS'),
      0,
    );
});

const totalTakenDebts = computed(() => {
  return activeDebts.value
    .filter((d) => d.debt_type === 'taken')
    .reduce(
      (sum, d) => sum + convert(d.remaining_amount, d.currency || 'UZS'),
      0,
    );
});

const overdueCount = computed(() => {
  const now = new Date();
  return activeDebts.value.filter(
    (d) => d.next_payment_date && new Date(d.next_payment_date) < now,
  ).length;
});

function isOverdue(date: string | null): boolean {
  if (!date) return false;
  return new Date(date) < new Date();
}
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h2
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
        >
          Долги
        </h2>
        <span
          v-if="overdueCount > 0"
          class="px-1.5 py-0.5 text-xs font-semibold rounded-md bg-danger text-white"
        >
          {{ overdueCount }}
        </span>
      </div>
      <div class="flex items-center gap-1">
        <UButton variant="ghost" size="xs" @click="$emit('add-click')">
          <UIcon name="add" size="xs" />
        </UButton>
        <UButton
          v-if="activeDebts.length > 0"
          variant="ghost"
          size="xs"
          @click="$emit('view-all')"
        >
          <UIcon name="chevron_right" size="xs" />
        </UButton>
      </div>
    </div>

    <!-- Summary -->
    <div
      v-if="activeDebts.length > 0 && !loading"
      class="grid grid-cols-2 gap-2"
    >
      <div
        class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-light dark:bg-surface-dark"
      >
        <span
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >Вам</span
        >
        <span class="text-xs font-semibold text-warning">
          {{ formatCurrency(totalGivenDebts, currency) }}
        </span>
      </div>
      <div
        class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-light dark:bg-surface-dark"
      >
        <span
          class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >Вы</span
        >
        <span class="text-xs font-semibold text-cat-entertainment">
          {{ formatCurrency(totalTakenDebts, currency) }}
        </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="space-y-2">
      <DebtCardSkeleton v-for="i in 2" :key="i" />
    </div>

    <!-- Debts List -->
    <TransitionGroup
      v-else-if="debtsByPerson.length > 0"
      name="debt-list"
      tag="div"
      class="space-y-2"
    >
      <button
        v-for="(group, index) in debtsByPerson.slice(0, 3)"
        :key="`${group.personName}_${group.debtType}`"
        class="w-full p-3 rounded-xl text-left bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80 transition-all duration-150 animate-fadeInUp"
        :style="{ animationDelay: `${index * 0.03}s` }"
        @click="handleGroupClick(group)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              :style="{
                backgroundColor: `${DEBT_DIRECTION_COLORS[group.debtType]}12`,
              }"
            >
              <UIcon
                :name="
                  group.debtType === 'given' ? 'arrow_upward' : 'arrow_downward'
                "
                size="xs"
                :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
              />
            </div>
            <div class="min-w-0">
              <p
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ group.personName }}
              </p>
              <div class="flex items-center gap-1">
                <span
                  class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  {{ group.debtType === 'given' ? 'Вам должен' : 'Вы должны' }}
                </span>
                <span
                  v-if="group.debts.length > 1"
                  class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
                >
                  · {{ group.debts.length }}
                </span>
              </div>
            </div>
          </div>

          <div class="text-right shrink-0">
            <p
              class="text-sm font-semibold"
              :style="{ color: DEBT_DIRECTION_COLORS[group.debtType] }"
            >
              {{ formatCurrency(group.totalRemaining, currency) }}
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
          </div>
        </div>
      </button>
    </TransitionGroup>

    <!-- Empty state -->
    <div
      v-else
      class="py-8 text-center rounded-xl border border-border-light dark:border-border-dark border-dashed"
    >
      <div
        class="w-10 h-10 mx-auto mb-2 rounded-lg bg-success-light flex items-center justify-center"
      >
        <UIcon name="check_circle" size="md" class="text-success" />
      </div>
      <p class="text-sm font-medium text-success mb-0.5">Вы без долгов!</p>
      <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
        Отличная финансовая дисциплина
      </p>
    </div>
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
