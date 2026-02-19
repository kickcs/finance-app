<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { UButton, UIcon, UCard, UProgressBar, USpinner, NotFoundState } from '@/shared/ui';
import { AppHeader } from '@/widgets/header';
import { formatCurrency } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import {
  useDebts,
  DEBT_DIRECTION_LABELS,
  DEBT_DIRECTION_COLORS,
  type Debt,
} from '@/entities/debt';
import { useAccounts } from '@/entities/account';
import {
  CloseDebtModal,
  DeleteDebtModal,
  useCloseDebt,
} from '@/features/close-debt';
import {
  PartialPaymentModal,
  usePartialPayment,
} from '@/features/partial-payment';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const router = useRouter();
const route = useRoute();
const { userId } = useCurrentUser();
const debtId = computed(() => route.params.id as string);

// Get debts and accounts
const { debts, isLoading } = useDebts(userId);
const { accounts } = useAccounts(userId);

// Find current debt
const debt = computed<Debt | null>(() => {
  return debts.value.find((d) => d.id === debtId.value) ?? null;
});

// Use debt's own currency
const debtCurrency = computed(() => debt.value?.currency || 'UZS');

// Find linked account
const linkedAccount = computed(() => {
  if (!debt.value?.account_id) return null;
  return accounts.value.find((a) => a.id === debt.value!.account_id) ?? null;
});

// Calculate progress
const progress = computed(() => {
  if (!debt.value) return 0;
  const paid = debt.value.total_amount - debt.value.remaining_amount;
  return Math.round((paid / debt.value.total_amount) * 100);
});

// Modal states
const showCloseModal = ref(false);
const showDeleteModal = ref(false);
const showPartialPaymentModal = ref(false);

// Close debt logic
const { isClosing, isDeleting, closeDebt, deleteDebt } = useCloseDebt();

// Partial payment logic
const { isPaying, makePartialPayment } = usePartialPayment();

async function handleCloseDebt() {
  if (!debt.value || !userId.value) return;

  const success = await closeDebt(debt.value, userId.value);
  if (success) {
    showCloseModal.value = false;
    router.push({ name: 'dashboard' });
  }
}

async function handleDeleteDebt() {
  if (!debt.value || !userId.value) return;

  const success = await deleteDebt(debt.value, userId.value);
  if (success) {
    showDeleteModal.value = false;
    router.push({ name: 'dashboard' });
  }
}

async function handlePartialPayment(amount: number, accountId: string) {
  if (!debt.value || !userId.value) return;

  const success = await makePartialPayment(
    debt.value,
    amount,
    accountId,
    userId.value,
  );
  if (success) {
    showPartialPaymentModal.value = false;
  }
}

