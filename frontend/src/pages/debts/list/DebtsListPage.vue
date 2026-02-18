<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { BottomNav } from '@/widgets/bottom-nav';
import { AppHeader } from '@/widgets/header';
import { DebtCard, useDebts, type Debt } from '@/entities/debt';
import { UButton, UIcon, UCard, Skeleton } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useExchangeRates } from '@/shared/api';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useUserCurrency } from '@/shared/lib/hooks/useUserCurrency';
import { listTransition } from '@/shared/lib/transitions';

const router = useRouter();
const route = useRoute();

const { userId } = useCurrentUser();
const { currency } = useUserCurrency();

// Exchange rates for converting debts to user's main currency
const { convert } = useExchangeRates(currency);

// Use real data from API
const { debts, debtsByPerson, isLoading } = useDebts(userId);

// Filter by person from query params
const personFilter = ref<string | null>(route.query.person as string | null);
const typeFilter = ref<'given' | 'taken' | null>(
  route.query.type as 'given' | 'taken' | null,
);

// View mode toggle: grouped by person or flat list
const viewMode = ref<'grouped' | 'flat'>(
  personFilter.value ? 'flat' : 'grouped',
);

// Clear filter when route changes
watch(
  () => route.query,
  (newQuery) => {
    personFilter.value = newQuery.person as string | null;
    typeFilter.value = newQuery.type as 'given' | 'taken' | null;
    if (personFilter.value) {
      viewMode.value = 'flat';
    }
  },
);

// Filter active debts
const activeDebts = computed(() => {
  let filtered = debts.value.filter((d) => !d.is_closed);

  // Apply person filter if set
  if (personFilter.value) {
    filtered = filtered.filter(
      (d) =>
        (d.person_name || d.name) === personFilter.value &&
        (!typeFilter.value || d.debt_type === typeFilter.value),
    );
  }

  return filtered;
});

// Clear filter
function clearFilter() {
  personFilter.value = null;
  typeFilter.value = null;
  router.replace({ path: '/debts' });
}

// Calculate totals - converted to main currency
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

function goBack() {
  navigateBack();
}

function handleDebtClick(debt: Debt) {
  router.push({ name: 'debt-detail', params: { id: debt.id } });
}

