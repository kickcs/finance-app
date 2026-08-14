<script setup lang="ts">
import { computed, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { UIcon, USpinner, UButton, UToggle } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { useDebts } from '../api/useDebts';
import { useDebtTransactions } from '../api/useDebtTransactions';
import { useAccounts } from '@/entities/account';
import { getDebtDisplayName } from '../model/types';
import DebtDetailContent from './DebtDetailContent.vue';

const props = defineProps<{
  debtId: string;
  userId: string;
}>();

const emit = defineEmits<{
  payment: [];
  edit: [];
  delete: [];
  'toggle-private': [value: boolean];
}>();

const { trigger } = useHaptics();

// Get debts and accounts
const { debts, isLoading } = useDebts(() => props.userId);
const { accounts } = useAccounts(() => props.userId);

// Load transactions for this debt
const { transactions, isLoading: transactionsLoading } = useDebtTransactions(
  computed(() => props.debtId),
);

// Find current debt
const debt = computed(() => {
  return debts.value.find((d) => d.id === props.debtId) ?? null;
});

/**
 * Своя строка-шапка: у панели нет `AppHeader`, куда детальная страница унесла
 * имя человека и второстепенные действия, — без неё панель осталась бы без
 * имени, редактирования и удаления вовсе.
 */
const menuRef = ref<HTMLElement | null>(null);
const isMenuOpen = ref(false);
onClickOutside(menuRef, () => (isMenuOpen.value = false));

function toggleMenu() {
  trigger('selection');
  isMenuOpen.value = !isMenuOpen.value;
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
</script>

<template>
  <div class="py-6">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <USpinner />
    </div>

    <!-- Not Found State -->
    <div
      v-else-if="!debt"
      class="flex flex-col items-center justify-center py-12 text-text-tertiary-light dark:text-text-tertiary-dark"
    >
      <UIcon name="error" size="lg" class="mb-2" />
      <p class="text-body-sm">Долг не найден</p>
    </div>

    <template v-else>
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2
          class="min-w-0 truncate text-h3 font-bold text-text-primary-light dark:text-text-primary-dark"
        >
          {{ debt.is_private ? '•••' : getDebtDisplayName(debt) }}
        </h2>

        <div v-if="!debt.is_closed" ref="menuRef" class="relative flex shrink-0 items-center gap-1">
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            aria-label="Редактировать"
            @click="handleEdit"
          >
            <UIcon name="edit" size="sm" />
          </UButton>
          <UButton
            variant="ghost"
            size="sm"
            class="!p-2"
            aria-label="Ещё"
            aria-controls="debt-panel-more-menu"
            :aria-expanded="isMenuOpen"
            data-testid="debt-panel-more-btn"
            @click="toggleMenu"
          >
            <UIcon name="more_horiz" size="sm" />
          </UButton>

          <div
            v-if="isMenuOpen"
            id="debt-panel-more-menu"
            class="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl bg-card-light dark:bg-card-dark border border-border-light dark:border-border-dark shadow-lg p-1"
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
        </div>
      </div>

      <DebtDetailContent
        :debt="debt"
        :transactions="transactions"
        :accounts="accounts"
        :transactions-loading="transactionsLoading"
        @payment="emit('payment')"
        @delete="emit('delete')"
        @toggle-private="emit('toggle-private', $event)"
      />
    </template>
  </div>
</template>
