<script setup lang="ts">
import { computed } from 'vue';
import { AppHeader } from '@/widgets/header';
import { UIcon, UToggle } from '@/shared/ui';
import { QuickActionModal, useQuickActions } from '@/features/configure-quick-action';
import { useAccounts, type AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useCategories } from '@/entities/category';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';

const { userId } = useCurrentUser();
const { accounts } = useAccounts(userId);
const { expenseCategories, getCategoryById } = useCategories(userId);
const { slots, editingAction, showModal, handleSave, handleDelete, hidden, toggleHidden } =
  useQuickActions(userId);

const accountMap = computed(() => {
  const map = new Map<string, AccountWithBalances>();
  for (const a of accounts.value ?? []) map.set(a.id, a);
  return map;
});

function handleSlotClick(action: (typeof slots.value)[number]) {
  editingAction.value = action;
  showModal.value = true;
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-y-auto"
  >
    <AppHeader title="Быстрые действия" show-back @back="navigateBack" />

    <main class="px-5 pt-6 pb-28 space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Настройте до 6 быстрых кнопок на главном экране. Каждая кнопка открывает добавление расхода
        с выбранной категорией и счётом, или создаёт транзакцию мгновенно, если указана сумма.
      </p>

      <!-- Visibility toggle -->
      <div
        class="w-full flex items-center justify-between p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark"
      >
        <div class="flex items-center gap-3">
          <UIcon
            :name="hidden ? 'visibility_off' : 'visibility'"
            size="sm"
            class="text-text-secondary-light dark:text-text-secondary-dark"
          />
          <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
            Показывать на главной
          </span>
        </div>
        <UToggle
          :model-value="!hidden"
          aria-label="Показывать быстрые действия на главной"
          @update:model-value="toggleHidden"
        />
      </div>

      <div class="space-y-3">
        <button
          v-for="(action, index) in slots"
          :key="action?.id ?? `empty-${index}`"
          class="group w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all duration-200"
          @click="handleSlotClick(action)"
        >
          <template v-if="action">
            <div
              class="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
              :style="{
                backgroundColor: (getCategoryById(action.categoryId)?.color ?? '#64748b') + '26',
              }"
            >
              <UIcon
                :name="getCategoryById(action.categoryId)?.icon ?? 'receipt_long'"
                size="sm"
                :style="{
                  color: getCategoryById(action.categoryId)?.color ?? '#64748b',
                }"
              />
            </div>
            <div class="flex-1 text-left">
              <p
                class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark group-hover:text-primary transition-colors"
              >
                {{ action.label }}
              </p>
              <div
                class="flex items-center gap-1.5 mt-0.5 text-text-secondary-light dark:text-text-secondary-dark"
              >
                <UIcon name="account_balance_wallet" size="xs" class="opacity-70" />
                <p class="text-sm font-medium">
                  {{ accountMap.get(action.accountId)?.name || 'Счёт не найден' }}
                </p>
              </div>
              <div
                v-if="action.amount != null"
                class="flex items-center gap-1.5 mt-0.5 text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <UIcon name="payments" size="xs" class="opacity-70" />
                <p class="text-sm font-medium">
                  {{
                    formatCurrency(
                      action.amount ?? 0,
                      accountMap.get(action.accountId)?.balances[0]?.currency ?? 'USD',
                    )
                  }}
                </p>
              </div>
            </div>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark group-hover:translate-x-1 transition-all"
            />
          </template>
          <template v-else>
            <div
              class="w-12 h-12 shrink-0 rounded-xl bg-surface-light dark:bg-surface-dark border-2 border-dashed border-border-light dark:border-border-dark flex items-center justify-center transition-colors group-hover:border-primary/50 group-hover:bg-primary/5"
            >
              <UIcon
                name="add"
                size="sm"
                class="text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-primary transition-colors"
              />
            </div>
            <span
              class="text-sm font-medium text-text-tertiary-light dark:text-text-tertiary-dark group-hover:text-text-secondary-light dark:group-hover:text-text-secondary-dark transition-colors"
            >
              Настроить слот {{ index + 1 }}
            </span>
          </template>
        </button>
      </div>
    </main>

    <QuickActionModal
      v-model="showModal"
      :accounts="accounts"
      :expense-categories="expenseCategories"
      :edit-action="editingAction"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>
