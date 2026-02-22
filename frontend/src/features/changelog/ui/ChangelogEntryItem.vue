<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { CHANGELOG_TYPE_CONFIG } from '../model/changelogData';
import type { ChangelogEntry } from '../model/changelogData';
import { formatLocalDate } from '@/shared/lib/format/date';
import VersionBadge from './VersionBadge.vue';

defineProps<{ entry: ChangelogEntry; showTitle?: boolean }>();
</script>

<template>
  <div>
    <!-- Header row: version + date -->
    <div class="flex items-center gap-2.5" :class="showTitle ? 'mb-2.5' : ''">
      <VersionBadge :version="entry.version" />
      <span class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark tracking-wide">
        {{ formatLocalDate(entry.date) }}
      </span>
    </div>

    <!-- Title -->
    <h2
      v-if="showTitle && entry.title"
      class="text-[15px] font-semibold text-text-primary-light dark:text-text-primary-dark mb-3 leading-snug"
    >
      {{ entry.title }}
    </h2>

    <!-- Items -->
    <ul class="space-y-2.5">
      <li
        v-for="(item, index) in entry.items"
        :key="index"
        class="flex items-start gap-2.5 group"
      >
        <div
          :class="[
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110',
            CHANGELOG_TYPE_CONFIG[item.type].colorClass,
          ]"
        >
          <UIcon :name="CHANGELOG_TYPE_CONFIG[item.type].icon" size="sm" />
        </div>
        <span
          class="text-[13px] leading-relaxed text-text-secondary-light dark:text-text-secondary-dark pt-0.5"
        >
          {{ item.text }}
        </span>
      </li>
    </ul>
  </div>
</template>
