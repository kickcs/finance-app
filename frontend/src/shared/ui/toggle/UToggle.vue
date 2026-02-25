<script setup lang="ts">
defineProps<{
  modelValue: boolean;
}>();

defineEmits<{
  'update:modelValue': [value: boolean];
}>();
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="relative inline-flex"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <div
      class="w-11 h-6 rounded-full relative transition-colors duration-200"
      :class="modelValue ? 'bg-primary' : 'bg-border-light dark:bg-border-dark'"
    >
      <div
        class="absolute top-0.5 w-5 h-5 rounded-full bg-surface-light dark:bg-surface-dark shadow-sm transition-transform duration-200"
        :class="modelValue ? 'translate-x-5 left-0.5' : 'left-0.5'"
      />
    </div>
  </button>
</template>
