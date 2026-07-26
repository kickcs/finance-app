<script setup lang="ts">
import { computed, ref } from 'vue';
import { UButton, UIcon, UCard, UToggle } from '@/shared/ui';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useHaptics } from '@/shared/lib/haptics';
import { DEBT_DIRECTION_DISPLAY } from '../model/types';
import DebtPaymentTimeline from './DebtPaymentTimeline.vue';
import DebtHero from './DebtHero.vue';
import DebtAmountBreakdown from './DebtAmountBreakdown.vue';
import type { Debt, Transaction } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  debt: Debt;
  transactions: Transaction[];
  accounts: AccountWithBalances[];
  transactionsLoading: boolean;
}>();

const emit = defineEmits<{
  payment: [];
  edit: [];
  delete: [];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

const isMenuOpen = ref(false);

function handlePayment() {
  trigger('selection');
  emit('payment');
}

function handleEdit() {
  trigger('selection');
  isMenuOpen.value = false;
  emit('edit');
}

function handleDelete() {
  trigger('selection');
  isMenuOpen.value = false;
  emit('delete');
}

function handleTogglePrivate(value: boolean) {
  trigger('selection');
  emit('toggle-private', value);
}

const linkedAccount = computed(() => {
  if (!props.debt.account_id) return null;
  return props.accounts.find((a) => a.id === props.debt.account_id) ?? null;
});

const isOverdue = computed(
  () =>
    !props.debt.is_closed &&
    !!props.debt.next_payment_date &&
    isPastDate(props.debt.next_payment_date),
);
</script>

<template>
  <div class="space-y-4">
    <DebtHero :debt="debt" />

    <!-- Действия сразу под шапкой: главное действие не должно ждать прокрутки -->
    <div v-if="!debt.is_closed" class="flex items-center gap-2">
      <UButton
        variant="primary"
        size="lg"
        class="flex-1"
        data-testid="payment-btn"
        @click="handlePayment"
      >
        <UIcon name="payments" size="sm" class="mr-1.5" />
        Внести платёж
      </UButton>
      <UButton variant="secondary" size="lg" aria-label="Редактировать" @click="handleEdit">
        <UIcon name="edit" size="sm" />
      </UButton>
      <UButton
        variant="ghost"
        size="lg"
        aria-label="Ещё"
        aria-controls="debt-more-menu"
        :aria-expanded="isMenuOpen"
        data-testid="debt-more-btn"
        @click="(trigger('selection'), (isMenuOpen = !isMenuOpen))"
      >
        <UIcon name="more_horiz" size="sm" />
      </UButton>
    </div>

    <div
      v-if="isMenuOpen && !debt.is_closed"
      id="debt-more-menu"
      class="rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark p-1"
    >
      <div class="flex items-center justify-between gap-4 px-3 py-2.5">
        <span class="flex items-center gap-2.5">
          <UIcon
            name="visibility_off"
            size="sm"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          />
          <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
            Скрыть сумму
          </span>
        </span>
        <UToggle :model-value="debt.is_private" @update:model-value="handleTogglePrivate" />
      </div>

      <button
        type="button"
        data-testid="delete-debt-btn"
        class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-body-sm text-danger transition-colors hover:bg-surface-light dark:hover:bg-surface-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
        @click="handleDelete"
      >
        <UIcon name="delete" size="sm" />
        Удалить долг
      </button>
    </div>

    <DebtAmountBreakdown :debt="debt" />

    <div
      v-if="debt.description"
      class="p-4 bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl"
    >
      <p
        class="text-caption font-medium text-text-tertiary-light dark:text-text-tertiary-dark mb-1.5"
      >
        Комментарий
      </p>
      <p class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
        {{ debt.description }}
      </p>
    </div>

    <DebtPaymentTimeline
      :debt="debt"
      :transactions="transactions"
      :is-loading="transactionsLoading"
    />

    <!-- Технические детали вторичны, поэтому внизу и тише -->
    <UCard variant="bordered" class="p-5 space-y-3">
      <div class="flex items-center justify-between gap-4">
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Валюта
        </span>
        <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
          {{ debt.currency }}
        </span>
      </div>

      <div class="flex items-center justify-between gap-4">
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Тип долга
        </span>
        <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
          {{ DEBT_DIRECTION_DISPLAY[debt.debt_type] }}
        </span>
      </div>

      <div v-if="linkedAccount" class="flex items-center justify-between gap-4">
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">Счёт</span>
        <span class="flex items-center gap-2">
          <span
            class="h-2.5 w-2.5 rounded-full"
            :style="{ backgroundColor: linkedAccount.color }"
          />
          <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
            {{ linkedAccount.name }}
          </span>
        </span>
      </div>

      <div v-if="debt.next_payment_date" class="flex items-center justify-between gap-4">
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Дата возврата
        </span>
        <span
          class="text-body-sm"
          :class="isOverdue ? 'text-danger' : 'text-text-primary-light dark:text-text-primary-dark'"
        >
          {{ formatDate(debt.next_payment_date, { format: 'short' }) }}
        </span>
      </div>

      <div class="flex items-center justify-between gap-4">
        <span class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark">
          Дата создания
        </span>
        <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
          {{ formatDate(debt.created_at, { format: 'short' }) }}
        </span>
      </div>
    </UCard>

    <!-- У закрытого долга нет меню «···», а скрытую сумму всё равно надо уметь
         вернуть обратно — поэтому переключатель дублируется прямо на странице -->
    <div
      v-if="debt.is_closed"
      class="flex items-center justify-between gap-4 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark px-4 py-3"
    >
      <span class="flex items-center gap-2.5">
        <UIcon
          name="visibility_off"
          size="sm"
          class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <span class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
          Скрыть сумму
        </span>
      </span>
      <UToggle :model-value="debt.is_private" @update:model-value="handleTogglePrivate" />
    </div>

    <UButton
      v-if="debt.is_closed"
      variant="ghost"
      size="lg"
      full-width
      class="text-danger"
      data-testid="delete-debt-btn"
      @click="handleDelete"
    >
      <UIcon name="delete" size="sm" class="mr-2" />
      Удалить долг
    </UButton>
  </div>
</template>
