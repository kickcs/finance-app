<script setup lang="ts">
import { UIcon, DiscoveryDot } from '@/shared/ui';
import { useDashboardContext } from '../../model/dashboardContext';
import DashboardCompactToggle from '../DashboardCompactToggle.vue';

const { showSettingsDot, openDashboardSettings } = useDashboardContext();
</script>

<template>
  <div class="flex justify-center items-center gap-1.5 pt-1 pb-2">
    <DashboardCompactToggle variant="inline" class="hidden md:flex" />
    <div class="relative">
      <button
        type="button"
        data-testid="compact-settings-btn"
        class="flex items-center gap-2 text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-text-secondary-light dark:hover:text-text-secondary-dark transition-colors px-3 py-1.5 rounded-xl hover:bg-surface-light dark:hover:bg-surface-dark"
        @click="openDashboardSettings"
      >
        <UIcon name="tune" size="xs" />
        Настроить вид
      </button>
      <DiscoveryDot :show="showSettingsDot" />
    </div>
  </div>
</template>
