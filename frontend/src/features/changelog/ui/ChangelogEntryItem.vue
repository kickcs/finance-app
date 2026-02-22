<script setup lang="ts">
import { UIcon } from '@/shared/ui';
import { CHANGELOG_TYPE_CONFIG } from '../model/changelogData';
import type { ChangelogEntry } from '../model/changelogData';
import { formatLocalDate } from '@/shared/lib/format/date';
import VersionBadge from './VersionBadge.vue';

defineProps<{ entry: ChangelogEntry; showTitle?: boolean }>();
</script>

<template>
  <!-- Version badge + date -->
  <div class="flex items-center gap-3" :class="showTitle ? 'mb-4' : ''">
    <VersionBadge :version="entry.version" />
    <span class="text-sm text-text-secondary-light dark:text-text-secondary-dark">
      {{ formatLocalDate(entry.date) }}
    </span>
  </div>

  <!-- Title (optional) -->
  <h2
    v-if="showTitle && entry.title"
    class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-3"
  >
    {{ entry.title }}
  </h2>

  <!-- Items list -->
  <ul class="space-y-3">
    <li v-for="(item, index) in entry.items" :key="index" class="flex items-start gap-3">
      <div
        :class="[
          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
          CHANGELOG_TYPE_CONFIG[item.type].colorClass,
        ]"
      >
        <UIcon :name="CHANGELOG_TYPE_CONFIG[item.type].icon" size="sm" />
      </div>
      <span class="text-sm text-text-primary-light dark:text-text-primary-dark pt-1">
        {{ item.text }}
      </span>
    </li>
  </ul>
</template>
