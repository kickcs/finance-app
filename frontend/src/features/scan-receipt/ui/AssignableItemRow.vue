<script setup lang="ts">
import { computed } from 'vue';
import { UIcon } from '@/shared/ui';
import { cn } from '@/shared/lib/utils';
import { formatCurrency } from '@/shared/lib/format/currency';
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

const lineTotal = computed(() => props.item.qty * props.item.unitPrice);
const lineTotalWithService = computed(() => {
  if (!props.serviceChargePercent) return lineTotal.value;
  return Math.round(lineTotal.value * (1 + props.serviceChargePercent / 100));
});
const hasServiceCharge = computed(() => !!props.serviceChargePercent && props.serviceChargePercent > 0);
</script>

<template>
  <div
    class="rounded-xl border transition-all duration-150 overflow-hidden"
    :class="cn(
      isFullyAssigned
        ? 'border-border-light dark:border-border-dark bg-card-light dark:bg-card-dark'
        : 'border-warning/30 bg-warning-light/30 dark:bg-warning-light/10'
    )"
  >
    <!-- Main row: item info -->
    <div class="flex items-center gap-3 px-4 py-3">
      <!-- Assignment status indicator -->
      <div
        class="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-200"
        :class="isFullyAssigned ? 'bg-success' : 'bg-warning'"
        :aria-label="isFullyAssigned ? 'Назначено' : 'Не назначено'"
      />

      <!-- Item name and total -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-text-primary-light dark:text-text-primary-dark truncate">
          {{ item.name }}
        </p>
        <p class="text-xs text-text-secondary-light dark:text-text-secondary-dark">
          <template v-if="hasServiceCharge">
            {{ formatCurrency(lineTotalWithService, currency) }}
            <span class="line-through text-text-tertiary-light dark:text-text-tertiary-dark ml-1">{{ formatCurrency(lineTotal, currency) }}</span>
          </template>
          <template v-else>
            {{ formatCurrency(lineTotal, currency) }}
          </template>
          <span v-if="item.qty !== 1" class="ml-1">· {{ item.qty }} шт.</span>
        </p>
      </div>

      <!-- Assigned participant avatars (overlap stack, max 3 shown + overflow) -->
      <div
        v-if="item.assignedParticipantIds.length > 0"
        class="flex items-center -space-x-1 flex-shrink-0"
        aria-label="Назначено участникам"
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
        <!-- Overflow badge -->
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

    <!-- Participant toggle chips — expanded below the main row -->
    <div
      class="flex gap-1.5 flex-wrap px-4 pb-3 pt-0"
      role="group"
      :aria-label="`Назначить участников для позиции «${item.name}»`"
    >
      <button
        v-for="p in participants"
        :key="p.id"
        type="button"
        :aria-label="`${p.name}${isAssigned(p.id) ? ', назначен' : ''}`"
        :aria-pressed="isAssigned(p.id)"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150 active:scale-95"
        :class="cn(
          isAssigned(p.id)
            ? 'text-white shadow-xs'
            : 'bg-surface-light dark:bg-surface-dark text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark'
        )"
        :style="isAssigned(p.id) ? { backgroundColor: p.color } : {}"
        @click="emit('toggleParticipant', p.id)"
      >
        <div
          class="w-3.5 h-3.5 rounded-full flex-shrink-0"
          :style="{ backgroundColor: isAssigned(p.id) ? 'rgba(255,255,255,0.3)' : p.color + '44' }"
          aria-hidden="true"
        />
        {{ p.name }}
        <UIcon v-if="isAssigned(p.id)" name="check" size="xs" />
      </button>
    </div>

    <!-- Shared item indication -->
    <p
      v-if="item.assignedParticipantIds.length > 1"
      class="text-xs text-text-tertiary-light dark:text-text-tertiary-dark mt-1 px-4 pb-2"
    >
      Разделено поровну между {{ item.assignedParticipantIds.length }} участниками
    </p>
  </div>
</template>
