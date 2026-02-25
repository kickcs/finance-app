<script setup lang="ts">
import { UButton } from '@/shared/ui/button';
import { UIcon } from '@/shared/ui/icon';
import { useTheme } from '../model/useTheme';

defineProps<{
  showLabel?: boolean;
}>();

const { isDark, toggleTheme } = useTheme();
</script>

<template>
  <UButton variant="ghost" :icon-only="!showLabel" @click="toggleTheme">
    <UIcon :name="isDark ? 'light_mode' : 'dark_mode'" size="md" />
    <span v-if="showLabel" class="ml-2">
      {{ isDark ? 'Светлая тема' : 'Тёмная тема' }}
    </span>
  </UButton>
</template>
