<script setup lang="ts">
import { ref } from 'vue';
import { useHaptics } from '@/shared/lib/haptics';
import type { TransactionToastData } from '@/shared/lib/composables/useToast';

defineProps<{
  data: TransactionToastData;
}>();

const emit = defineEmits<{
  undo: [];
  dismiss: [];
}>();

const { trigger } = useHaptics();
const isUndoing = ref(false);

function handleUndo() {
  if (isUndoing.value) return;
  isUndoing.value = true;
  trigger('light');
  emit('undo');
}
</script>

<template>
  <div class="flex items-center gap-3">
    <div class="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="checkmark-icon">
        <path
          d="M4 8.5L7 11.5L12 5"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-semibold text-white truncate">{{ data.amount }}</p>
      <p class="text-xs text-slate-400 truncate">
        {{ data.categoryName }} · {{ data.accountName }}
      </p>
    </div>
    <button
      class="text-xs font-semibold text-indigo-400 px-2.5 py-1.5 rounded-lg bg-indigo-400/10 hover:bg-indigo-400/20 transition-colors whitespace-nowrap disabled:opacity-50"
      :disabled="isUndoing"
      @click="handleUndo"
    >
      {{ isUndoing ? '...' : 'Отменить' }}
    </button>
  </div>
</template>

<style scoped>
.checkmark-icon path {
  stroke-dasharray: 24;
  stroke-dashoffset: 24;
  animation: draw-check 0.4s ease-out 0.2s forwards;
}

@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}
</style>
