<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '7xl';
}>();

const maxWidthClasses: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '7xl': 'max-w-7xl',
};

const scrollRef = ref<HTMLElement>();

defineExpose({ scrollRef });
</script>

<template>
  <div class="h-full flex flex-col">
    <slot name="header" />
    <div ref="scrollRef" class="flex-1 overflow-y-auto px-5 lg:px-8">
      <div :class="['mx-auto w-full', maxWidthClasses[maxWidth ?? '7xl']]">
        <slot />
      </div>
    </div>
  </div>
</template>
