<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon, UCard, UToggle } from '@/shared/ui';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useHaptics } from '@/shared/lib/haptics';
import DebtPaymentTimeline from './DebtPaymentTimeline.vue';
import DebtHero from './DebtHero.vue';
import type { Debt, Transaction } from '@/shared/api/database.types';
import type { AccountWithBalances } from '@/entities/account';

const props = defineProps<{
  debt: Debt;
  transactions: Transaction[];
  accounts: AccountWithBalances[];
  transactionsLoading: boolean;
}>();

// Редактирование живёт в шапке хоста (страница или панель) — сюда оно не приходит
const emit = defineEmits<{
  payment: [];
  delete: [];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

function handlePayment() {
  trigger('selection');
  emit('payment');
}

function handleDelete() {
  trigger('selection');
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

// Мета-карточку не рисуем вовсе, если обеих ячеек нет — иначе висела бы пустая рамка
const hasMeta = computed(() => !!props.debt.next_payment_date || !!linkedAccount.value);
</script>

<template>
  <div class="space-y-4">
    <DebtHero :debt="debt" />

    <!-- «Редактировать» и «Ещё» переехали в шапку страницы -->
    <UButton
      v-if="!debt.is_closed"
      variant="primary"
      size="lg"
      full-width
      data-testid="payment-btn"
      @click="handlePayment"
    >
      <UIcon name="payments" size="sm" class="mr-1.5" />
      Внести платёж
    </UButton>

    <div v-if="debt.description" class="px-1">
      <p class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark mb-1">
        Комментарий
      </p>
      <p class="text-body-sm text-text-primary-light dark:text-text-primary-dark">
        {{ debt.description }}
      </p>
    </div>

    <!-- Мета-строка: только то, что не сказано герой/тайм-лайном (валюта — у каждой суммы, тип — эйбрау в герое, дата создания — первый узел тайм-лайна) -->
    <UCard v-if="hasMeta" variant="bordered" class="p-4">
      <div class="grid grid-cols-2 gap-4">
        <div v-if="debt.next_payment_date">
          <p
            class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
          >
            Дата возврата
          </p>
          <p
            class="text-body-sm"
            :class="
              isOverdue ? 'text-danger' : 'text-text-primary-light dark:text-text-primary-dark'
            "
          >
            {{ formatDate(debt.next_payment_date, { format: 'short' }) }}
          </p>
        </div>

        <div v-if="linkedAccount">
          <p
            class="text-caption-sm font-semibold uppercase tracking-wider text-text-tertiary-light dark:text-text-tertiary-dark mb-1"
          >
            Счёт
          </p>
          <p
            class="flex items-center gap-2 text-body-sm text-text-primary-light dark:text-text-primary-dark"
          >
            <span
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ backgroundColor: linkedAccount.color }"
            />
            <span class="truncate">{{ linkedAccount.name }}</span>
          </p>
        </div>
      </div>
    </UCard>

    <DebtPaymentTimeline
      :debt="debt"
      :transactions="transactions"
      :is-loading="transactionsLoading"
    />

    <!-- У закрытого долга нет меню «···» в шапке, а скрытую сумму всё равно надо уметь
         вернуть обратно — переключатель и удаление живут одной карточкой прямо здесь -->
    <UCard v-if="debt.is_closed" variant="bordered" class="p-1">
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
    </UCard>
  </div>
</template>
