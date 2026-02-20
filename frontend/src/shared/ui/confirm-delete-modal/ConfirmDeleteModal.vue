<script setup lang="ts">
import { UModal } from '@/shared/ui/modal';
import { UButton } from '@/shared/ui/button';
import { UIcon } from '@/shared/ui/icon';

withDefaults(
  defineProps<{
    modelValue: boolean;
    title?: string;
    warningText?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDeleting?: boolean;
    disabled?: boolean;
    error?: string | null;
    compact?: boolean;
  }>(),
  {
    title: 'Удалить',
    warningText: 'Это действие нельзя отменить.',
    confirmLabel: 'Удалить',
    cancelLabel: 'Отмена',
    compact: false,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  confirm: [];
  cancel: [];
}>();

function close() {
  emit('update:modelValue', false);
  emit('cancel');
}
</script>

<template>
  <UModal
    :model-value="modelValue"
    :title="title"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div :class="compact ? 'space-y-3' : 'space-y-4'">
      <!-- Entity info slot -->
      <slot />

      <!-- Error message (takes priority over warning) -->
      <div
        v-if="error"
        :class="['rounded-xl bg-warning/10', compact ? 'p-2.5' : 'p-4']"
      >
        <div :class="['flex items-start', compact ? 'gap-2' : 'gap-3']">
          <UIcon
            name="info"
            :size="compact ? 'xs' : 'sm'"
            class="text-warning mt-0.5 shrink-0"
          />
          <p
            :class="[
              compact ? 'text-xs' : 'text-sm',
              'text-warning font-medium',
            ]"
          >
            {{ error }}
          </p>
        </div>
      </div>

      <!-- Warning message -->
      <div
        v-else
        :class="['rounded-xl bg-danger/10', compact ? 'p-2.5' : 'p-4']"
      >
        <div :class="['flex items-start', compact ? 'gap-2' : 'gap-3']">
          <UIcon
            name="warning"
            :size="compact ? 'xs' : 'sm'"
            class="text-danger mt-0.5 shrink-0"
          />
          <p :class="[compact ? 'text-xs' : 'text-sm', 'text-danger']">
            {{ warningText }}
          </p>
        </div>
      </div>
    </div>

    <template #actions>
      <UButton
        variant="secondary"
        :size="compact ? 'sm' : undefined"
        full-width
        @click="close"
      >
        {{ cancelLabel }}
      </UButton>
      <UButton
        variant="danger"
        :size="compact ? 'sm' : undefined"
        full-width
        :loading="isDeleting"
        :disabled="disabled"
        @click="emit('confirm')"
      >
        {{ confirmLabel }}
      </UButton>
    </template>
  </UModal>
</template>
