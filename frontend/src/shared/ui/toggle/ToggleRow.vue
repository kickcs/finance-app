<script setup lang="ts">
import UToggle from './UToggle.vue';

defineProps<{
  title: string;
  description: string;
}>();

const model = defineModel<boolean>({ required: true });
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div>
      <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        {{ title }}
      </p>
      <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark mt-0.5">
        {{ description }}
      </p>
    </div>
    <UToggle v-model="model" />
  </div>
</template>
