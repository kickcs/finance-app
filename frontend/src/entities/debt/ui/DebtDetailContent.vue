<script setup lang="ts">
import { computed } from 'vue';
import { UButton, UIcon, UCard } from '@/shared/ui';
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

// Всё, кроме платежа, живёт в шапке хоста (страница или панель) и её шторке действий
const emit = defineEmits<{ payment: [] }>();

const { trigger } = useHaptics();

function handlePayment() {
  trigger('selection');
  emit('payment');
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
  </div>
</template>
