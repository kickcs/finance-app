<script setup lang="ts">
import { computed } from 'vue';
import { UCard, SectionHeader, IconBadge, Skeleton } from '@/shared/ui';
import { formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';

const props = defineProps<{
  savedAmount: number;
  spentAmount: number;
  currency: string;
  period?: string;
  loading?: boolean;
  hidden?: boolean;
}>();

defineEmits<{
  'income-click': [];
  'expense-click': [];
}>();

const hasData = computed(() => props.savedAmount > 0 || props.spentAmount > 0);
</script>

<template>
  <div class="space-y-3">
    <!-- Header -->
    <SectionHeader
      :title="period || 'Этот месяц'"
      :show-add="false"
      :show-view-all="hasData && !loading"
      view-all-text="Детали"
      @view-all="$emit('income-click')"
    />

    <!-- Loading Skeleton -->
    <div v-if="loading" class="grid grid-cols-2 gap-3">
      <UCard v-for="i in 2" :key="i" padding="md">
        <Skeleton class="h-4 w-20 rounded mb-2" />
        <Skeleton class="h-6 w-24 rounded" />
      </UCard>
    </div>

    <!-- Empty state — compact -->
    <UCard v-else-if="!hasData" padding="md">
      <div class="flex items-center gap-3 py-1">
        <IconBadge
          icon="trending_up"
          size="sm"
          bg-class="bg-surface-light dark:bg-surface-dark"
          icon-class="text-text-tertiary-light dark:text-text-tertiary-dark"
        />
        <div>
          <p
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark"
          >
            Нет данных за месяц
          </p>
          <p
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            Добавьте доходы и расходы
          </p>
        </div>
      </div>
    </UCard>

    <!-- Content — two side-by-side cards -->
    <div v-else class="grid grid-cols-2 gap-3">
      <!-- Earned Card -->
      <UCard
        padding="md"
        class="cursor-pointer hover:ring-1 hover:ring-success/30 transition-all"
        @click="$emit('income-click')"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <IconBadge
            icon="trending_up"
            size="xs"
            bg-class="bg-success-light"
            icon-class="text-success"
          />
          <span
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Заработано
          </span>
        </div>
        <p class="text-h3 font-semibold text-success">
          {{
            formatMasked(savedAmount, currency, hidden ?? false, COMPACT_FORMAT)
          }}
        </p>
      </UCard>

      <!-- Spent Card -->
      <UCard
        padding="md"
        class="cursor-pointer hover:ring-1 hover:ring-danger/30 transition-all"
        @click="$emit('expense-click')"
      >
        <div class="flex items-center gap-1.5 mb-2">
          <IconBadge
            icon="trending_down"
            size="xs"
            bg-class="bg-danger-light"
            icon-class="text-danger"
          />
          <span
            class="text-body-sm font-medium text-text-secondary-light dark:text-text-secondary-dark"
          >
            Потрачено
          </span>
        </div>
        <p class="text-h3 font-semibold text-danger">
          {{
            formatMasked(spentAmount, currency, hidden ?? false, COMPACT_FORMAT)
          }}
        </p>
      </UCard>
    </div>
  </div>
</template>
