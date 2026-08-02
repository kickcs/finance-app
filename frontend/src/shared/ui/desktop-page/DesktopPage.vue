<script setup lang="ts">
import { computed, ref } from 'vue';
import { cn } from '@/shared/lib/utils';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    maxWidth?: '1440' | '1280' | 'full';
  }>(),
  { title: undefined, subtitle: undefined, maxWidth: '1440' },
);

const WIDTH_CLASSES: Record<string, string> = {
  '1440': 'max-w-[1440px]',
  '1280': 'max-w-[1280px]',
  full: 'max-w-none',
};

// computed, а не разовое вычисление: проп может меняться по ходу жизни
// страницы, и застывший класс молча оставил бы прежнюю ширину.
const widthClass = computed(() => WIDTH_CLASSES[props.maxWidth]);

const scrollRef = ref<HTMLElement>();

defineExpose({ scrollRef });
</script>

<template>
  <div class="h-full flex flex-col">
    <header
      v-if="title || $slots['header-actions']"
      class="shrink-0 border-b border-border-light dark:border-border-dark"
    >
      <div
        :class="cn('mx-auto w-full px-8 py-5 flex items-center justify-between gap-6', widthClass)"
      >
        <div class="min-w-0">
          <h1
            class="text-h2 font-bold text-text-primary-light dark:text-text-primary-dark truncate"
          >
            {{ title }}
          </h1>
          <p
            v-if="subtitle"
            class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark truncate"
          >
            {{ subtitle }}
          </p>
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <slot name="header-actions" />
        </div>
      </div>
    </header>

    <div ref="scrollRef" class="flex-1 overflow-y-auto px-8 py-6">
      <div :class="cn('mx-auto w-full', widthClass)">
        <slot />
      </div>
    </div>
  </div>
</template>
