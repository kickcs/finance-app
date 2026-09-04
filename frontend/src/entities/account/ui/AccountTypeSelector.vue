<script setup lang="ts">
import { UIcon } from '@/shared/ui/icon';
import { cn } from '@/shared/lib/utils';
import {
  VISIBLE_ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  ACCOUNT_TYPE_ICONS,
  type AccountType,
} from '../model/account-types';

withDefaults(
  defineProps<{
    modelValue: AccountType;
    types?: AccountType[];
  }>(),
  { types: () => VISIBLE_ACCOUNT_TYPES },
);

defineEmits<{ 'update:modelValue': [value: AccountType] }>();
</script>

<template>
  <div class="grid grid-cols-2 gap-2" data-testid="account-type-selector">
    <button
      v-for="t in types"
      :key="t"
      type="button"
      :data-testid="`account-type-${t}`"
      :aria-pressed="modelValue === t"
      :class="
        cn(
          'flex items-center gap-2 min-w-0 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
          modelValue === t
            ? 'bg-primary text-white border-primary'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border-border-light dark:border-border-dark hover:border-primary/50',
        )
      "
      @click="$emit('update:modelValue', t)"
    >
      <UIcon :name="ACCOUNT_TYPE_ICONS[t]" size="sm" class="shrink-0" />
      <span class="truncate">{{ ACCOUNT_TYPE_LABELS[t] }}</span>
    </button>
  </div>
</template>
