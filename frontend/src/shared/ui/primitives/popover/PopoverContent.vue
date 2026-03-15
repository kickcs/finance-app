<script setup lang="ts">
import type { PopoverContentProps } from 'reka-ui';
import { PopoverContent, PopoverPortal } from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import { computed, type HTMLAttributes } from 'vue';

const props = withDefaults(
  defineProps<PopoverContentProps & { class?: HTMLAttributes['class'] }>(),
  {
    align: 'center',
    sideOffset: 4,
  },
);

defineOptions({ inheritAttrs: false });

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props;
  return delegated;
});
</script>

<template>
  <PopoverPortal>
    <PopoverContent
      v-bind="{ ...delegatedProps, ...$attrs }"
      :class="
        cn(
          'z-50 w-72 rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark p-4 shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          props.class,
        )
      "
    >
      <slot />
    </PopoverContent>
  </PopoverPortal>
</template>
