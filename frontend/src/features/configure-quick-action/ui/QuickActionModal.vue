<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon } from '@/shared/ui';
import { EXPENSE_CATEGORIES, getCategoryById } from '@/entities/category';
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { QuickAction } from '../model/types';

const props = defineProps<{
  modelValue: boolean;
  accounts: AccountWithBalances[];
  editAction?: QuickAction | null;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  save: [action: { label: string; categoryId: string; accountId: string }];
  delete: [];
}>();

const step = ref<'category' | 'account'>('category');
const selectedCategoryId = ref('');
const selectedAccountId = ref('');

const selectedCategory = computed(() =>
  selectedCategoryId.value ? getCategoryById(selectedCategoryId.value) : null,
);

const isEditing = computed(() => !!props.editAction);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editAction) {
        selectedCategoryId.value = props.editAction.categoryId;
        selectedAccountId.value = props.editAction.accountId;
        step.value = 'category';
      } else {
        selectedCategoryId.value = '';
        selectedAccountId.value = '';
        step.value = 'category';
      }
    }
  },
);

function selectCategory(cat: Category) {
  selectedCategoryId.value = cat.id;
  step.value = 'account';
}

function selectAccount(accountId: string) {
  selectedAccountId.value = accountId;
  handleSave();
}

function handleSave() {
  if (!selectedCategoryId.value || !selectedAccountId.value) return;
  const cat = getCategoryById(selectedCategoryId.value);
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

function handleBack() {
  if (step.value === 'account') {
    step.value = 'category';
  } else {
    emit('update:modelValue', false);
  }
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="step === 'category' ? 'Выберите категорию' : 'Выберите счёт'"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- Category selection -->
    <div v-if="step === 'category'" class="space-y-2">
      <button
        v-for="cat in EXPENSE_CATEGORIES"
        :key="cat.id"
        class="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
        :class="[
          selectedCategoryId === cat.id
            ? 'bg-primary-light ring-1 ring-primary'
            : 'hover:bg-surface-light dark:hover:bg-surface-dark',
        ]"
        @click="selectCategory(cat)"
      >
        <div
          class="w-9 h-9 rounded-lg flex items-center justify-center"
          :style="{ backgroundColor: cat.color + '1A' }"
        >
          <UIcon :name="cat.icon" size="sm" :style="{ color: cat.color }" />
        </div>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ cat.name }}
        </span>
      </button>
    </div>

    <!-- Account selection -->
    <div v-else class="space-y-2">
      <button
        class="flex items-center gap-1 text-sm text-text-secondary-light dark:text-text-secondary-dark mb-2"
        @click="handleBack"
      >
        <UIcon name="arrow_back" size="xs" />
        {{ selectedCategory?.name }}
      </button>

      <button
        v-for="account in accounts"
        :key="account.id"
        class="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150"
        :class="[
          selectedAccountId === account.id
            ? 'bg-primary-light ring-1 ring-primary'
            : 'hover:bg-surface-light dark:hover:bg-surface-dark',
        ]"
        @click="selectAccount(account.id)"
      >
        <div
          class="w-9 h-9 rounded-lg bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <UIcon name="account_balance_wallet" size="sm" class="text-text-secondary-light dark:text-text-secondary-dark" />
        </div>
        <span class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
          {{ account.name }}
        </span>
      </button>
    </div>

    <template v-if="isEditing" #actions>
      <UButton
        variant="danger"
        size="sm"
        full-width
        @click="handleDelete"
      >
        Удалить
      </UButton>
    </template>
  </UModal>
</template>
