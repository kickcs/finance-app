<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon } from '@/shared/ui';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { QuickAction } from '../model/types';

const props = defineProps<{
  modelValue: boolean;
  accounts: AccountWithBalances[];
  expenseCategories: Category[];
  editAction?: QuickAction | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [action: { label: string; categoryId: string; accountId: string }];
  delete: [];
}>();

const selectedCategoryId = ref('');
const selectedAccountId = ref('');

const isEditing = computed(() => !!props.editAction);

const canSave = computed(() => !!selectedCategoryId.value && !!selectedAccountId.value);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editAction) {
        selectedCategoryId.value = props.editAction.categoryId;
        selectedAccountId.value = props.editAction.accountId;
      } else {
        selectedCategoryId.value = '';
        selectedAccountId.value = props.accounts[0]?.id ?? '';
      }
    }
  },
);

function handleSave() {
  if (!canSave.value) return;
  const cat = props.expenseCategories.find((c) => c.id === selectedCategoryId.value);
  emit('save', {
    label: cat?.name || 'Расход',
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
  });
  emit('update:modelValue', false);
}

function handleDelete() {
  emit('delete');
  emit('update:modelValue', false);
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="isEditing ? 'Изменить действие' : 'Новое действие'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <!-- Category grid -->
      <div>
        <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
          Категория
        </p>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="cat in expenseCategories"
            :key="cat.id"
            class="flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all duration-150"
            :class="[
              selectedCategoryId === cat.id
                ? 'bg-primary/10 ring-1 ring-primary'
                : 'hover:bg-surface-light dark:hover:bg-surface-dark',
            ]"
            @click="selectedCategoryId = cat.id"
          >
            <div
              class="w-9 h-9 rounded-lg flex items-center justify-center"
              :style="{ backgroundColor: cat.color + '1A' }"
            >
              <UIcon :name="cat.icon" size="sm" :style="{ color: cat.color }" />
            </div>
            <span
              class="text-caption-sm leading-tight font-medium truncate w-full text-center"
              :class="[
                selectedCategoryId === cat.id
                  ? 'text-primary'
                  : 'text-text-secondary-light dark:text-text-secondary-dark',
              ]"
            >
              {{ cat.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- Account selector -->
      <div>
        <p class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark mb-2">
          Счёт
        </p>
        <div class="flex gap-2 flex-wrap">
          <button
            v-for="account in accounts"
            :key="account.id"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            :class="[
              selectedAccountId === account.id
                ? 'bg-primary/10 text-primary ring-1 ring-primary'
                : 'bg-surface-light dark:bg-surface-dark text-text-primary-light dark:text-text-primary-dark hover:opacity-80',
            ]"
            @click="selectedAccountId = account.id"
          >
            <UIcon
              name="account_balance_wallet"
              size="xs"
              :class="
                selectedAccountId === account.id
                  ? 'text-primary'
                  : 'text-text-tertiary-light dark:text-text-tertiary-dark'
              "
            />
            {{ account.name }}
          </button>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton v-if="isEditing" variant="ghost" size="sm" class="text-danger" @click="handleDelete">
        <UIcon name="delete" size="xs" class="mr-1" />
        Удалить
      </UButton>
      <div v-else />
      <UButton variant="primary" size="sm" :disabled="!canSave" @click="handleSave">
        {{ isEditing ? 'Сохранить' : 'Добавить' }}
      </UButton>
    </template>
  </UModal>
</template>
