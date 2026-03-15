<script setup lang="ts">
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/ui/primitives/popover';
import { useHaptics } from '@/shared/lib/haptics';
import type { HintConfig } from '../model/types';

defineProps<{
  config: HintConfig;
  open: boolean;
  side?: 'top' | 'bottom' | 'left' | 'right';
}>();

const emit = defineEmits<{
  dismiss: [];
  action: [];
}>();

const { trigger } = useHaptics();

function handleDismiss() {
  trigger('light');
  emit('dismiss');
}

function handleAction() {
  trigger('light');
  emit('action');
}
</script>

<template>
  <Popover :open="open">
    <PopoverTrigger as-child>
      <slot />
    </PopoverTrigger>
    <PopoverContent
      :side="side ?? 'bottom'"
      :side-offset="8"
      :collision-padding="16"
      class="w-72 rounded-xl border-0 bg-primary p-3 text-white shadow-lg"
      @pointer-down-outside="handleDismiss"
      @escape-key-down="handleDismiss"
    >
      <div
        class="absolute -top-1.5 left-6 h-3 w-3 rotate-45 bg-primary"
        :class="{ 'top-auto -bottom-1.5': side === 'top' }"
      />
      <div class="relative">
        <p class="text-sm font-semibold">{{ config.title }}</p>
        <p class="mt-1 text-xs opacity-90">{{ config.description }}</p>
        <div class="mt-2.5 flex items-center justify-end gap-3">
          <button
            class="text-xs opacity-70 hover:opacity-100 transition-opacity"
            @click="handleDismiss"
          >
            Не показывать
          </button>
          <button
            class="text-xs font-semibold hover:opacity-90 transition-opacity"
            @click="handleAction"
          >
            {{ config.actionLabel }}
          </button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
