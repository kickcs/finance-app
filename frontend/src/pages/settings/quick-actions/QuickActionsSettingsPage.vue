<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { AppHeader } from '@/widgets/header';
import { UIcon } from '@/shared/ui';
import {
  QuickActionModal,
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';
import { useAccounts } from '@/entities/account';
import { useCategories } from '@/entities/category';
import { navigateBack } from '@/app/router';

const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? '');
const { accounts } = useAccounts(userId);
const { expenseCategories, getCategoryById } = useCategories(userId);
const { slots, addAction, updateAction, removeAction, hidden, toggleHidden } = useQuickActions();

const showModal = ref(false);
const editingAction = ref<QuickAction | null>(null);

function handleSlotClick(action: QuickAction | null) {
  editingAction.value = action;
  showModal.value = true;
}

function handleSave(data: { label: string; categoryId: string; accountId: string }) {
  if (editingAction.value) {
    updateAction(editingAction.value.id, data);
  } else {
    addAction(data);
  }
  editingAction.value = null;
}

function handleDelete() {
  if (editingAction.value) {
    removeAction(editingAction.value.id);
  }
  editingAction.value = null;
}
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark overflow-y-auto"
  >
    <AppHeader title="Быстрые действия" show-back @back="navigateBack" />

    <main class="px-5 pt-6 pb-28 space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Настройте до 4 быстрых кнопок на главном экране. Каждая кнопка открывает добавление расхода
        с выбранной категорией и счётом.
      </p>

      <!-- Visibility toggle -->
      <button
        class="w-full flex items-center justify-between p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark"
        role="switch"
        :aria-checked="!hidden"
        aria-label="Показывать быстрые действия на главной"
        @click="toggleHidden"
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
        <div
          class="w-11 h-6 rounded-full relative transition-colors duration-200"
          :class="hidden ? 'bg-border-light dark:bg-border-dark' : 'bg-primary'"
        >
          <div
            class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="hidden ? 'left-0.5' : 'translate-x-5 left-0.5'"
          />
        </div>
      </button>

      <div class="space-y-3">
        <button
          v-for="(action, index) in slots"
          :key="action?.id ?? `empty-${index}`"
          class="w-full flex items-center gap-3 p-4 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark hover:opacity-80 active:scale-[0.98] transition-all duration-150"
          @click="handleSlotClick(action)"
        >
          <template v-if="action">
            <div
              class="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center"
              :style="{
                backgroundColor: (getCategoryById(action.categoryId)?.color ?? '#64748b') + '1A',
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
              <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
                {{ action.label }}
              </p>
              <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
                {{ accounts?.find((a) => a.id === action.accountId)?.name || 'Счёт не найден' }}
              </p>
            </div>
            <UIcon
              name="chevron_right"
              size="sm"
              class="text-text-tertiary-light dark:text-text-tertiary-dark"
            />
          </template>
          <template v-else>
            <div
              class="w-10 h-10 shrink-0 rounded-lg bg-border-light dark:bg-border-dark flex items-center justify-center"
            >
              <UIcon
                name="add"
                size="sm"
                class="text-text-tertiary-light dark:text-text-tertiary-dark"
              />
            </div>
            <span class="text-sm text-text-tertiary-light dark:text-text-tertiary-dark">
              Слот {{ index + 1 }} — нажмите чтобы настроить
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
