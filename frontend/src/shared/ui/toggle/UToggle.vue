<script setup lang="ts">
defineProps<{
  modelValue: boolean;
  disabled?: boolean;
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
    :disabled="disabled"
    :class="{ 'opacity-40 cursor-not-allowed': disabled }"
    @click="!disabled && $emit('update:modelValue', !modelValue)"
  >
    <div
      class="w-11 h-6 rounded-full relative transition-colors duration-200"
      :class="modelValue ? 'bg-primary' : 'bg-text-tertiary-light/40 dark:bg-text-tertiary-dark/50'"
    >
      <div
        class="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
        :class="modelValue ? 'translate-x-5 left-0.5' : 'left-0.5'"
      />
    </div>
  </button>
</template>
