<script setup lang="ts">
import { computed, ref, watch, defineAsyncComponent } from 'vue';
import { AppHeader } from '@/widgets/header';
import { UIcon, UToggle } from '@/shared/ui';
import { QuickActionModal, useQuickActions, MAX_SLOTS } from '@/features/configure-quick-action';
import type { QuickAction } from '@/features/configure-quick-action';
import { useAccounts, type AccountWithBalances } from '@/entities/account';
import { formatCurrency } from '@/shared/lib/format/currency';
import { useCategories } from '@/entities/category';
import { navigateBack } from '@/app/router';
import { useCurrentUser } from '@/shared/lib/hooks/useCurrentUser';
import { useHaptics } from '@/shared/lib/haptics';

const draggable = defineAsyncComponent(() => import('vuedraggable'));

const { userId } = useCurrentUser();
const { accounts } = useAccounts(userId);
const { expenseCategories, getCategoryById } = useCategories(userId);
const {
  slots,
  editingAction,
  showModal,
  handleSave,
  handleDelete,
  hidden,
  toggleHidden,
  reorderActions,
} = useQuickActions(userId);

const { trigger } = useHaptics();

const accountMap = computed(() => {
  const map = new Map<string, AccountWithBalances>();
  for (const a of accounts.value ?? []) map.set(a.id, a);
  return map;
});

const DEFAULT_CAT = { icon: 'receipt_long', color: '#64748b' };

type ActionWithCat = QuickAction & { cat: { icon: string; color: string } };

const filledActions = computed<ActionWithCat[]>(() =>
  slots.value
    .filter((a): a is QuickAction => a !== null)
    .map((a) => ({ ...a, cat: getCategoryById(a.categoryId) ?? DEFAULT_CAT })),
);

const localActions = ref<ActionWithCat[]>([]);
watch(filledActions, (v) => (localActions.value = [...v]), { immediate: true });

const emptySlotCount = computed(() => MAX_SLOTS - localActions.value.length);

function handleSlotClick(action: QuickAction | null) {
  editingAction.value = action;
  showModal.value = true;
}

function handleDragStart() {
  trigger('selection');
}

async function handleDragEnd() {
  const ids = localActions.value.map((a) => a.id);
  try {
    await reorderActions(ids);
  } catch {
    // onError in mutation restores previous cache state
  }
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
        <draggable
          v-model="localActions"
          item-key="id"
          handle=".drag-handle"
          ghost-class="opacity-50"
          :animation="200"
          class="space-y-3"
          @start="handleDragStart"
          @end="handleDragEnd"
        >
          <template #item="{ element: action }">
            <button
              class="group w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all duration-200"
              @click="handleSlotClick(action)"
            >
              <div
                class="drag-handle cursor-grab active:cursor-grabbing touch-none px-0.5 -ml-1 py-2 text-text-tertiary-light dark:text-text-tertiary-dark"
              >
                <UIcon name="drag_indicator" size="sm" />
              </div>
              <div
                class="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                :style="{ backgroundColor: action.cat.color + '26' }"
              >
                <UIcon :name="action.cat.icon" size="sm" :style="{ color: action.cat.color }" />
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
            </button>
          </template>
        </draggable>

        <button
          v-for="i in emptySlotCount"
          :key="`empty-${i}`"
          class="group w-full flex items-center gap-4 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:border-primary/30 hover:shadow-md active:scale-[0.98] transition-all duration-200"
          @click="handleSlotClick(null)"
        >
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
            Настроить слот {{ localActions.length + i }}
          </span>
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
