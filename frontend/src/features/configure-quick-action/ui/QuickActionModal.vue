<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon } from '@/shared/ui';
import { haptics } from '@/shared/lib/haptics';
import type { Category } from '@/entities/category';
import { CategoryChips } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import { AccountSelector } from '@/entities/account';
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

function selectCategory(id: string) {
  selectedCategoryId.value = id;
  haptics.tap();
}

function selectAccount(id: string) {
  selectedAccountId.value = id;
  haptics.tap();
}

function handleSave() {
  if (!canSave.value) return;
  haptics.success();
  const cat = props.expenseCategories.find((c) => c.id === selectedCategoryId.value);
  emit('save', {
    label: cat?.name || 'Расход',
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
  });
  emit('update:modelValue', false);
}

function handleDelete() {
  haptics.warning();
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
      <CategoryChips
        :categories="expenseCategories"
        :selected-id="selectedCategoryId"
        :rows="4"
        label="Категория"
        @select="selectCategory"
      />

      <AccountSelector
        :accounts="accounts"
        :selected-id="selectedAccountId"
        label="Счёт списания"
        @select="selectAccount"
      />
    </div>

    <template #actions>
      <div class="flex gap-3 w-full">
        <UButton
          v-if="isEditing"
          variant="secondary"
          class="flex-1 !bg-danger/10 !text-danger hover:!bg-danger/20 border-none"
          @click="handleDelete"
        >
          <UIcon name="delete" size="sm" class="mr-1.5" />
          Удалить
        </UButton>
        <UButton variant="primary" class="flex-1" :disabled="!canSave" @click="handleSave">
          <UIcon v-if="!isEditing" name="add" size="sm" class="mr-1.5" />
          {{ isEditing ? 'Сохранить изменения' : 'Добавить действие' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
