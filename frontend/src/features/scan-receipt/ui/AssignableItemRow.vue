<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { getInitial } from '@/shared/lib/format/text';
import { formatCurrency } from '@/shared/lib/format/currency';
import { calcLineTotalWithCharges } from '../model/calcLineTotal';
import { ALL_PARTICIPANTS_ID } from '../model/constants';
import type { ReceiptItem, ReceiptCharge, Participant } from '../model/types';

const props = defineProps<{
  item: ReceiptItem;
  participants: Participant[];
  currency: string;
  charges?: ReceiptCharge[];
  subtotal?: number;
  activeBrushId?: string | null;
}>();

const emit = defineEmits<{
  tapRow: [];
}>();

const hasAssignments = computed(() => props.item.assignedParticipantIds.length > 0);

const participantMap = computed(() => new Map(props.participants.map((p) => [p.id, p])));

function isAssigned(participantId: string): boolean {
  return props.item.assignedParticipantIds.includes(participantId);
}

function getParticipantName(participantId: string): string {
  return participantMap.value.get(participantId)?.name ?? '?';
}

function getParticipantColor(participantId: string): string {
  return participantMap.value.get(participantId)?.color ?? '#888888';
}

const displayTotal = computed(() =>
  calcLineTotalWithCharges(props.item, props.charges ?? [], props.subtotal ?? 0),
);

const perPersonAmount = computed(() => {
  if (props.item.assignedParticipantIds.length <= 1) return null;
  return Math.round(displayTotal.value / props.item.assignedParticipantIds.length);
});

const isAssignedToAll = computed(() => {
  if (props.participants.length === 0) return false;
  return props.participants.every((p) => isAssigned(p.id));
});

/** Подсвечена ли строка для текущей активной кисти */
const isHighlighted = computed(() => {
  if (!props.activeBrushId) return false;
  return props.activeBrushId === ALL_PARTICIPANTS_ID
    ? isAssignedToAll.value
    : isAssigned(props.activeBrushId);
});
</script>

<template>
  <button
    type="button"
    class="w-full text-left rounded-xl border transition-all duration-200 overflow-hidden active:scale-[0.98] outline-none"
    :class="
      cn(
        hasAssignments
          ? 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
          : 'border-warning/40 bg-warning/[0.04]',
        isHighlighted && 'border-primary/40 shadow-sm ring-1 ring-primary/20 bg-primary/[0.02]',
      )
    "
    @click="emit('tapRow')"
  >
    <!-- Main row: item info -->
    <div class="flex items-center gap-3 px-4 py-3">
      <!-- Assignment status -->
      <div
        class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 shadow-sm"
        :class="
          cn(
            hasAssignments ? 'bg-success/15' : 'bg-warning/15',
            isHighlighted && 'bg-primary text-white shadow-primary/30',
          )
        "
      >
        <UIcon v-if="isHighlighted" name="check" size="xs" class="text-white" />
        <UIcon v-else-if="hasAssignments" name="check" size="xs" class="text-success" />
        <div v-else class="w-2 h-2 rounded-full bg-warning" />
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
          class="w-7 h-7 rounded-full border-[2.5px] border-card-light dark:border-card-dark flex items-center justify-center transition-all duration-300"
          :class="
            props.activeBrushId === pid &&
            'ring-2 ring-primary ring-offset-1 ring-offset-card-light dark:ring-offset-card-dark z-20 shadow-sm'
          "
          :style="{
            backgroundColor: getParticipantColor(pid),
            zIndex: props.activeBrushId === pid ? 20 : 10 - i,
          }"
          :aria-label="getParticipantName(pid)"
        >
          <span class="text-caption-sm font-bold text-white leading-none">
            {{ getInitial(getParticipantName(pid)) }}
          </span>
        </div>
        <div
          v-if="item.assignedParticipantIds.length > 3"
          class="w-7 h-7 rounded-full border-[2.5px] border-card-light dark:border-card-dark bg-surface-light dark:bg-surface-dark flex items-center justify-center z-0"
        >
          <span
            class="text-caption-sm font-bold text-text-secondary-light dark:text-text-secondary-dark"
          >
            +{{ item.assignedParticipantIds.length - 3 }}
          </span>
        </div>
      </div>
    </div>
  </button>
</template>
