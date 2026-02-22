<script setup lang="ts">
import { UModal, UButton } from '@/shared/ui';
import { useChangelog } from '../model/useChangelog';
import ChangelogEntryItem from './ChangelogEntryItem.vue';

const modelValue = defineModel<boolean>({ required: true });

const { latestEntry, markAsSeen } = useChangelog();

function handleClose() {
  markAsSeen();
  modelValue.value = false;
}
</script>

<template>
  <UModal v-model="modelValue" title="Что нового" @close="markAsSeen">
    <div v-if="latestEntry" class="space-y-4">
      <ChangelogEntryItem :entry="latestEntry" />
    </div>

    <template #actions>
      <UButton variant="primary" full-width @click="handleClose">Понятно</UButton>
    </template>
  </UModal>
</template>
