<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { AccountWithBalances } from '@/entities/account';
import { useSlidingIndicator } from '@/shared/lib/hooks/useSlidingIndicator';

const props = defineProps<{
  accounts: AccountWithBalances[];
  selectedId: string | null;
  label: string;
}>();

const emit = defineEmits<{
  select: [accountId: string];
}>();

const containerRef = ref<HTMLElement | null>(null);

const { setChipRef, indicatorStyle, updateIndicator } = useSlidingIndicator(
  containerRef,
  () => props.selectedId,
  (containerRect, activeRect, scrollLeft) => ({
    left: `${activeRect.left - containerRect.left + scrollLeft}px`,
    width: `${activeRect.width}px`,
  }),
);

watch(
  () => props.accounts,
  () => nextTick(updateIndicator),
  { deep: true },
);
</script>

<template>
  <div class="space-y-2">
    <label class="text-xs font-medium text-text-secondary-light dark:text-text-secondary-dark">
      {{ label }}
    </label>
    <div
      ref="containerRef"
      class="relative flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar"
    >
      <!-- Sliding Indicator -->
      <span
        class="absolute top-0 bottom-1 rounded-lg bg-primary/10 border border-primary pointer-events-none transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0"
        :style="{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          opacity: indicatorStyle.opacity,
        }"
      />

      <button
        v-for="account in accounts"
        :key="account.id"
        :ref="(el) => setChipRef(account.id, el as HTMLElement)"
        type="button"
        :class="[
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors duration-300 text-sm',
          selectedId === account.id
            ? 'border border-transparent text-primary'
            : 'border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark hover:text-text-primary-light dark:hover:text-text-primary-dark',
        ]"
        @click="emit('select', account.id)"
      >
        <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: account.color }" />
        {{ account.name }}
        <slot name="badge" :account="account">
          <span v-if="account.balances.length > 1" class="text-xs opacity-60">
            ({{ account.balances.length }})
          </span>
        </slot>
      </button>
    </div>
  </div>
</template>
