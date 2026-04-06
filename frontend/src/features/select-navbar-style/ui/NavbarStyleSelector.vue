<script setup lang="ts">
import { useNavbarStyle } from '@/shared/lib/composables';
import { useHaptics } from '@/shared/lib/haptics';
import { UToggle } from '@/shared/ui';

const { style, isLiquidGlass, isAndroid } = useNavbarStyle();
const { trigger } = useHaptics();

function toggle(checked: boolean) {
  trigger('selection');
  style.value = checked ? 'liquid-glass' : 'classic';
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-text-primary-light dark:text-text-primary-dark">Liquid Glass</span>
      <UToggle :model-value="isLiquidGlass" @update:model-value="toggle" />
    </div>
    <p v-if="isAndroid" class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-1">
      Может замедлить работу на этом устройстве
    </p>
  </div>
</template>
