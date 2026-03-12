<script setup lang="ts">
import { useIsDesktop } from '@/shared/lib/composables/useIsDesktop';

defineProps<{
  selected?: string | null;
}>();

defineEmits<{
  close: [];
}>();

const isDesktop = useIsDesktop();
</script>

<template>
  <div class="flex-1 overflow-hidden">
    <div class="mx-auto max-w-7xl h-full px-5 lg:px-8">
      <!-- Desktop: split view -->
      <div v-if="isDesktop" class="flex h-full gap-0">
        <!-- Master panel -->
        <div class="flex-[5] overflow-y-auto min-w-0 pr-4">
          <slot name="master" />
        </div>

        <!-- Divider -->
        <div class="w-px bg-border-light dark:bg-border-dark shrink-0" />

        <!-- Detail panel -->
        <div class="flex-[4] overflow-y-auto min-w-0 pl-4">
          <slot v-if="selected" name="detail" />
          <slot v-else name="empty">
            <div class="h-full flex items-center justify-center">
              <p class="text-text-tertiary-light dark:text-text-tertiary-dark text-body-sm">
                Выберите элемент
              </p>
            </div>
          </slot>
        </div>
      </div>

      <!-- Mobile: master only -->
      <div v-else class="h-full overflow-y-auto">
        <slot name="master" />
      </div>
    </div>
  </div>
</template>
