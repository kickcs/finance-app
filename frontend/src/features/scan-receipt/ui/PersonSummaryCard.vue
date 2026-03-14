<script setup lang="ts">
import { ref } from 'vue';
import { UIcon, InitialAvatar } from '@/shared/ui';
import { formatCurrency } from '@/shared/lib/format/currency';
import { pluralize } from '@/shared/lib/format/pluralize';
import type { ParticipantSummary } from '../model/types';

defineProps<{
  participant: ParticipantSummary;
  currency: string;
}>();

const isExpanded = ref(false);
</script>

<template>
  <div
    class="rounded-xl border border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark overflow-hidden transition-all duration-200"
    :class="isExpanded && 'ring-1 ring-border-light dark:ring-border-dark'"
  >
    <!-- Header row -->
    <button
      type="button"
      class="flex items-center gap-3 px-4 py-3 w-full text-left"
      :aria-expanded="isExpanded"
      @click="isExpanded = !isExpanded"
    >
      <!-- Colored avatar -->
      <InitialAvatar :name="participant.name" :color="participant.color" size="md" translucent />

      <div class="flex-1 min-w-0">
        <p
          class="text-sm font-semibold text-text-primary-light dark:text-text-primary-dark leading-tight"
        >
          {{ participant.name }}
          <span
            v-if="participant.isMe"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal"
          >
            (вы)
          </span>
          <span
            v-if="participant.paidByName"
            class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark font-normal"
          >
            · платит {{ participant.paidByName }}
          </span>
        </p>
        <p class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark">
          {{ participant.itemCount }}
          {{ pluralize(participant.itemCount, 'позиция', 'позиции', 'позиций') }}
        </p>
      </div>

      <!-- Total -->
      <span
        class="text-base font-bold tabular-nums flex-shrink-0"
        :style="{ color: participant.color }"
      >
        {{ formatCurrency(participant.total, currency) }}
      </span>

      <!-- Expand chevron -->
      <UIcon
        :name="isExpanded ? 'expand_less' : 'expand_more'"
        size="xs"
        class="text-text-tertiary-light dark:text-text-tertiary-dark flex-shrink-0 transition-transform duration-200"
      />
    </button>

    <!-- Expandable item list -->
    <Transition name="expand">
      <div v-if="isExpanded" class="border-t border-border-light dark:border-border-dark">
        <div
          v-for="(item, idx) in participant.items"
          :key="item.id"
          class="flex items-center justify-between px-4 py-2.5"
          :class="
            idx < participant.items.length - 1 &&
            'border-b border-border-light/50 dark:border-border-dark/50'
          "
        >
          <div class="flex-1 min-w-0 mr-3">
            <p class="text-sm text-text-primary-light dark:text-text-primary-dark truncate">
              {{ item.name }}
            </p>
            <p
              v-if="item.sharedWith > 1"
              class="text-[11px] text-text-tertiary-light dark:text-text-tertiary-dark"
            >
              1/{{ item.sharedWith }} от {{ formatCurrency(item.lineTotal, currency) }}
            </p>
          </div>
          <span
            class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark tabular-nums"
          >
            {{ formatCurrency(item.share, currency) }}
          </span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>
