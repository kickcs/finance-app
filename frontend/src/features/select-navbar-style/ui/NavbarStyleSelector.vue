<script setup lang="ts">
import { useNavbarStyle } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { UIcon, UToggle } from '@/shared/ui';

const { style, isLiquidGlass, isAndroid } = useNavbarStyle();
const { trigger } = useHaptics();

function toggle(checked: boolean) {
  trigger('selection');
  style.value = checked ? 'liquid-glass' : 'classic';
}
</script>

<template>
  <div class="flex items-center gap-3">
    <span
      class="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-surface-light dark:bg-surface-dark"
    >
      <UIcon
        name="water_drop"
        size="xs"
        class="text-text-secondary-light dark:text-text-secondary-dark"
      />
    </span>
    <div class="min-w-0 flex-1">
      <p class="text-body-sm font-medium text-text-primary-light dark:text-text-primary-dark">
        Liquid Glass
      </p>
      <p
        v-if="isAndroid"
        class="text-caption text-text-tertiary-light dark:text-text-tertiary-dark"
      >
        Может замедлить работу на этом устройстве
      </p>
    </div>
    <UToggle :model-value="isLiquidGlass" class="shrink-0" @update:model-value="toggle" />
  </div>
</template>
