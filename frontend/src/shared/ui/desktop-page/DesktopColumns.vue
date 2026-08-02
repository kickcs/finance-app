<script setup lang="ts">
withDefaults(defineProps<{ main?: number; aside?: number }>(), { main: 8, aside: 4 });

/** Tailwind не собирает классы из строковой интерполяции, поэтому раскладка
 *  колонок перечислена явно. */
const spanClass: Record<number, string> = {
  3: 'col-span-3',
  4: 'col-span-4',
  5: 'col-span-5',
  6: 'col-span-6',
  7: 'col-span-7',
  8: 'col-span-8',
  9: 'col-span-9',
};
</script>

<template>
  <div class="grid grid-cols-12 gap-6 items-start">
    <div :class="[spanClass[main], 'flex flex-col gap-6 min-w-0']">
      <slot name="main" />
    </div>
    <aside :class="[spanClass[aside], 'flex flex-col gap-6 min-w-0 self-start sticky top-6']">
      <slot name="aside" />
    </aside>
  </div>
</template>