function handleAddDebt() {
  router.push({ name: 'new-debt' });
}

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader blur show-back title="Долги" @back="goBack">
      <template #actions>
        <UButton variant="ghost" size="sm" class="!p-2" @click="handleAddDebt">
          <UIcon name="add" size="sm" />
        </UButton>
      </template>
    </AppHeader>

    <!-- Content -->
    <main class="px-5 pt-8 space-y-6">
      <!-- Loading Skeleton -->
      <template v-if="isLoading">
        <div class="grid grid-cols-2 gap-3">
          <Skeleton class="h-20 rounded-2xl" />
          <Skeleton class="h-20 rounded-2xl" />
        </div>
        <div class="space-y-3">
          <Skeleton class="h-6 w-32" />
          <Skeleton class="h-16 rounded-xl" />
          <Skeleton class="h-16 rounded-xl" />
          <Skeleton class="h-16 rounded-xl" />
        </div>
      </template>

      <template v-else>
        <!-- Debt Summary Cards (converted to main currency) -->
        <div v-if="activeDebts.length > 0" class="grid grid-cols-2 gap-3">
          <!-- Given debts (people owe you) -->
          <UCard class="p-4">
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
            >
              Вам должны
            </p>
            <p class="text-lg font-bold text-debt-given">
              {{ formatCurrency(totalGivenDebts, currency) }}
            </p>
          </UCard>

          <!-- Taken debts (you owe others) -->
          <UCard class="p-4">
            <p
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
            >
              Вы должны
            </p>
            <p class="text-lg font-bold text-debt-received">
              {{ formatCurrency(totalTakenDebts, currency) }}
            </p>
          </UCard>
        </div>

        <!-- Debts List -->
        <div class="space-y-3">
          <!-- Filter indicator -->
          <div v-if="personFilter" class="flex items-center gap-2 px-1">
            <div
              class="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
            >
              <span>{{ personFilter }}</span>
              <button
                type="button"
                class="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30"
                @click="clearFilter"
              >
                <UIcon name="close" size="xs" />
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between px-1">
            <h2
              class="text-lg font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              {{ personFilter ? `Долги: ${personFilter}` : 'Активные долги' }}
            </h2>
            <!-- View Mode Toggle (hidden when filtering by person) -->
            <div
              v-if="activeDebts.length > 0 && !personFilter"
              class="flex gap-1 bg-surface-light dark:bg-surface-dark rounded-lg p-1"
            >
              <button
                type="button"
                class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                :class="
                  viewMode === 'grouped'
                    ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                "
                @click="viewMode = 'grouped'"
              >
                По людям
              </button>
              <button
                type="button"
                class="px-3 py-1 text-sm font-medium rounded-md transition-colors"
                :class="
                  viewMode === 'flat'
                    ? 'bg-card-light dark:bg-card-dark text-text-primary-light dark:text-text-primary-dark shadow-sm'
                    : 'text-text-secondary-light dark:text-text-secondary-dark'
                "
                @click="viewMode = 'flat'"
              >
                Все
              </button>
            </div>
          </div>

          <!-- Grouped View (by person) -->
          <div
            v-if="activeDebts.length > 0 && viewMode === 'grouped'"
            class="space-y-4"
          >
            <div
              v-for="group in debtsByPerson"
              :key="group.personName"
              class="space-y-2"
            >
              <!-- Person Header -->
              <div class="flex items-center justify-between px-1">
                <div class="flex items-center gap-2">
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center"
                    :class="
                      group.debtType === 'given'
                        ? 'bg-debt-given-light'
                        : 'bg-debt-received-light'
                    "
                  >
                    <UIcon
                      name="person"
                      size="sm"
                      :class="
                        group.debtType === 'given'
                          ? 'text-debt-given'
                          : 'text-debt-received'
                      "
                    />
                  </div>
                  <div>
                    <p
                      class="font-semibold text-text-primary-light dark:text-text-primary-dark"
                    >
                      {{ group.personName }}
                    </p>
                    <p
                      class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
                    >
                      {{
                        group.debtType === 'given' ? 'Вам должны' : 'Вы должны'
                      }}
                    </p>
                  </div>
                </div>
                <div class="text-right">
                  <p
                    class="font-bold"
                    :class="
                      group.debtType === 'given'
                        ? 'text-debt-given'
                        : 'text-debt-received'
                    "
                  >
                    {{ formatCurrency(group.totalRemaining, currency) }}
                  </p>
                  <p v-if="group.totalPaid > 0" class="text-xs text-success">
                    Выплачено: {{ formatCurrency(group.totalPaid, currency) }}
                  </p>
                </div>
              </div>

              <!-- Debts for this person -->
              <div class="space-y-2 ml-10">
                <DebtCard
                  v-for="debt in group.debts"
                  :key="debt.id"
                  :debt="debt"
                  compact
                  @click="handleDebtClick(debt)"
                />
              </div>
            </div>
          </div>

          <!-- Flat View (all debts) -->
          <TransitionGroup
            v-else-if="activeDebts.length > 0 && viewMode === 'flat'"
            tag="div"
            class="space-y-2"
            :enter-active-class="listTransition.enterActiveClass"
            :leave-active-class="listTransition.leaveActiveClass"
            :enter-from-class="listTransition.enterFromClass"
            :leave-to-class="listTransition.leaveToClass"
            :move-class="listTransition.moveClass"
          >
            <DebtCard
              v-for="debt in activeDebts"
              :key="debt.id"
              :debt="debt"
              @click="handleDebtClick(debt)"
            />
          </TransitionGroup>

          <!-- Empty State -->
          <div
            v-else
            class="py-12 text-center bg-card-light dark:bg-card-dark rounded-2xl"
          >
            <div
              class="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center"
            >
              <UIcon name="celebration" size="lg" class="text-success" />
            </div>
            <p
              class="text-text-secondary-light dark:text-text-secondary-dark mb-4 font-semibold"
            >
              Вы без долгов!
            </p>
            <p
              class="text-text-tertiary-light dark:text-text-tertiary-dark mb-4 text-sm"
            >
              Отличная финансовая дисциплина
            </p>
            <UButton variant="primary" @click="handleAddDebt">
              <UIcon name="add" size="sm" class="mr-1" />
              Создать долг
            </UButton>
          </div>
        </div>
      </template>
    </main>

    <!-- Bottom Navigation -->
    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
