<script setup lang="ts">
import type { Category } from '@/entities/category';
import type { AccountWithBalances } from '@/entities/account';
import type { Transaction } from '@/shared/api/database.types';
import type { TransactionFormData } from '../model/useTransactionForm';
import { usePanelState } from '../model/usePanelState';
import { CategoryPicker } from '@/entities/category';

const props = defineProps<{
  formData: TransactionFormData;
  accounts: AccountWithBalances[];
  categories: Category[];
  transactions?: Transaction[];
}>();

const emit = defineEmits<{
  'update:formData': [value: TransactionFormData];
}>();

// Сумма, её валюта и частые суммы живут на плите — панели остаются счёт и категория.
const { updateField } = usePanelState(props, emit);
</script>

<template>
  <div class="space-y-3">
    <CategoryPicker
      :categories="categories"
      :selected-id="formData.categoryId"
      :transactions="transactions"
      label="Категория"
      @select="updateField('categoryId', $event)"
    />
  </div>
</template>
