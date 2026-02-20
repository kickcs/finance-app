<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { UCard, IconBadge } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useChangelog } from '@/features/changelog';
import { useRouter } from 'vue-router';
import ChangelogEntryItem from '@/features/changelog/ui/ChangelogEntryItem.vue';

const router = useRouter();
const { allEntries, markAsSeen } = useChangelog();

// Mark as seen when visiting the page
markAsSeen();

function handleAddTransaction() {
  router.push('/transactions/new');
}
</script>

<template>
  <div class="min-h-screen bg-background-light dark:bg-background-dark pb-28">
    <AppHeader title="Что нового" show-back @back="navigateBack" />

    <main class="px-5 pt-4 pb-10">
      <!-- Hero -->
      <div class="mb-8 mt-2 text-center flex flex-col items-center">
        <IconBadge
          icon="celebration"
          size="lg"
          color="#3b82f6"
          class="mb-3"
        />
        <h1 class="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">
          Что нового
        </h1>
        <p class="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1 max-w-[250px]">
          История улучшений и обновлений приложения
        </p>
      </div>

      <!-- Timeline -->
      <div class="relative pl-3">
        <!-- Vertical Line -->
        <div class="absolute top-2 bottom-0 left-[27px] w-[2px] bg-border-light dark:bg-border-dark" />
        
        <div class="space-y-10 relative">
          <div v-for="(entry, index) in allEntries" :key="entry.version" class="relative pl-10">
            <!-- Timeline Node -->
            <div class="absolute left-0 top-1 w-8 h-8 rounded-full bg-surface-light dark:bg-surface-dark border-4 border-background-light dark:border-background-dark flex items-center justify-center z-10 shadow-sm">
              <div class="w-2.5 h-2.5 rounded-full" :class="index === 0 ? 'bg-primary' : 'bg-border-light dark:bg-text-secondary-dark'" />
            </div>
            
            <UCard class="p-5" variant="bordered">
              <ChangelogEntryItem :entry="entry" show-title />
            </UCard>
          </div>
        </div>
      </div>
    </main>

    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