function goBack() {
  navigateBack();
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <!-- Header -->
    <AppHeader :title="debt?.person_name || debt?.name || 'Долг'" show-back blur @back="goBack" />

    <!-- Content -->
    <main class="px-5 pt-8 pb-6">
      <!-- Loading State -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <USpinner />
      </div>

      <!-- Not Found State -->
      <NotFoundState v-else-if="!debt" message="Долг не найден" />

      <!-- Debt Details -->
      <div v-else class="space-y-6">
        <!-- Main Card -->
        <UCard class="p-5">
          <div class="flex items-start gap-4">
            <!-- Icon -->
            <div
              class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              :style="{
                backgroundColor: `${DEBT_DIRECTION_COLORS[debt.debt_type]}20`,
              }"
            >
              <UIcon
                :name="
                  debt.debt_type === 'given' ? 'arrow_upward' : 'arrow_downward'
                "
                size="lg"
                :style="{ color: DEBT_DIRECTION_COLORS[debt.debt_type] }"
              />
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <p
                class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark truncate"
              >
                {{ debt.person_name || debt.name }}
              </p>
              <p
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ DEBT_DIRECTION_LABELS[debt.debt_type] }}
              </p>
            </div>

            <!-- Closed Badge -->
            <span
              v-if="debt.is_closed"
              class="px-3 py-1 rounded-full text-xs font-medium bg-success/10 text-success"
            >
              Погашен
            </span>
          </div>

          <!-- Amount -->
          <div
            class="mt-6 pt-6 border-t border-border-light dark:border-border-dark"
          >
            <div class="flex justify-between items-end mb-3">
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                {{ debt.is_closed ? 'Сумма' : 'Осталось' }}
              </span>
              <span
                class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark"
              >
                {{ formatCurrency(debt.remaining_amount, debtCurrency) }}
              </span>
            </div>

            <!-- Paid Amount (if partially paid) -->
            <div
              v-if="debt.remaining_amount < debt.total_amount"
              class="flex justify-between items-center mt-2"
            >
              <span
                class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
              >
                Уже выплачено
              </span>
              <span class="text-sm font-medium text-success">
                {{
                  formatCurrency(
                    debt.total_amount - debt.remaining_amount,
                    debtCurrency,
                  )
                }}
              </span>
            </div>

            <!-- Progress (only if not closed) -->
            <div
              v-if="
                !debt.is_closed && debt.remaining_amount < debt.total_amount
              "
              class="space-y-2 mt-3"
            >
              <UProgressBar
                :value="progress"
                :color="DEBT_DIRECTION_COLORS[debt.debt_type]"
              />
              <div
                class="flex justify-between text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <span>Погашено {{ progress }}%</span>
                <span
                  >Всего:
                  {{ formatCurrency(debt.total_amount, debtCurrency) }}</span
                >
              </div>
            </div>
          </div>
        </UCard>

        <!-- Details Card -->
        <UCard variant="default" class="p-5 space-y-4">
          <!-- Linked Account -->
          <div v-if="linkedAccount" class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Счёт
            </span>
            <div class="flex items-center gap-2">
              <span
                class="w-3 h-3 rounded-full"
                :style="{ backgroundColor: linkedAccount.color }"
              />
              <span
                class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
              >
                {{ linkedAccount.name }}
              </span>
            </div>
          </div>

          <!-- Original Amount -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Исходная сумма
            </span>
            <span
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ formatCurrency(debt.total_amount, debtCurrency) }}
            </span>
          </div>

          <!-- Currency -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Валюта
            </span>
            <span
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ debtCurrency }}
            </span>
          </div>

          <!-- Type -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Тип
            </span>
            <span
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ debt.debt_type === 'given' ? 'Вам должны' : 'Вы должны' }}
            </span>
          </div>

          <!-- Due Date -->
          <div
            v-if="debt.next_payment_date"
            class="flex items-center justify-between"
          >
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Дата возврата
            </span>
            <span
              class="text-sm font-medium"
              :class="
                new Date(debt.next_payment_date) < new Date() && !debt.is_closed
                  ? 'text-danger'
                  : 'text-text-primary-light dark:text-text-primary-dark'
              "
            >
              {{ formatDate(debt.next_payment_date, { format: 'short' }) }}
              <span
                v-if="
                  new Date(debt.next_payment_date) < new Date() &&
                  !debt.is_closed
                "
                class="text-xs"
              >
                (просрочено)
              </span>
            </span>
          </div>

          <!-- Created Date -->
          <div class="flex items-center justify-between">
            <span
              class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
            >
              Дата создания
            </span>
            <span
              class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
            >
              {{ formatDate(debt.created_at, { format: 'short' }) }}
            </span>
          </div>
        </UCard>

        <!-- Actions (only if not closed) -->
        <div v-if="!debt.is_closed" class="space-y-3">
          <UButton
            variant="secondary"
            size="lg"
            full-width
            @click="showPartialPaymentModal = true"
          >
            <UIcon name="payments" size="sm" class="mr-2" />
            Внести платёж
          </UButton>

          <UButton
            variant="primary"
            size="xl"
            full-width
            @click="showCloseModal = true"
          >
            <UIcon name="check_circle" size="sm" class="mr-2" />
            Закрыть долг
          </UButton>

          <UButton
            variant="ghost"
            size="lg"
            full-width
            class="text-danger"
            @click="showDeleteModal = true"
          >
            <UIcon name="delete" size="sm" class="mr-2" />
            Удалить долг
          </UButton>
        </div>

        <!-- Delete Button for Closed Debts -->
        <div v-else>
          <UButton
            variant="ghost"
            size="lg"
            full-width
            class="text-danger"
            @click="showDeleteModal = true"
          >
            <UIcon name="delete" size="sm" class="mr-2" />
            Удалить долг
          </UButton>
        </div>
      </div>
    </main>

    <!-- Close Debt Modal -->
    <CloseDebtModal
      v-model="showCloseModal"
      :debt="debt"
      :currency="debtCurrency"
      :is-closing="isClosing"
      @confirm="handleCloseDebt"
    />

    <!-- Delete Debt Modal -->
    <DeleteDebtModal
      v-model="showDeleteModal"
      :debt="debt"
      :currency="debtCurrency"
      :is-deleting="isDeleting"
      @confirm="handleDeleteDebt"
    />

    <!-- Partial Payment Modal -->
    <PartialPaymentModal
      v-model="showPartialPaymentModal"
      :debt="debt"
      :accounts="accounts"
      :is-paying="isPaying"
      @confirm="handlePartialPayment"
    />
  </div>
</template>
