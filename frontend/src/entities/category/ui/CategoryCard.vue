<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import type { Category } from '../model/types';

const props = defineProps<{
  category: Category;
  selected?: boolean;
  size?: 'compact' | 'medium' | 'large';
  role?: string;
  ariaSelected?: boolean;
}>();

defineEmits<{
  click: [];
}>();

const sizeConfig = computed(() => {
  switch (props.size) {
    case 'compact':
      return {
        container: 'gap-0.5 p-1 rounded-md',
        icon: 'w-7 h-7 rounded-md',
        iconSize: 'xs' as const,
        text: 'text-caption-xs leading-tight max-w-[44px]',
      };
    case 'medium':
      return {
        container: 'gap-1 p-2 rounded-xl',
        icon: 'w-10 h-10 rounded-xl',
        iconSize: 'sm' as const,
        text: 'text-xs max-w-[72px]',
      };
    case 'large':
    default:
      return {
        container: 'gap-3 p-3 rounded-xl',
        icon: 'w-16 h-16 rounded-2xl',
        iconSize: 'xl' as const,
        text: 'text-xs max-w-[72px]',
      };
  }
});
</script>

<template>
  <button
    type="button"
    :role="role"
    :aria-selected="ariaSelected"
    :class="[
      'flex flex-col items-center transition-all duration-200',
      'active:scale-95',
      sizeConfig.container,
      selected ? 'shadow-sm' : 'hover:bg-surface-light dark:hover:bg-surface-dark',
    ]"
    :style="
      selected
        ? {
            backgroundColor: `${category.color}15`,
            boxShadow: `inset 0 0 0 3px ${category.color}`,
            transform: 'scale(1.02)',
          }
        : {}
    "
    @click="$emit('click')"
  >
    <!-- Icon container -->
    <div
      :class="['flex items-center justify-center', sizeConfig.icon]"
      :style="{
        backgroundColor: `${category.color}25`,
      }"
    >
      <UIcon :name="category.icon" :size="sizeConfig.iconSize" :style="{ color: category.color }" />
    </div>

    <!-- Label -->
    <span
      :class="['font-medium truncate text-center', sizeConfig.text]"
      :style="selected ? { color: category.color } : {}"
    >
      {{ category.name }}
    </span>
  </button>
</template>
