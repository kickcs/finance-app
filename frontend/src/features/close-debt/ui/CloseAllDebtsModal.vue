<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon, UProgressBar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import { AccountSelector, type AccountWithBalances } from '@/entities/account';
import type { Debt } from '@/shared/api/database.types';

const props = defineProps<{
  modelValue: boolean;
  debts: Debt[];
  personName: string;
  accounts: AccountWithBalances[];
  isClosing?: boolean;
  progress?: number;
  total?: number;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [accountId: string];
}>();

const selectedAccountId = ref<string | null>(null);

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      const linkedAccountId = props.debts.find((d) => d.account_id)?.account_id;
      selectedAccountId.value = linkedAccountId || props.accounts[0]?.id || null;
    }
  },
);

// Group totals by currency
const totalsByCurrency = computed(() => {
  const map = new Map<string, number>();
  for (const debt of props.debts) {
    const currency = debt.currency || 'UZS';
    map.set(currency, (map.get(currency) || 0) + debt.remaining_amount);
  }
  return Array.from(map.entries()).map(([currency, amount]) => ({ currency, amount }));
});

const debtDirection = computed(() => {
  return props.debts[0]?.debt_type === 'given' ? 'given' : 'taken';
});

const isValid = computed(() => !!selectedAccountId.value && props.debts.length > 0);

const progressPercent = computed(() => {
  if (!props.total || props.total === 0) return 0;
  return ((props.progress || 0) / props.total) * 100;
});

const accountLabel = computed(() => {
  return debtDirection.value === 'given' ? 'Куда зачислить' : 'С какого счёта списать';
});

function close() {
  if (!props.isClosing) {
    emit('update:modelValue', false);
  }
}

function confirm() {
  if (isValid.value && selectedAccountId.value) {
    emit('confirm', selectedAccountId.value);
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="`Закрыть все долги — ${personName}`"
    @update:model-value="close"
  >
    <div class="space-y-4">
      <!-- Progress state -->
      <div v-if="isClosing" class="space-y-3">
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <UIcon name="refresh" size="sm" class="text-primary animate-spin" />
            </div>
            <div>
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Закрываем долги...
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {{ progress }} из {{ total }}
              </p>
            </div>
          </div>
          <UProgressBar :value="progressPercent" color="primary" size="sm" />
        </div>
      </div>

      <!-- Normal state -->
      <template v-else>
        <!-- Debts summary -->
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark space-y-3">
          <div class="flex items-center gap-2 mb-1">
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center"
              :class="debtDirection === 'given' ? 'bg-debt-given-light' : 'bg-debt-received-light'"
            >
              <UIcon
                name="person"
                size="sm"
                :class="debtDirection === 'given' ? 'text-debt-given' : 'text-debt-received'"
              />
            </div>
            <div>
              <p class="font-semibold text-text-primary-light dark:text-text-primary-dark">
                {{ personName }}
              </p>
              <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                {{ debtDirection === 'given' ? 'Вам должны' : 'Вы должны' }}
                · {{ debts.length }} {{ pluralize(debts.length, 'долг', 'долга', 'долгов') }}
              </p>
            </div>
          </div>

          <!-- Individual debts -->
          <div class="space-y-2 pt-2 border-t border-border-light dark:border-border-dark">
            <div
              v-for="debt in debts"
              :key="debt.id"
              class="flex items-center justify-between"
            >
              <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark truncate mr-2">
                {{ debt.name }}
              </span>
              <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark whitespace-nowrap">
                {{ formatCurrency(debt.remaining_amount, debt.currency || 'UZS') }}
              </span>
            </div>
          </div>

          <!-- Total -->
          <div class="pt-2 border-t border-border-light dark:border-border-dark">
            <div
              v-for="item in totalsByCurrency"
              :key="item.currency"
              class="flex items-center justify-between"
            >
              <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                Итого
              </span>
              <span
                class="text-base font-bold"
                :class="debtDirection === 'given' ? 'text-debt-given' : 'text-debt-received'"
              >
                {{ formatCurrency(item.amount, item.currency) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Account Selection -->
        <AccountSelector
          :accounts="accounts"
          :selected-id="selectedAccountId"
          :label="accountLabel"
          @select="selectedAccountId = $event"
        />

        <!-- Info -->
        <div class="p-4 rounded-xl bg-surface-light dark:bg-surface-dark">
          <div class="flex items-start gap-3">
            <UIcon
              name="info"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark mt-0.5 shrink-0"
            />
            <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
              Для каждого долга будет создана транзакция
              {{ debtDirection === 'given' ? 'зачисления' : 'списания' }}
              на выбранный счёт.
            </p>
          </div>
        </div>
      </template>
    </div>

    <template #actions>
      <template v-if="!isClosing">
        <UButton variant="secondary" full-width @click="close">Отмена</UButton>
        <UButton
          variant="primary"
          full-width
          :disabled="!isValid"
          @click="confirm"
        >
          Закрыть все
        </UButton>
      </template>
    </template>
  </UModal>
</template>
