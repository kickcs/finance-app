<script setup lang="ts">
import type { Component } from 'vue';
import { UIcon } from '@/shared/ui/icon';

// titleAs: реальный заголовок диалога должен быть примитивом reka-ui
// (DialogTitle на десктопе, DrawerTitle из vaul-vue на мобиле) — иначе
// DialogContentImpl не находит элемент по aria-labelledby и шторка остаётся
// без доступного имени для скринридера. Обычный <h2> здесь недостаточен.
withDefaults(defineProps<{ title?: string; titleAs?: string | Component }>(), {
  titleAs: 'h2',
});
defineEmits<{ close: [] }>();
</script>

<template>
  <div
    v-if="title || $slots.default"
    class="shrink-0 flex items-center justify-between gap-3 px-5 py-4 border-b border-border-light dark:border-border-dark"
  >
    <component
      :is="titleAs"
      class="text-body-lg font-semibold text-text-primary-light dark:text-text-primary-dark truncate"
    >
      {{ title }}
    </component>
    <slot />
    <button
      type="button"
      data-testid="overlay-close"
      aria-label="Закрыть"
      class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
      @click="$emit('close')"
    >
      <UIcon name="close" size="sm" />
    </button>
  </div>
</template>
