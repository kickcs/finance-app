<script setup lang="ts">
import { ref } from 'vue';
import { UIcon } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import type { ParticipantSummary } from '../model/types';

const props = defineProps<{
  participant: ParticipantSummary;
  currency: string;
}>();

const isExpanded = ref(false);
</script>

<template>
  <div
    class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden"
  >
    <!-- Header row: avatar + name + total -->
    <div class="flex items-center gap-3 px-4 py-3">
      <!-- Colored avatar -->
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        :style="{ backgroundColor: participant.color + '22' }"
      >
        <span
          class="text-base font-bold"
          :style="{ color: participant.color }"
        >
          {{ participant.name.charAt(0).toUpperCase() }}
        </span>
      </div>

      <div class="flex-1 min-w-0">
        <p class="text-base font-semibold text-text-primary-light dark:text-text-primary-dark">
          {{ participant.name }}
          <span
            v-if="participant.isMe"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal ml-1"
          >
            (вы)
          </span>
        </p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          {{ participant.itemCount }} поз.
        </p>
      </div>

      <!-- Total for this person -->
      <span class="text-lg font-bold tabular-nums" :style="{ color: participant.color }">
        {{ formatCurrency(participant.total, currency) }}
      </span>
    </div>

    <!-- Expandable item list — collapsed by default -->
    <Transition name="section-slide">
      <div
        v-if="isExpanded"
        class="border-t border-border-light dark:border-border-dark divide-y divide-border-light dark:divide-border-dark"
      >
        <div
          v-for="item in participant.items"
          :key="item.id"
          class="flex items-center justify-between px-4 py-2.5"
        >
          <div class="flex-1 min-w-0 mr-3">
            <p class="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
              {{ item.name }}
            </p>
            <!-- If item is shared: show per-person split -->
            <p
              v-if="item.sharedWith > 1"
              class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              1/{{ item.sharedWith }} от {{ formatCurrency(item.lineTotal, currency) }}
            </p>
          </div>
          <span class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark tabular-nums">
            {{ formatCurrency(item.share, currency) }}
          </span>
        </div>
      </div>
    </Transition>

    <!-- Expand toggle button -->
    <button
      type="button"
      class="flex items-center justify-center gap-1 w-full py-2 border-t border-border-light dark:border-border-dark text-text-tertiary-light dark:text-text-tertiary-dark text-xs font-medium hover:text-text-secondary-light transition-colors duration-150"
      :aria-expanded="isExpanded"
      :aria-label="isExpanded ? `Скрыть позиции ${participant.name}` : `Показать позиции ${participant.name}`"
      @click="isExpanded = !isExpanded"
    >
      {{ isExpanded ? 'Скрыть' : 'Показать позиции' }}
      <UIcon
        :name="isExpanded ? 'expand_less' : 'expand_more'"
        size="xs"
        class="transition-transform duration-200"
      />
    </button>
  </div>
</template>

<style scoped>
.section-slide-enter-active,
.section-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.section-slide-enter-from,
.section-slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.section-slide-enter-to,
.section-slide-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
