<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { formatCurrency } from '@/shared/lib/format/currency';
import { calcLineTotalWithService } from '../model/calcLineTotal';
import type { ReceiptItem, Participant } from '../model/types';

const props = defineProps<{
  item: ReceiptItem;
  participants: Participant[];
  currency: string;
  serviceChargePercent?: number | null;
}>();

const emit = defineEmits<{
  toggleParticipant: [participantId: string];
}>();

const isFullyAssigned = computed(() => props.item.assignedParticipantIds.length > 0);

function isAssigned(participantId: string): boolean {
  return props.item.assignedParticipantIds.includes(participantId);
}

function getParticipant(participantId: string): Participant | undefined {
  return props.participants.find((p) => p.id === participantId);
}

function getParticipantName(participantId: string): string {
  return getParticipant(participantId)?.name ?? '?';
}

function getParticipantColor(participantId: string): string {
  return getParticipant(participantId)?.color ?? '#888888';
}

const displayTotal = computed(() => calcLineTotalWithService(props.item, props.serviceChargePercent));

const perPersonAmount = computed(() => {
  if (props.item.assignedParticipantIds.length <= 1) return null;
  return Math.round(displayTotal.value / props.item.assignedParticipantIds.length);
});
</script>

<template>
  <div
    class="rounded-xl border transition-all duration-150 overflow-hidden"
    :class="cn(
      isFullyAssigned
        ? 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
        : 'border-warning/40 bg-warning/[0.04]'
    )"
  >
    <!-- Main row: item info -->
    <div class="flex items-center gap-3 px-4 py-3">
      <!-- Assignment status -->
      <div
        class="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        :class="isFullyAssigned
          ? 'bg-success/15'
          : 'bg-warning/15'"
      >
        <UIcon
          v-if="isFullyAssigned"
          name="check"
          size="xs"
          class="text-success"
        />
        <div v-else class="w-1.5 h-1.5 rounded-full bg-warning" />
      </div>

      <!-- Item name and price -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ item.name }}
        </p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark tabular-nums">
          {{ formatCurrency(displayTotal, currency) }}
          <span v-if="item.qty !== 1" class="text-text-tertiary-light dark:text-text-tertiary-dark">
            · {{ item.qty }} шт.
          </span>
          <span
            v-if="perPersonAmount"
            class="text-text-tertiary-light dark:text-text-tertiary-dark"
          >
            · {{ formatCurrency(perPersonAmount, currency) }}/чел.
          </span>
        </p>
      </div>

      <!-- Assigned avatars stack -->
      <div
        v-if="item.assignedParticipantIds.length > 0"
        class="flex items-center -space-x-1.5 flex-shrink-0"
      >
        <div
          v-for="(pid, i) in item.assignedParticipantIds.slice(0, 3)"
          :key="pid"
          class="w-6 h-6 rounded-full border-2 border-card-light dark:border-card-dark flex items-center justify-center"
          :style="{ backgroundColor: getParticipantColor(pid), zIndex: 10 - i }"
          :aria-label="getParticipantName(pid)"
        >
          <span class="text-[9px] font-bold text-white leading-none">
            {{ getParticipantName(pid).charAt(0).toUpperCase() }}
          </span>
        </div>
        <div
          v-if="item.assignedParticipantIds.length > 3"
          class="w-6 h-6 rounded-full border-2 border-card-light dark:border-card-dark bg-surface-light dark:bg-surface-dark flex items-center justify-center"
        >
          <span class="text-[9px] font-bold text-text-secondary-light dark:text-text-secondary-dark">
            +{{ item.assignedParticipantIds.length - 3 }}
          </span>
        </div>
      </div>
    </div>

    <!-- Participant toggle chips -->
    <div
      class="flex gap-1.5 flex-wrap px-4 pb-3"
      role="group"
      :aria-label="`Назначить участников для позиции «${item.name}»`"
    >
      <button
        v-for="p in participants"
        :key="p.id"
        type="button"
        :aria-label="`${p.name}${isAssigned(p.id) ? ', назначен' : ''}`"
        :aria-pressed="isAssigned(p.id)"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-150 active:scale-95"
        :class="cn(
          isAssigned(p.id)
            ? 'text-white shadow-xs'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark'
        )"
        :style="isAssigned(p.id) ? { backgroundColor: p.color } : {}"
        @click="emit('toggleParticipant', p.id)"
      >
        {{ p.name }}
        <UIcon v-if="isAssigned(p.id)" name="check" size="xs" class="ml-0.5" />
      </button>
    </div>
  </div>
</template>
