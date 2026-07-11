<script setup lang="ts">
import { UButton } from '@/shared/ui/button';
import { UIcon } from '@/shared/ui/icon';
import { UBadge } from '@/shared/ui/badge';

interface Props {
  title: string;
  count?: number;
  showAdd?: boolean;
  showViewAll?: boolean;
  viewAllText?: string;
  badgeVariant?:
    | 'neutral'
    | 'primary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'debt-given'
    | 'debt-received'
    | 'goal'
    | 'reminder';
}

withDefaults(defineProps<Props>(), {
  showAdd: true,
  showViewAll: true,
  viewAllText: 'Все',
  badgeVariant: 'neutral',
});

defineEmits<{
  'add-click': [];
  'view-all': [];
}>();
</script>

<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <slot name="icon" />
      <h2 class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
        {{ title }}
      </h2>
      <UBadge
        v-if="count !== undefined && count > 0"
        :variant="badgeVariant"
        size="xs"
        shape="rounded"
      >
        {{ count }}
      </UBadge>
      <slot name="badge" />
    </div>
    <div class="flex items-center gap-1">
      <UButton
        v-if="showAdd"
        variant="ghost"
        size="xs"
        :aria-label="`Добавить: ${title}`"
        @click="$emit('add-click')"
      >
        <UIcon name="add" size="xs" />
      </UButton>
      <UButton v-if="showViewAll" variant="ghost" size="xs" @click="$emit('view-all')">
        {{ viewAllText }}
        <UIcon name="chevron_right" size="xs" />
      </UButton>
    </div>
  </div>
</template>
