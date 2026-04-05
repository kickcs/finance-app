<script setup lang="ts">
import { useNavbarStyle } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { UToggle } from '@/shared/ui';

const { style, isLiquidGlass } = useNavbarStyle();
const { trigger } = useHaptics();

function toggle(checked: boolean) {
  trigger('selection');
  style.value = checked ? 'liquid-glass' : 'classic';
}
</script>

<template>
  <div class="flex items-center justify-between">
    <span class="text-sm text-text-primary-light dark:text-text-primary-dark">Liquid Glass</span>
    <UToggle :model-value="isLiquidGlass" @update:model-value="toggle" />
  </div>
</template>
