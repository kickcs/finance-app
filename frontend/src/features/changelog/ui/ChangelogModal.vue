<script setup lang="ts">
import { UModal, UButton, UIcon } from '@/shared/ui';
import { CHANGELOG_TYPE_CONFIG } from '../model/changelogData';
import { useChangelog } from '../model/useChangelog';

const modelValue = defineModel<boolean>({ required: true });

const { latestEntry, markAsSeen } = useChangelog();

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function handleClose() {
  markAsSeen();
  modelValue.value = false;
}
</script>

<template>
  <UModal v-model="modelValue" title="Что нового" @close="markAsSeen">
    <div v-if="latestEntry" class="space-y-4">
      <!-- Version badge + date -->
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-primary to-primary/80 text-white"
        >
          v{{ latestEntry.version }}
        </span>
        <span
          class="text-sm text-text-secondary-light dark:text-text-secondary-dark"
        >
          {{ formatDate(latestEntry.date) }}
        </span>
      </div>

      <!-- Items list -->
      <ul class="space-y-3">
        <li
          v-for="(item, index) in latestEntry.items"
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
    </div>

    <template #actions>
      <UButton variant="primary" full-width @click="handleClose">
        Понятно
      </UButton>
    </template>
  </UModal>
</template>
