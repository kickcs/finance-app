<script setup lang="ts">
import { AppHeader } from '@/widgets/header';
import { UIcon } from '@/shared/ui';
import { navigateBack } from '@/app/router';
import { useMountedAnimation } from '@/shared/lib/hooks/useMountedAnimation';
import { useChangelog, ChangelogEntryItem } from '@/features/changelog';
import { CURRENT_VERSION } from '@/features/changelog/model/changelogData';

const { allEntries, markAsSeen } = useChangelog();
markAsSeen();

const { isMounted } = useMountedAnimation();
</script>

<template>
  <div
    class="h-full flex flex-col relative bg-background-light dark:bg-background-dark pb-28 md:pb-8 overflow-y-auto"
  >
    <div class="md:hidden">
      <AppHeader title="Что нового" show-back @back="navigateBack" />
    </div>

    <main class="px-5 md:px-8 pt-4 pb-10 md:max-w-2xl md:mx-auto md:w-full">
      <!-- Hero -->
      <div
        class="mb-8 mt-2 transform transition-all duration-500 ease-out"
        :class="isMounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'"
      >
        <div class="flex items-center gap-3 mb-1">
          <div
            class="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center"
          >
            <UIcon name="celebration" size="md" class="text-primary" />
          </div>
          <div>
            <h1
              class="text-xl font-bold text-text-primary-light dark:text-text-primary-dark leading-tight"
            >
              Что нового
            </h1>
            <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-mono">
              v{{ CURRENT_VERSION }}
            </p>
          </div>
        </div>
      </div>

      <!-- Timeline -->
      <div class="relative">
        <!-- Vertical line -->
        <div
          class="absolute top-3 bottom-0 left-[11px] w-px bg-border-light dark:bg-border-dark"
        />

        <div class="space-y-6">
          <div
            v-for="(entry, index) in allEntries"
            :key="entry.version"
            class="relative pl-8 transform transition-all duration-500 ease-out"
            :class="isMounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'"
            :style="{ transitionDelay: `${100 + index * 50}ms` }"
          >
            <!-- Timeline dot -->
            <div class="absolute left-0 top-2.5 z-10">
              <div
                class="w-[23px] h-[23px] rounded-full border-[3px] flex items-center justify-center"
                :class="
                  index === 0
                    ? 'border-primary bg-primary/15 dark:bg-primary/25'
                    : 'border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark'
                "
              >
                <div
                  v-if="index === 0"
                  class="w-2 h-2 rounded-full bg-primary"
                />
                <div
                  v-else
                  class="w-1.5 h-1.5 rounded-full bg-text-tertiary-light dark:bg-text-tertiary-dark"
                />
              </div>
            </div>

            <!-- Card -->
            <div
              class="rounded-xl p-4 transition-colors duration-150 bg-card-light dark:bg-card-dark border"
              :class="
                index === 0
                  ? 'border-primary/15 dark:border-primary/20 shadow-sm'
                  : 'border-border-light dark:border-border-dark'
              "
            >
              <ChangelogEntryItem :entry="entry" show-title />
            </div>
          </div>
        </div>

        <!-- End marker -->
        <div class="relative pl-8 pt-4">
          <div class="absolute left-[7px] top-4">
            <div
              class="w-[9px] h-[9px] rounded-full bg-border-light dark:bg-border-dark"
            />
          </div>
          <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark py-1">
            Начало истории
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
