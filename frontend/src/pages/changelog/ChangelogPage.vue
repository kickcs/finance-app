<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { BottomNav } from '@/widgets/bottom-nav';
import { UCard } from '@/shared/ui';
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

    <main class="px-5 pt-6 space-y-6">
      <UCard v-for="entry in allEntries" :key="entry.version" class="p-5">
        <ChangelogEntryItem :entry="entry" show-title />
      </UCard>
    </main>

    <BottomNav @add-click="handleAddTransaction" />
  </div>
</template>
