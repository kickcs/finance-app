<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { ROUTE_NAMES } from '@/shared/config/routeNames';
import { UIcon, UButton } from '@/shared/ui';
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
} from 'reka-ui';
import { cn } from '@/shared/lib/utils';
import { useMountedAnimation } from '@/shared/lib/hooks/useMountedAnimation';
import { useChangelog } from '../model/useChangelog';
import { CHANGELOG_TYPE_CONFIG } from '../model/changelogData';
import VersionBadge from './VersionBadge.vue';

const modelValue = defineModel<boolean>({ required: true });

const { latestEntry, markAsSeen } = useChangelog();
const router = useRouter();
const { isMounted: isVisible } = useMountedAnimation();

// Ensure markAsSeen is called even on programmatic close
watch(modelValue, (v) => {
  if (!v) markAsSeen();
});

function handleClose() {
  markAsSeen();
  modelValue.value = false;
}

function goToChangelog() {
  handleClose();
  router.push({ name: ROUTE_NAMES.CHANGELOG });
}
</script>

<template>
  <DialogRoot
    :open="modelValue"
    @update:open="
      (v) => {
        if (!v) handleClose();
      }
    "
  >
    <DialogPortal>
      <DialogOverlay
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
      />
      <DialogContent
        :class="
          cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
            'bg-card-light dark:bg-card-dark rounded-2xl overflow-hidden',
            'border border-border-light dark:border-border-dark',
            'shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]',
            'data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]',
            'duration-200',
          )
        "
      >
        <!-- Decorative top accent -->
        <div class="h-1 bg-gradient-to-r from-primary via-primary-hover to-primary/60" />

        <!-- Header -->
        <div class="flex items-start justify-between px-5 pt-4 pb-2">
          <div class="flex flex-col gap-1">
            <DialogTitle
              class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark"
            >
              Что нового
            </DialogTitle>
            <VersionBadge v-if="latestEntry" :version="latestEntry.version" current />
          </div>
          <DialogClose
            class="w-8 h-8 rounded-lg flex items-center justify-center -mr-1 text-text-tertiary-light dark:text-text-tertiary-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors duration-150"
          >
            <UIcon name="close" size="sm" />
          </DialogClose>
        </div>

        <!-- Content -->
        <div v-if="latestEntry" class="px-5 pb-2 overflow-y-auto max-h-[50vh]">
          <!-- Title -->
          <p
            v-if="latestEntry.title"
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark mb-3"
          >
            {{ latestEntry.title }}
          </p>

          <!-- Items with staggered animation -->
          <ul class="space-y-2">
            <li
              v-for="(item, i) in latestEntry.items"
              :key="i"
              class="flex items-start gap-2.5 transform transition-all duration-300 ease-out"
              :class="isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'"
              :style="{ transitionDelay: `${150 + i * 60}ms` }"
            >
              <div
                :class="[
                  'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                  CHANGELOG_TYPE_CONFIG[item.type].colorClass,
                ]"
              >
                <UIcon :name="CHANGELOG_TYPE_CONFIG[item.type].icon" class="w-3.5 h-3.5" />
              </div>
              <span
                class="text-[13px] leading-relaxed text-text-secondary-light dark:text-text-secondary-dark pt-px"
              >
                {{ item.text }}
              </span>
            </li>
          </ul>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 px-5 py-4">
          <UButton variant="ghost" size="sm" class="flex-1" @click="goToChangelog">
            Все обновления
          </UButton>
          <UButton variant="primary" size="sm" class="flex-1" @click="handleClose">Понятно</UButton>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
