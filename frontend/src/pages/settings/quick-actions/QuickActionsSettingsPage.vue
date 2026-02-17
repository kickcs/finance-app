<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Ref } from 'vue';
import type { User } from '@/shared/api/composables/useAuth';
import { AppHeader } from '@/widgets/header';
import { UButton, UIcon } from '@/shared/ui';
import {
  QuickActionModal,
  useQuickActions,
  type QuickAction,
} from '@/features/configure-quick-action';
import { useAccounts } from '@/entities/account';
import { navigateBack } from '@/app/router';

const user = inject<Ref<User | null>>('user');
const userId = computed(() => user?.value?.id ?? '');
const { accounts } = useAccounts(userId);
const { slots, addAction, updateAction, removeAction, getCategory } = useQuickActions();

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
  <div class="min-h-screen bg-background-light dark:bg-background-dark">
    <AppHeader title="Быстрые действия" show-back @back="navigateBack" />

    <main class="px-5 pt-6 pb-28 space-y-4">
      <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
        Настройте до 4 быстрых кнопок на главном экране. Каждая кнопка открывает добавление расхода с выбранной категорией и счётом.
      </p>

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
              :style="{ backgroundColor: (getCategory(action.categoryId)?.color ?? '#64748b') + '1A' }"
            >
              <UIcon
                :name="getCategory(action.categoryId)?.icon ?? 'receipt_long'"
                size="sm"
                :style="{ color: getCategory(action.categoryId)?.color ?? '#64748b' }"
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
            <UIcon name="chevron_right" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
          </template>
          <template v-else>
            <div class="w-10 h-10 shrink-0 rounded-lg bg-border-light dark:bg-border-dark flex items-center justify-center">
              <UIcon name="add" size="sm" class="text-text-tertiary-light dark:text-text-tertiary-dark" />
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
      :edit-action="editingAction"
      @save="handleSave"
      @delete="handleDelete"
    />
  </div>
</template>
