<script setup lang="ts">
import { ref } from 'vue';
import { UInput } from '@/shared/ui';

defineProps<{
  modelValue: string;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
}>();

defineEmits<{
  'update:modelValue': [value: string];
  clear: [];
}>();

const inputRef = ref<InstanceType<typeof UInput> | null>(null);

defineExpose({
  focus: () => inputRef.value?.focus(),
});
</script>

<template>
  <UInput
    ref="inputRef"
    :model-value="modelValue"
    variant="search"
    :size="size"
    :placeholder="placeholder || 'Поиск...'"
    data-testid="search-input"
    @update:model-value="$emit('update:modelValue', $event as string)"
    @clear="$emit('clear')"
  />
</template>
