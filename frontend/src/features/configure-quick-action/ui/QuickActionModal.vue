<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { UModal, UButton, UIcon, UInput } from '@/shared/ui';
import { useHaptics } from '@/shared/lib/haptics';
import { getCurrencySymbol } from '@/shared/lib/format/currency';
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
  save: [action: { label: string; categoryId: string; accountId: string; amount?: number | null }];
  delete: [];
}>();

const { trigger } = useHaptics();

const selectedCategoryId = ref('');
const selectedAccountId = ref('');
const customLabel = ref('');
const customAmount = ref<string>('');

const isEditing = computed(() => !!props.editAction);

const canSave = computed(() => !!selectedCategoryId.value && !!selectedAccountId.value);

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      if (props.editAction) {
        selectedCategoryId.value = props.editAction.categoryId;
        selectedAccountId.value = props.editAction.accountId;
        customLabel.value = props.editAction.label ?? '';
        customAmount.value =
          props.editAction.amount !== null && props.editAction.amount !== undefined
            ? String(props.editAction.amount)
            : '';
      } else {
        selectedCategoryId.value = '';
        selectedAccountId.value = props.accounts[0]?.id ?? '';
        customLabel.value = '';
        customAmount.value = '';
      }
    }
  },
);

const selectedAccountCurrency = computed(() => {
  const account = props.accounts.find((a) => a.id === selectedAccountId.value);
  return account?.balances[0]?.currency ?? 'USD';
});

function selectCategory(id: string) {
  selectedCategoryId.value = id;
  trigger('selection');
}

function selectAccount(id: string) {
  selectedAccountId.value = id;
  trigger('selection');
}

function handleSave() {
  if (!canSave.value) return;
  trigger('success');
  const cat = props.expenseCategories.find((c) => c.id === selectedCategoryId.value);
  const parsedAmount = customAmount.value ? parseFloat(customAmount.value.replace(',', '.')) : null;
  emit('save', {
    label: customLabel.value.trim() || cat?.name || 'Расход',
    categoryId: selectedCategoryId.value,
    accountId: selectedAccountId.value,
    amount: parsedAmount && parsedAmount > 0 ? parsedAmount : null,
  });
  emit('update:modelValue', false);
}

function handleDelete() {
  trigger('warning');
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
      <div>
        <label
          class="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5"
        >
          Название
        </label>
        <UInput v-model="customLabel" placeholder="По умолчанию — имя категории" />
      </div>

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

      <div>
        <label
          class="block text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark mb-1.5"
        >
          Сумма
          <span class="font-normal text-text-tertiary-light dark:text-text-tertiary-dark">
            — для мгновенного создания
          </span>
        </label>
        <UInput
          v-model="customAmount"
          :suffix="getCurrencySymbol(selectedAccountCurrency)"
          placeholder="Не указана"
        />
      </div>
    </div>

    <template #actions>
      <div class="flex gap-3 w-full">
        <UButton
          v-if="isEditing"
          variant="secondary"
          data-testid="delete-btn"
          class="flex-1 !bg-danger/10 !text-danger hover:!bg-danger/20 border-none"
          @click="handleDelete"
        >
          <UIcon name="delete" size="sm" class="mr-1.5" />
          Удалить
        </UButton>
        <UButton
          variant="primary"
          class="flex-1"
          data-testid="save-btn"
          :disabled="!canSave"
          @click="handleSave"
        >
          <UIcon v-if="!isEditing" name="add" size="sm" class="mr-1.5" />
          {{ isEditing ? 'Сохранить изменения' : 'Добавить действие' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
