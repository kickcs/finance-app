<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency, formatMasked, COMPACT_FORMAT } from '@/shared/lib/format/currency';
import { formatDate } from '@/shared/lib/format/date';
import { isPastDate } from '@/shared/lib/date';
import { useDashboardContext } from '../../model/dashboardContext';
import {
  SECTION_LABEL_CLASS,
  VIEW_ALL_BTN_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  iconTileStyle,
} from './constants';
import CompactRowSkeleton from './CompactRowSkeleton.vue';

const { upcomingSubscriptions, subscriptionsLoading, isHidden, nav } = useDashboardContext();

const COMPACT_SUBSCRIPTION_LIMIT = 3;

const visibleSubscriptions = computed(() =>
  upcomingSubscriptions.value.slice(0, COMPACT_SUBSCRIPTION_LIMIT),
);

function dueLabel(billingDate: string): string {
  if (isPastDate(billingDate)) return 'Сегодня';
  return formatDate(billingDate, { format: 'short' });
}
</script>

<template>
  <section data-testid="compact-subscriptions" :class="SECTION_CARD_CLASS">
    <div :class="SECTION_HEADER_CLASS">
      <p :class="SECTION_LABEL_CLASS">
        Подписки
        <span
          v-if="upcomingSubscriptions.length > 0"
          class="ml-1 normal-case font-medium text-text-tertiary-light dark:text-text-tertiary-dark"
        >
          · {{ upcomingSubscriptions.length }}
        </span>
      </p>
      <button type="button" :class="VIEW_ALL_BTN_CLASS" @click="nav.toSubscriptions">Все</button>
    </div>
    <CompactRowSkeleton v-if="subscriptionsLoading" :count="2" />
    <template v-else-if="visibleSubscriptions.length === 0">
      <button
        type="button"
        aria-label="Добавить подписку"
        class="w-full flex items-center justify-center gap-2 px-3 py-4 text-xs font-medium text-text-tertiary-light dark:text-text-tertiary-dark hover:text-primary transition-colors"
        @click="nav.toNewSubscription"
      >
        <UIcon name="add" size="sm" />
        <span>Нет ближайших списаний</span>
      </button>
    </template>
    <template v-else>
      <button
        v-for="(sub, index) in visibleSubscriptions"
        :key="sub.id"
        type="button"
        :aria-label="`Подписка ${sub.name}, ${formatCurrency(sub.amount, sub.currency, COMPACT_FORMAT)}`"
        class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-light dark:hover:bg-surface-dark active:opacity-80"
        :class="{ 'border-t border-border-light dark:border-border-dark': index !== 0 }"
        @click="nav.toSubscription(sub.id)"
      >
        <div
          class="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          :style="iconTileStyle(sub.color)"
        >
          <UIcon :name="sub.icon" size="xs" :style="{ color: sub.color }" />
        </div>
        <div class="flex-1 min-w-0">
          <p
            class="text-body-sm font-semibold truncate text-text-primary-light dark:text-text-primary-dark"
          >
            {{ sub.name }}
          </p>
          <p
            class="text-caption-sm"
            :class="
              isPastDate(sub.billing_date)
                ? 'text-warning font-semibold'
                : 'text-text-tertiary-light dark:text-text-tertiary-dark'
            "
          >
            {{ dueLabel(sub.billing_date) }}
          </p>
        </div>
        <span
          class="text-body-sm font-bold tabular-nums shrink-0 text-text-primary-light dark:text-text-primary-dark"
        >
          {{ formatMasked(sub.amount, sub.currency, isHidden, COMPACT_FORMAT) }}
        </span>
      </button>
    </template>
  </section>
</template>
