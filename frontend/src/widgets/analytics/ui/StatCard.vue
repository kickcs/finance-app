<script setup lang="ts">
import { UCard } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { IconBadge } from '@/shared/ui/icon-badge';

interface Props {
  icon: string;
  label: string;
  value?: string;
  loading?: boolean;
  iconBgClass?: string;
  iconClass?: string;
  color?: string;
  valueClass?: string;
}

withDefaults(defineProps<Props>(), {
  loading: false,
});
</script>

<template>
  <UCard class="p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <IconBadge
          :icon="icon"
          size="lg"
          :bg-class="iconBgClass"
          :icon-class="iconClass"
          :color="color"
        />
        <span class="text-text-secondary-light dark:text-text-secondary-dark">
          {{ label }}
        </span>
      </div>
      <Skeleton v-if="loading" class="h-7 w-32 rounded" />
      <span
        v-else
        :class="[
          'text-xl font-bold text-text-primary-light dark:text-text-primary-dark',
          valueClass,
        ]"
      >
        {{ value }}
      </span>
    </div>
  </UCard>
</template>
