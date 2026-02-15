<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { UCard, UIcon } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useChangelog } from '@/features/changelog';
import { CHANGELOG_TYPE_CONFIG } from '@/features/changelog/model/changelogData';
import { useRouter } from 'vue-router';

const router = useRouter();
const { allEntries, markAsSeen } = useChangelog();

// Mark as seen when visiting the page
markAsSeen();

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <AppHeader title="Что нового" show-back @back="navigateBack" />

    <main class="px-5 pt-6 space-y-6">
      <UCard v-for="entry in allEntries" :key="entry.version" class="p-5">
        <!-- Version badge + date -->
        <div class="flex items-center gap-3 mb-4">
          <span
            class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-white"
          >
            v{{ entry.version }}
          </span>
          <span
            class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
          >
            {{ formatDate(entry.date) }}
          </span>
        </div>

        <!-- Title -->
        <h2
          class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark mb-3"
        >
          {{ entry.title }}
        </h2>

        <!-- Items -->
        <ul class="space-y-3">
          <li
            v-for="(item, index) in entry.items"
            :key="index"
            class="flex items-start gap-3"
          >
            <div
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                CHANGELOG_TYPE_CONFIG[item.type].colorClass,
              ]"
            >
              <UIcon :name="CHANGELOG_TYPE_CONFIG[item.type].icon" size="sm" />
            </div>
            <span
              class="text-sm text-text-primary-light dark:text-text-primary-dark pt-1"
            >
              {{ item.text }}
            </span>
          </li>
        </ul>
      </UCard>
    </main>

    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
