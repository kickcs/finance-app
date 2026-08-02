<script setup lang="ts">
import { computed } from 'vue';
import { UIcon, DiscoveryDot } from '@/shared/ui';
import { FeatureHintPopover, type HintConfig } from '@/features/feature-hints';
import { useFinancialPeriod } from '@/shared/lib/hooks/useFinancialPeriod';
import {
  formatFinancialPeriod,
  getCurrentFinancialMonth,
} from '@/shared/lib/utils/financialPeriod';

/**
 * Шапка десктопной Главной — того, чего нет на мобиле: приветствие с именем,
 * текущий финансовый период (если он настроен нестандартно) и кнопка
 * «Настроить вид» вместо отдельной страницы настроек в бургер-меню.
 */
defineProps<{
  userName: string;
  greeting: string;
  showSettingsDot?: boolean;
  showSettingsHint?: boolean;
  settingsHintConfig?: HintConfig | null;
}>();

const emit = defineEmits<{
  'period-click': [];
  'settings-click': [];
  'hint-dismiss': [];
  'hint-action': [];
}>();

const { startDay, isCustomPeriod } = useFinancialPeriod();

const periodLabel = computed(() => {
  if (!isCustomPeriod.value) return null;
  const { year, month } = getCurrentFinancialMonth(startDay.value);
  return formatFinancialPeriod(year, month, startDay.value);
});
</script>

<template>
  <header
    data-testid="dashboard-desktop-header"
    class="shrink-0 border-b border-border-light dark:border-border-dark"
  >
    <div class="mx-auto w-full max-w-[1440px] px-8 py-5 flex items-center justify-between gap-6">
      <div class="min-w-0">
        <p class="text-body-sm text-text-secondary-light dark:text-text-secondary-dark">
          {{ greeting }}
        </p>
        <h1 class="text-h2 font-bold text-text-primary-light dark:text-text-primary-dark truncate">
          {{ userName || 'Ouro' }}
        </h1>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <button
          v-if="periodLabel"
          type="button"
          class="flex items-center gap-2 h-9 px-4 rounded-xl text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          @click="emit('period-click')"
        >
          <UIcon name="calendar_month" size="sm" />
          {{ periodLabel }}
        </button>

        <FeatureHintPopover
          v-if="settingsHintConfig"
          :config="settingsHintConfig"
          :open="showSettingsHint ?? false"
          side="bottom"
          @dismiss="emit('hint-dismiss')"
          @action="emit('hint-action')"
        >
          <div class="relative">
            <button
              type="button"
              data-testid="dashboard-desktop-settings-btn"
              class="flex items-center gap-2 h-9 px-4 rounded-xl text-body-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              @click="emit('settings-click')"
            >
              <UIcon name="tune" size="sm" />
              Настроить вид
            </button>
            <DiscoveryDot :show="showSettingsDot" />
          </div>
        </FeatureHintPopover>
        <div v-else class="relative">
          <button
            type="button"
            data-testid="dashboard-desktop-settings-btn"
            class="flex items-center gap-2 h-9 px-4 rounded-xl text-body-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
            @click="emit('settings-click')"
          >
            <UIcon name="tune" size="sm" />
            Настроить вид
          </button>
          <DiscoveryDot :show="showSettingsDot" />
        </div>
      </div>
    </div>
  </header>
</template>
